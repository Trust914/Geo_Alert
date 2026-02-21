import { cacheConstants } from "../config/cache.constants.js";
import { serverConfig } from "../config/server.config.js";
import { prisma } from "../lib/prisma.js";
import { ActionType, AgencyStatus, EntityType, TwoFactorMethod } from "../prisma/prisma/generated/enums.js";
import { ACTION_DESCRIPTIONS } from "../types/actions.types.js";
import type { IPaginatedApiResponse, IPaginationMeta } from "../types/api.response.js";
import type { AuthFilters, AuthResponse, ISessionData, LoginCredentials } from "../types/auth.types.js";
import type { IAuditLogData } from "../types/common.types.js";
import { EmailPurpose } from "../types/email.types.js";
import type { IUser } from "../types/user.types.js";
import { createAuditLog } from "../utils/auditLog.util.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { getCacheService } from "./cache.service.js";
import { JWTService } from "./jwt.service.js";
import { RefreshTokenService } from "./refreshToken.service.js";
import { TwoFactorService } from "./twoFactorAuth.service.js";

export class AuthService {
  private static get cache() {
    return getCacheService();
  }

  static async login(credentials: LoginCredentials, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    const { email, password } = credentials;
    const normalizedEmail = email.toLowerCase();

    // Rate limiting check
    const loginAttempts = await this.cache.increment(cacheConstants.keys.AUTH.LOGIN_ATTEMPTS, normalizedEmail, cacheConstants.ttl.LOGIN_ATTEMPTS);

    if (loginAttempts > serverConfig.rateLimiting.loginMaxAttempts) {
      await createAuditLog(
        null,
        ActionType.LOGIN_FAILED,
        EntityType.USER,
        normalizedEmail,
        {
          description: ACTION_DESCRIPTIONS[ActionType.LOGIN_FAILED],
          reason: "Rate limit exceeded",
          attempts: loginAttempts,
        },
        ipAddress,
        userAgent,
      );

      throw AppError.tooManyRequests("Too many login attempts. Please try again later.", "AuthService");
    }

    // Get user (cache first)
    let user = await this.cache.get<IUser>(cacheConstants.keys.USER.BY_EMAIL, normalizedEmail);

    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          agency: {
            select: {
              id: true,
              name: true,
              type: true,
              jurisdictionLevel: true,
              jurisdiction: true,
              status: true,
            },
          },
        },
      });

      if (user) {
        await Promise.all([this.cache.set(cacheConstants.keys.USER.BY_EMAIL, normalizedEmail, user, cacheConstants.ttl.USER_DATA), this.cache.set(cacheConstants.keys.USER.BY_ID, user.id, user, cacheConstants.ttl.USER_DATA)]);
      }
    }

    if (!user) {
      await createAuditLog(
        null,
        ActionType.LOGIN_FAILED,
        EntityType.USER,
        normalizedEmail,
        {
          description: ACTION_DESCRIPTIONS[ActionType.LOGIN_FAILED],
          reason: "User not found",
        },
        ipAddress,
        userAgent,
      );
      throw AppError.unauthorized("Invalid email or password", "AuthService");
    }

    //  Check email verification BEFORE other validations
    if (!user.emailVerified) {
      await createAuditLog(
        user.id,
        ActionType.LOGIN_FAILED,
        EntityType.USER,
        user.id,
        {
          description: ACTION_DESCRIPTIONS[ActionType.LOGIN_FAILED],
          reason: "Email not verified",
          status: "Pending Activation",
        },
        ipAddress,
        userAgent,
      );
      throw AppError.forbidden("Please activate your account using the link sent to your email. Check spam folder if not found.", "AuthService");
    }

    // Validate account status
    if (!user.isActive) {
      await createAuditLog(
        user.id,
        ActionType.LOGIN_FAILED,
        EntityType.USER,
        user.id,
        {
          description: ACTION_DESCRIPTIONS[ActionType.LOGIN_FAILED],
          reason: "Account deactivated",
        },
        ipAddress,
        userAgent,
      );
      throw AppError.forbidden("Your account has been deactivated. Please contact your administrator.", "AuthService");
    }

    if (user.agency.status !== AgencyStatus.ACTIVE) {
      await createAuditLog(
        user.id,
        ActionType.LOGIN_FAILED,
        EntityType.USER,
        user.id,
        {
          description: ACTION_DESCRIPTIONS[ActionType.LOGIN_FAILED],
          reason: "Agency inactive",
          agencyId: user.agencyId,
          agencyStatus: user.agency.status,
        },
        ipAddress,
        userAgent,
      );
      throw AppError.forbidden("Your agency is currently inactive. Please contact support.", "AuthService");
    }

    // Verify password
    const isPasswordValid = await JWTService.verifyPasswordArgon2(user.passwordHash!, password);

    if (!isPasswordValid) {
      await createAuditLog(
        user.id,
        ActionType.LOGIN_FAILED,
        EntityType.USER,
        user.id,
        {
          description: ACTION_DESCRIPTIONS[ActionType.LOGIN_FAILED],
          reason: "Invalid password",
        },
        ipAddress,
        userAgent,
      );
      throw AppError.unauthorized("Invalid email or password", "AuthService");
    }

    // Clear login attempts on valid credentials
    await this.cache.delete(cacheConstants.keys.AUTH.LOGIN_ATTEMPTS, normalizedEmail);

    // 2FA REQUIRED PATH
    if (user.isTwoFactorEnabled) {
      const preAuthToken = JWTService.generatePreAuthToken(user.id);

      // Send email OTP if needed
      if (user.twoFactorMethod === TwoFactorMethod.EMAIL) {
        await TwoFactorService.sendEmailOTP(user.id, user.email);
      }

      await createAuditLog(
        user.id,
        ActionType.LOGIN_PENDING_2FA,
        EntityType.USER,
        user.id,
        {
          description: ACTION_DESCRIPTIONS[ActionType.LOGIN_PENDING_2FA],
          agencyId: user.agencyId,
          twoFactorMethod: user.twoFactorMethod,
        },
        ipAddress,
        userAgent,
      );

      logger.info("Login pending 2FA", {
        userId: user.id,
        method: user.twoFactorMethod,
      });

      return {
        requiresTwoFactor: true,
        twoFactorMethod: user.twoFactorMethod,
        preAuthToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      } as any;
    }

    // NO 2FA - COMPLETE LOGIN
    return this.completeLogin(user, ipAddress, userAgent);
  }

  /**
   * Logic to resend the 2FA code
   * STRICTLY scoped by context (Login vs Reset)
   */
  static async resendTwoFactorCode(
    userId: string,
    isPasswordReset: boolean, // ✅ New Parameter
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = (await this.cache.get<IUser>(cacheConstants.keys.USER.BY_ID, userId)) || (await prisma.user.findUnique({ where: { id: userId } }));

    if (!user) throw AppError.unauthorized("User not found", "AuthService");

    // --- CASE 1: Password Reset Flow ---
    // Rule: Allow "EMAIL" users AND "NONE" users (Fallback security)
    if (isPasswordReset) {
      if (user.twoFactorMethod === TwoFactorMethod.EMAIL || user.twoFactorMethod === TwoFactorMethod.NONE) {
        // Use "action" purpose for high-security reset context
        await TwoFactorService.sendEmailOTP(user.id, user.email, EmailPurpose.ACTION);
      }
      // If method is GOOGLE_AUTHENTICATOR, we do nothing (User checks app)
    }

    // --- CASE 2: Login Flow ---
    // Rule: STRICTLY allow only users who actually have Email 2FA enabled.
    // Users with "NONE" should never trigger a resend here (they don't need 2FA to login).
    else {
      if (user.isTwoFactorEnabled && user.twoFactorMethod === TwoFactorMethod.EMAIL) {
        await TwoFactorService.sendEmailOTP(user.id, user.email, EmailPurpose.LOGIN);
      } else if (user.twoFactorMethod === TwoFactorMethod.NONE) {
        // Security check: Block logic if a non-2FA user somehow hits this
        throw AppError.badRequest("Two factor authentication not enabled for this account", "AuthService");
      }
    }

    // Audit Log
    await createAuditLog(
      userId,
      ActionType.EMAIL_OTP_SENT,
      EntityType.USER,
      userId,
      {
        description: isPasswordReset ? "OTP Resent (Password Reset)" : "OTP Resent (Login)",
        method: user.twoFactorMethod,
        isFallback: user.twoFactorMethod === TwoFactorMethod.NONE,
      },
      ipAddress,
      userAgent,
    );
  }
  static async verifyTwoFactorLogin(userId: string, code: string, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    // Get user (cache first)
    let user = await this.cache.get<IUser>(cacheConstants.keys.USER.BY_ID, userId);

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          agency: {
            select: {
              id: true,
              name: true,
              type: true,
              jurisdictionLevel: true,
              jurisdiction: true,
              status: true,
            },
          },
        },
      });

      if (user) {
        await this.cache.set(cacheConstants.keys.USER.BY_ID, userId, user, cacheConstants.ttl.USER_DATA);
      }
    }

    if (!user) {
      throw AppError.unauthorized("User not found", "AuthService");
    }

    if (!user.isTwoFactorEnabled) {
      throw AppError.badRequest("2FA is not enabled for this account", "AuthService");
    }

    // Determine verification method
    let isValid = false;
    let verificationMethod = "UNKNOWN";

    const method = user.twoFactorMethod;

    // Backup code (8 chars)
    if (code.length === 8) {
      isValid = await TwoFactorService.verifyBackupCode(user.id, code, user.twoFactorBackupCodes!);
      verificationMethod = "BACKUP_CODE";
    }
    // TOTP or Email OTP (6 digits)
    else if (code.length === 6) {
      if (method === TwoFactorMethod.GOOGLE_AUTHENTICATOR) {
        if (!user.twoFactorSecret) {
          throw AppError.internal("2FA configuration error: missing secret", null, "AuthService");
        }
        isValid = await TwoFactorService.verifyTOTP(user.id, code, user.twoFactorSecret);
        verificationMethod = "GOOGLE_AUTHENTICATOR";
      } else if (method === TwoFactorMethod.EMAIL) {
        isValid = await TwoFactorService.verifyEmailOTP(user.id, code);
        verificationMethod = "EMAIL";
      }
    } else {
      throw AppError.badRequest("Invalid verification code format", "AuthService");
    }

    if (!isValid) {
      await createAuditLog(
        user.id,
        ActionType.TWO_FA_VERIFICATION_FAILED,
        EntityType.USER,
        user.id,
        {
          description: ACTION_DESCRIPTIONS[ActionType.TWO_FA_VERIFICATION_FAILED],
          method: verificationMethod,
        },
        ipAddress,
        userAgent,
      );
      throw AppError.unauthorized("Invalid verification code", "AuthService");
    }

    // Complete login
    return this.completeLogin(user, ipAddress, userAgent, verificationMethod);
  }

  private static async completeLogin(user: IUser, ipAddress?: string, userAgent?: string, twoFactorMethod?: string): Promise<AuthResponse> {
    const accessToken = JWTService.generateAccessToken(user.id, user.agencyId, user.role);
    const refreshToken = await RefreshTokenService.createRefreshToken({ userId: user.id, agencyId: user.agencyId, role: user.role }, ipAddress, userAgent);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await createAuditLog(
      user.id,
      ActionType.LOGIN_SUCCESS,
      EntityType.USER,
      user.id,
      {
        description: ACTION_DESCRIPTIONS[ActionType.LOGIN_SUCCESS],
        agencyId: user.agencyId,
        agencyName: user.agency.name,
        role: user.role,
        ...(twoFactorMethod && { twoFactorMethod, isTwoFactor: true }),
      },
      ipAddress,
      userAgent,
    );

    // Invalidate user cache
    await Promise.all([this.cache.delete(cacheConstants.keys.USER.BY_ID, user.id), this.cache.delete(cacheConstants.keys.USER.BY_EMAIL, user.email.toLowerCase())]);

    logger.info("User logged in", {
      userId: user.id,
      twoFactorMethod: twoFactorMethod || "none",
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        agencyId: user.agencyId,
        agency: user.agency,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
        twoFactorMethod: user.twoFactorMethod!,
      },
      requiresTwoFactor: false,
      accessToken,
      refreshToken,
    };
  }

  static async refreshAccessToken(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<{ accessToken: string; refreshToken: string }> {
    const isBlacklisted = await this.cache.exists(cacheConstants.keys.AUTH.TOKEN_BLACKLIST, refreshToken);

    if (isBlacklisted) {
      throw AppError.unauthorized("Token has been revoked", "AuthService");
    }

    const { userId } = await RefreshTokenService.verifyRefreshToken(refreshToken);

    let user = await this.cache.get<any>(cacheConstants.keys.USER.BY_ID, userId);

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { agency: { select: { status: true } } },
      });

      if (user) {
        await this.cache.set(cacheConstants.keys.USER.BY_ID, userId, user, cacheConstants.ttl.USER_DATA);
      }
    }

    if (!user) {
      throw AppError.unauthorized("User not found", "AuthService");
    }

    if (!user.isActive) {
      throw AppError.forbidden("Account is deactivated", "AuthService");
    }

    if (user.agency.status !== AgencyStatus.ACTIVE) {
      throw AppError.forbidden("Agency is inactive", "AuthService");
    }

    const accessToken = JWTService.generateAccessToken(user.id, user.agencyId, user.role);
    const newRefreshToken = await RefreshTokenService.createRefreshToken({ userId: user.id, agencyId: user.agencyId, role: user.role }, ipAddress, userAgent);

    await createAuditLog(userId, ActionType.TOKEN_REFRESH, EntityType.USER, userId, { description: ACTION_DESCRIPTIONS[ActionType.TOKEN_REFRESH] }, ipAddress, userAgent);

    return { accessToken, refreshToken: newRefreshToken };
  }

  static async logout(refreshToken?: string, accessToken?: string, userId?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const promises: Promise<any>[] = [];

    if (accessToken) {
      promises.push(this.cache.set(cacheConstants.keys.AUTH.TOKEN_BLACKLIST, accessToken, "true", cacheConstants.ttl.TOKEN_BLACKLIST));
    }

    if (refreshToken) {
      promises.push(this.cache.set(cacheConstants.keys.AUTH.TOKEN_BLACKLIST, refreshToken, true, cacheConstants.ttl.TOKEN_BLACKLIST), RefreshTokenService.revokeRefreshToken(refreshToken, userId!));
    }

    if (userId) {
      promises.push(createAuditLog(userId, ActionType.LOGOUT, EntityType.USER, userId, { description: ACTION_DESCRIPTIONS[ActionType.LOGOUT] }, ipAddress, userAgent));
    }

    await Promise.all(promises);
    logger.info("User logged out", { userId });
  }

  static async logoutAll(userId: string, currentAccessToken?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const promises: Promise<any>[] = [RefreshTokenService.revokeAllUserTokens(userId), this.cache.delete(cacheConstants.keys.USER.BY_ID, userId), this.cache.deletePattern(`${cacheConstants.keys.USER.SESSIONS}:${userId}:*`), createAuditLog(userId, ActionType.LOGOUT_ALL, EntityType.USER, userId, { description: ACTION_DESCRIPTIONS[ActionType.LOGOUT_ALL] }, ipAddress, userAgent)];

    if (currentAccessToken) {
      promises.push(this.cache.set(cacheConstants.keys.AUTH.TOKEN_BLACKLIST, currentAccessToken, "true", cacheConstants.ttl.TOKEN_BLACKLIST));
    }

    await Promise.all(promises);
    logger.info("User logged out from all devices", { userId });
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.notFound("User not found", "AuthService");
    }

    const isPasswordValid = await JWTService.verifyPasswordArgon2(user.passwordHash!, currentPassword);

    if (!isPasswordValid) {
      await createAuditLog(
        userId,
        ActionType.PASSWORD_CHANGE_FAILED,
        EntityType.USER,
        userId,
        {
          description: ACTION_DESCRIPTIONS[ActionType.PASSWORD_CHANGE_FAILED],
          reason: "Invalid current password",
        },
        ipAddress,
        userAgent,
      );
      throw AppError.badRequest("Current password is incorrect", "AuthService");
    }

    JWTService.validatePasswordStrength(newPassword);
    const hashedPassword = await JWTService.hashPasswordArgon2(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: hashedPassword, mustChangePassword: false },
      });

      await tx.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    });

    await Promise.all([this.cache.delete(cacheConstants.keys.USER.BY_ID, userId), this.cache.delete(cacheConstants.keys.USER.BY_EMAIL, user.email), this.cache.deletePattern(`${cacheConstants.keys.USER.SESSIONS}:${userId}:*`), createAuditLog(userId, ActionType.PASSWORD_CHANGE, EntityType.USER, userId, { description: ACTION_DESCRIPTIONS[ActionType.PASSWORD_CHANGE] }, ipAddress, userAgent)]);

    logger.info("User password changed", { userId });
  }

  static async getUserSessions(userId: string): Promise<ISessionData[]> {
    return this.cache.getOrSet(
      cacheConstants.keys.USER.SESSIONS,
      userId,
      async () => {
        const tokens = await RefreshTokenService.getUserActiveTokens(userId);
        // Map to strict ISessionData
        return tokens.map((t) => ({
          id: t.id,
          ipAddress: t.ipAddress,
          userAgent: t.userAgent,
          createdAt: t.createdAt,
          expiresAt: t.expiresAt,
          isRevoked: t.isRevoked,
        }));
      },
      cacheConstants.ttl.SHORT,
    );
  }

  static async revokeSession(userId: string, tokenId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await Promise.all([RefreshTokenService.revokeTokenById(tokenId, userId), this.cache.delete(cacheConstants.keys.USER.SESSIONS, userId), createAuditLog(userId, ActionType.SESSION_REVOKED, EntityType.REFRESH_TOKEN, tokenId, { description: ACTION_DESCRIPTIONS[ActionType.SESSION_REVOKED] }, ipAddress, userAgent)]);

    logger.info("Session revoked", { userId, tokenId });
  }

  static async getUserAuditLogs(userId: string, filters: AuthFilters): Promise<{ data: IAuditLogData[]; pagination: IPaginationMeta }> {
    const { action, entityType, startDate, endDate, pagination } = filters;
    const { currentPage, limit, skip } = pagination;

    const where: any = { userId };
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const mappedLogs: IAuditLogData[] = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      // Description is usually stored in changes or derived from action
      description: (log.changes as any)?.description || ACTION_DESCRIPTIONS[log.action] || "No description provided",
      changes: log.changes as any,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: log.timestamp,
      userId: log.userId ?? null,
      user: log.user
        ? {
            id: log.user.id,
            email: log.user.email,
            firstName: log.user.firstName,
            lastName: log.user.lastName,
          }
        : undefined,
    }));

    return {
      data: mappedLogs,
      pagination: {
        total,
        currentPage,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: currentPage < Math.ceil(total / limit),
        hasPrev: currentPage > 1,
      },
    };
  }

  static async getAgencyAuditLogs(agencyId: string, filters: AuthFilters): Promise<{ data: IAuditLogData[]; pagination: IPaginationMeta }> {
    const { action, entityType, userId, startDate, endDate, pagination } = filters;
    const { currentPage, limit, skip } = pagination;

    const where: any = { user: { agencyId } };
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Map Prisma result to strict IAuditLogData to ensure type compliance
    const mappedLogs: IAuditLogData[] = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      changes: log.changes as any,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: log.timestamp,
      userId: log.userId ?? null,
      user: log.user
        ? {
            id: log.user.id,
            email: log.user.email,
            firstName: log.user.firstName,
            lastName: log.user.lastName,
            role: log.user.role,
          }
        : undefined,
    }));

    const totalPages = Math.ceil(total / limit);
    return {
      data: mappedLogs,
      pagination: {
        total,
        currentPage,
        limit,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
      },
    };
  }

  /**
   * Verify Reset Token (Step 1 of Reset Flow)
   * Updated to return 2FA requirements so Frontend can show the code input field
   */
  static async verifyResetToken(userId: string, token: string): Promise<{ valid: boolean; requiresTwoFactor: boolean; twoFactorMethod?: string }> {
    // 1. Check Token Existence
    const tokenData = await this.cache.get<{
      hashedToken: string;
      email: string;
      expiresAt: number;
    }>(cacheConstants.keys.AUTH.PASSWORD_RESET_TOKEN, userId);

    if (!tokenData) {
      throw AppError.badRequest("Invalid or expired reset link", "AuthService");
    }

    if (Date.now() > tokenData.expiresAt) {
      await this.cache.delete(cacheConstants.keys.AUTH.PASSWORD_RESET_TOKEN, userId);
      throw AppError.badRequest("Reset link has expired", "AuthService");
    }

    // 2. Validate Signature
    const isValid = await JWTService.verifyPasswordArgon2(tokenData.hashedToken, token);
    if (!isValid) {
      throw AppError.unauthorized("Invalid reset token", "AuthService");
    }

    // 3. Check User's 2FA Status (NEW)
    // We need to tell the frontend if they should show the 2FA input
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isTwoFactorEnabled: true, twoFactorMethod: true },
    });

    if (!user) throw AppError.notFound("User not found", "AuthService");

    return {
      valid: true,
      requiresTwoFactor: user.isTwoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
    };
  }

  /**
   * Complete Password Reset (Step 2 of Reset Flow)
   * ✅ SECURED: Enforces OTP for EVERYONE.
   * - If user has Google Auth -> Must use Google Auth.
   * - If user has Email 2FA -> Must use Email 2FA.
   * - If user has NO 2FA -> Must use Email OTP (Fallback).
   */
  static async completePasswordReset(userId: string, token: string, newPassword: string, totpCode?: string): Promise<void> {
    // 1. Verify Reset Token (Link Integrity)
    await this.verifyResetToken(userId, token);

    // 2. Fetch User
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound("User not found", "AuthService");

    // 3. Determine Verification Method
    // If they have Google Auth enabled, use it. Otherwise, default to EMAIL (for both Email 2FA users and non-2FA users).
    const isGoogleAuth = user.isTwoFactorEnabled && user.twoFactorMethod === TwoFactorMethod.GOOGLE_AUTHENTICATOR;
    const methodToVerify = isGoogleAuth ? TwoFactorMethod.GOOGLE_AUTHENTICATOR : TwoFactorMethod.EMAIL;

    // 4. Enforce Code Presence
    if (!totpCode) {
      // Throw error to tell Frontend to show the Input Field
      throw AppError.badRequest("Verification code required to complete reset.", "AuthService", {
        code: "2FA_REQUIRED",
        requires2FA: true,
        method: methodToVerify, // Frontend will know whether to ask for "Authenticator Code" or "Email Code"
      });
    }

    // 5. Verify the Code
    let isCodeValid = false;

    if (methodToVerify === TwoFactorMethod.GOOGLE_AUTHENTICATOR && user.twoFactorSecret) {
      isCodeValid = await TwoFactorService.verifyTOTP(userId, totpCode, user.twoFactorSecret);
    } else {
      // Verify Email OTP (This checks the cache for the code sent via the resend-otp endpoint)
      isCodeValid = await TwoFactorService.verifyEmailOTP(userId, totpCode);
    }

    if (!isCodeValid) {
      throw AppError.unauthorized("Invalid verification code", "AuthService", {
        code: "2FA_INVALID",
      });
    }

    // 6. Update Password
    JWTService.validatePasswordStrength(newPassword);
    const hashedPassword = await JWTService.hashPasswordArgon2(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: hashedPassword,
          mustChangePassword: false,
          lastLoginAt: new Date(),
          isActive: true,
          updatedAt: new Date(),
        },
      });

      await tx.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    });

    // 7. Cleanup
    await Promise.all([
      this.cache.delete(cacheConstants.keys.AUTH.PASSWORD_RESET_TOKEN, userId),
      this.cache.delete(cacheConstants.keys.USER.BY_ID, userId),
      this.cache.delete(cacheConstants.keys.AUTH.TWO_FA_ATTEMPTS, userId),
      this.cache.delete(cacheConstants.keys.AUTH.EMAIL_OTP, userId), // Clear the used OTP
    ]);

    await createAuditLog(userId, ActionType.PASSWORD_CHANGE, EntityType.USER, userId, {
      description: "Password reset completed via secure link",
      securityMethod: methodToVerify,
    });
  }
}
