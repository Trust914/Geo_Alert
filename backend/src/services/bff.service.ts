import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { ActionType, AgencyStatus, EntityType, TwoFactorMethod, UserRole } from "../prisma/prisma/generated/enums.js";
import { ACTION_DESCRIPTIONS } from "../types/actions.types.js";
import type { IPaginationMeta } from "../types/api.response.js";
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
import type { IBFF2FARequiredResponse, IBFF2FAVerifyRequest, IBFFAuditLogEntry, IBFFAuditLogFilters, IBFFLoginRequest, IBFFLoginResponse, IBFFSession, IBFFSessionsListResponse, IBFFSessionStatusResponse, IBFFTemp2FASession, IDeviceFingerprint, ISessionValidationResult, ITokenRefreshResult } from "../types/bff.types.js";
import { cacheConstants } from "../config/cache.constants.js";
import { bffConfig, bffErrorCodes } from "../config/bff.config.js";
import { serverConfig } from "../config/server.config.js";

// Token refresh thresholds — all in milliseconds (matching bffConfig units)
// bffConfig.session.tokenRefreshThreshold = 5 * 60 * 1000 (access token buffer)
const REFRESH_TOKEN_ROTATION_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─────────────────────────────────────────────
// DATE HYDRATION HELPERS
// Redis stores everything as JSON strings. These helpers convert ISO date
// strings back to proper Date objects after reading from cache.
// ─────────────────────────────────────────────

/**
 * Revives all Date fields on an IBFFSession after Redis deserialization.
 * Call immediately after every cache.get<IBFFSession>() that may return data.
 */
function hydrateBFFSession(session: IBFFSession): IBFFSession {
  return {
    ...session,
    accessTokenExpiresAt: new Date(session.accessTokenExpiresAt),
    refreshTokenExpiresAt: new Date(session.refreshTokenExpiresAt),
    createdAt: new Date(session.createdAt),
    lastActivityAt: new Date(session.lastActivityAt),
    expiresAt: new Date(session.expiresAt),
  };
}

/**
 * Revives all Date fields on an IBFFTemp2FASession after Redis deserialization.
 */
function hydrateTempSession(session: IBFFTemp2FASession): IBFFTemp2FASession {
  return {
    ...session,
    createdAt: new Date(session.createdAt),
    expiresAt: new Date(session.expiresAt),
  };
}

export class BFFService {
  private static get cache() {
    return getCacheService();
  }

  // ═══════════════════════════════════════════════════════════════
  // SESSION VALIDATION & TOKEN REFRESH
  // ═══════════════════════════════════════════════════════════════

  /**
   * Validates session and automatically refreshes tokens when needed.
   * This is the core method called by the BFF middleware on every request.
   *
   * Token Refresh Strategy:
   * 1. If access token expires in < 5 minutes → refresh it
   * 2. If refresh token expires in < 24 hours → rotate it too
   * 3. Update session's lastActivityAt to maintain sliding window
   * 4. Enforce absolute and idle timeout policies
   */
  static async validateAndRefreshSession(sessionId: string, deviceFingerprint?: string, ipAddress?: string, userAgent?: string): Promise<ISessionValidationResult> {
    const sessionRaw = await this.cache.get<IBFFSession>(cacheConstants.keys.BFF.SESSION, sessionId);
    const session = sessionRaw ? hydrateBFFSession(sessionRaw) : null;

    if (!session) {
      return {
        valid: false,
        errorCode: bffErrorCodes.SESSION_NOT_FOUND,
        errorMessage: "Session not found or expired",
      };
    }

    const now = new Date();

    // ── Check absolute timeout ──
    if (now > session.expiresAt) {
      await this.revokeSession(sessionId);
      return {
        valid: false,
        errorCode: bffErrorCodes.SESSION_EXPIRED,
        errorMessage: "Session has expired (absolute timeout)",
      };
    }

    // ── Check idle timeout ──
    const idleTime = now.getTime() - session.lastActivityAt.getTime();
    const idleTimeoutMs = bffConfig.session.idleTimeout; // already in ms

    if (idleTime > idleTimeoutMs) {
      await this.revokeSession(sessionId);
      return {
        valid: false,
        errorCode: bffErrorCodes.SESSION_IDLE_TIMEOUT,
        errorMessage: "Session expired due to inactivity",
      };
    }

    // ── Device fingerprint validation (if enabled) ──
    if (bffConfig.security.enableDeviceFingerprinting && deviceFingerprint) {
      if (session.deviceFingerprint && session.deviceFingerprint !== deviceFingerprint) {
        await this.revokeSession(sessionId);
        await createAuditLog(
          session.userId,
          ActionType.SESSION_REVOKED,
          EntityType.SESSION,
          sessionId,
          {
            description: "Session revoked due to device fingerprint mismatch",
            reason: "Device fingerprint changed",
          },
          ipAddress,
          userAgent,
        );

        return {
          valid: false,
          errorCode: bffErrorCodes.DEVICE_FINGERPRINT_MISMATCH,
          errorMessage: "Device fingerprint mismatch - session revoked",
        };
      }
    }

    // ── Token refresh logic ──
    let tokensRefreshed = false;
    let refreshTokenRotated = false;

    // Check if access token needs refresh (< 5 minutes remaining)
    const accessTokenTimeLeft = session.accessTokenExpiresAt.getTime() - now.getTime();
    const shouldRefreshAccessToken = accessTokenTimeLeft < bffConfig.session.tokenRefreshThreshold; // both in ms

    if (shouldRefreshAccessToken) {
      logger.debug("BFF: Access token near expiry, refreshing", {
        sessionId,
        timeLeftSeconds: Math.floor(accessTokenTimeLeft / 1000),
      });

      // Check if refresh token also needs rotation (< 24 hours remaining)
      const refreshTokenTimeLeft = session.refreshTokenExpiresAt.getTime() - now.getTime();
      const shouldRotateRefreshToken = refreshTokenTimeLeft < REFRESH_TOKEN_ROTATION_THRESHOLD_MS; // both in ms

      if (shouldRotateRefreshToken) {
        logger.debug("BFF: Refresh token also near expiry, rotating", {
          sessionId,
          refreshTokenTimeLeftHours: Math.floor(refreshTokenTimeLeft / (1000 * 60 * 60)),
        });
      }

      // Perform the token refresh/rotation
      await this.refreshSessionTokens(session, shouldRotateRefreshToken, ipAddress, userAgent);

      tokensRefreshed = true;
      refreshTokenRotated = shouldRotateRefreshToken;
    }

    // ── Update last activity time (sliding session window) ──
    session.lastActivityAt = now;

    // Recalculate TTL based on absolute timeout
    const ttl = Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000);
    await this.cache.set(cacheConstants.keys.BFF.SESSION, sessionId, session, ttl);

    // Build user context for the request
    const user = await this.getUserById(session.userId);

    if (!user || !user.isActive || user.agency.status !== AgencyStatus.ACTIVE) {
      await this.revokeSession(sessionId);
      return {
        valid: false,
        errorCode: bffErrorCodes.USER_INACTIVE,
        errorMessage: "User or agency is no longer active",
      };
    }

    return {
      valid: true,
      session,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        agencyId: user.agencyId,
        mustChangePassword: user.mustChangePassword,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
      tokensRefreshed,
      refreshTokenRotated,
    };
  }

  /**
   * Refreshes tokens within an existing session.
   *
   * @param session - The current BFF session
   * @param rotateRefreshToken - Whether to also rotate the refresh token
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent
   */
  private static async refreshSessionTokens(session: IBFFSession, rotateRefreshToken: boolean, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      // Verify current refresh token is still valid
      await RefreshTokenService.verifyRefreshToken(session.refreshToken);

      // Get fresh user data
      const user = await this.getUserById(session.userId);
      if (!user || !user.isActive || user.agency.status !== AgencyStatus.ACTIVE) {
        throw new Error("User or agency no longer active");
      }

      // Generate new access token (always)
      const newAccessToken = JWTService.generateAccessToken(user.id, user.agencyId, user.role);

      // Update session with new access token
      session.accessToken = newAccessToken;
      const decoded = JWTService.verifyAccessToken(newAccessToken);
      session.accessTokenExpiresAt = new Date(decoded.exp! * 1000);

      // Rotate refresh token if needed
      if (rotateRefreshToken) {
        // Revoke old refresh token
        await RefreshTokenService.revokeRefreshToken(session.refreshToken, session.userId);

        // Create new refresh token
        const newRefreshToken = await RefreshTokenService.createRefreshToken(
          {
            userId: user.id,
            agencyId: user.agencyId,
            role: user.role,
          },
          ipAddress,
          userAgent,
        );

        // Update session
        session.refreshToken = newRefreshToken;
        session.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await createAuditLog(
          user.id,
          ActionType.TOKEN_REFRESH,
          EntityType.SESSION,
          session.sessionId,
          {
            description: "Access and refresh tokens rotated",
            rotatedRefreshToken: true,
          },
          ipAddress,
          userAgent,
        );

        logger.info("BFF: Tokens refreshed and rotated", {
          sessionId: session.sessionId,
          userId: user.id,
        });
      } else {
        await createAuditLog(
          user.id,
          ActionType.TOKEN_REFRESH,
          EntityType.SESSION,
          session.sessionId,
          {
            description: "Access token refreshed",
            rotatedRefreshToken: false,
          },
          ipAddress,
          userAgent,
        );

        logger.debug("BFF: Access token refreshed", {
          sessionId: session.sessionId,
          userId: user.id,
        });
      }

      // Persist updated session
      const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
      await this.cache.set(cacheConstants.keys.BFF.SESSION, session.sessionId, session, ttl);
    } catch (error) {
      logger.error("BFF: Failed to refresh session tokens", {
        sessionId: session.sessionId,
        error,
      });
      throw AppError.unauthorized("Token refresh failed", "BFFService");
    }
  }

  /**
   * Manual token refresh endpoint (for explicit client-driven refresh).
   * This is optional - the middleware handles automatic refresh.
   * Use this if you want to give clients control over when to refresh.
   */
  static async manualRefreshTokens(sessionId: string, ipAddress?: string, userAgent?: string): Promise<ITokenRefreshResult> {
    const sessionRaw = await this.cache.get<IBFFSession>(cacheConstants.keys.BFF.SESSION, sessionId);
    const session = sessionRaw ? hydrateBFFSession(sessionRaw) : null;

    if (!session) {
      throw AppError.unauthorized("Session not found", "BFFService");
    }

    // Always refresh access token on manual request
    const now = new Date();
    const refreshTokenTimeLeft = session.refreshTokenExpiresAt.getTime() - now.getTime();
    const shouldRotateRefreshToken = refreshTokenTimeLeft < REFRESH_TOKEN_ROTATION_THRESHOLD_MS; // both in ms

    await this.refreshSessionTokens(session, shouldRotateRefreshToken, ipAddress, userAgent);

    return {
      success: true,
      message: "Tokens refreshed successfully",
      data: {
        accessTokenExpiresAt: session.accessTokenExpiresAt,
        refreshTokenRotated: shouldRotateRefreshToken,
      },
    };
  }

  /**
   * Alias for validateAndRefreshSession for backwards compatibility
   * @deprecated Use validateAndRefreshSession instead
   */
  static async validateAndGetSession(sessionId: string, deviceFingerprint?: string, ipAddress?: string, userAgent?: string): Promise<ISessionValidationResult> {
    return this.validateAndRefreshSession(sessionId, deviceFingerprint, ipAddress, userAgent);
  }

  // ═══════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════

  static async login(request: IBFFLoginRequest, ipAddress?: string, userAgent?: string): Promise<IBFFLoginResponse | IBFF2FARequiredResponse> {
    const { email, password, deviceInfo } = request;
    const normalizedEmail = email.toLowerCase();

    // ── Rate limiting ──
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
      throw AppError.tooManyRequests("Too many login attempts. Please try again later.", "BFFService");
    }

    // ── Fetch user (cache-first) ──
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
      throw AppError.unauthorized("Invalid email or password", "BFFService");
    }

    // ── Account checks ──
    if (!user.emailVerified) {
      await createAuditLog(
        user.id,
        ActionType.LOGIN_FAILED,
        EntityType.USER,
        user.id,
        {
          description: ACTION_DESCRIPTIONS[ActionType.LOGIN_FAILED],
          reason: "Email not verified",
        },
        ipAddress,
        userAgent,
      );
      throw AppError.forbidden("Please activate your account using the link sent to your email. Check spam folder if not found.", "BFFService");
    }

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
      throw AppError.forbidden("Your account has been deactivated. Please contact your administrator.", "BFFService");
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
        },
        ipAddress,
        userAgent,
      );
      throw AppError.forbidden("Your agency is currently inactive. Please contact support.", "BFFService");
    }

    // ── Password verification ──
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
      throw AppError.unauthorized("Invalid email or password", "BFFService");
    }

    // Clear rate-limit counter on valid credentials
    await this.cache.delete(cacheConstants.keys.AUTH.LOGIN_ATTEMPTS, normalizedEmail);

    // ── 2FA required path ──
    if (user.isTwoFactorEnabled) {
      const tempSessionId = this.generateSessionId("temp");

      // Send email OTP if needed
      if (user.twoFactorMethod === TwoFactorMethod.EMAIL) {
        await TwoFactorService.sendEmailOTP(user.id, user.email);
      }

      const temp2FASession: IBFFTemp2FASession = {
        tempSessionId,
        userId: user.id,
        email: user.email,
        twoFactorMethod: user.twoFactorMethod!,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + bffConfig.twoFactor.tempSessionExpiry * 1000),
        ipAddress: ipAddress as string,
        userAgent: userAgent as string,
        deviceFingerprint: deviceInfo?.fingerprint as string,
      };

      await this.cache.set(cacheConstants.keys.BFF.TEMP_2FA_SESSION, tempSessionId, temp2FASession, bffConfig.twoFactor.tempSessionExpiry);

      await createAuditLog(
        user.id,
        ActionType.LOGIN_PENDING_2FA,
        EntityType.USER,
        user.id,
        {
          description: ACTION_DESCRIPTIONS[ActionType.LOGIN_PENDING_2FA],
          twoFactorMethod: user.twoFactorMethod,
          tempSessionId,
        },
        ipAddress,
        userAgent,
      );

      logger.info("Login pending 2FA (BFF)", {
        userId: user.id,
        method: user.twoFactorMethod,
      });

      return {
        success: true,
        data: {
          requiresTwoFactor: true,
          tempSessionId,
          twoFactorMethod: user.twoFactorMethod!,
          expiresIn: bffConfig.twoFactor.tempSessionExpiry,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        },
      };
    }

    // ── Complete login (no 2FA) ──
    return this.completeLogin(user, deviceInfo?.fingerprint, ipAddress, userAgent);
  }

  // ═══════════════════════════════════════════════════════════════
  // 2FA VERIFICATION
  // ═══════════════════════════════════════════════════════════════

  static async verify2FA(request: IBFF2FAVerifyRequest, ipAddress?: string, userAgent?: string): Promise<IBFFLoginResponse> {
    const { code, tempSessionId } = request;

    const temp2FASessionRaw = await this.cache.get<IBFFTemp2FASession>(cacheConstants.keys.BFF.TEMP_2FA_SESSION, tempSessionId);
    const temp2FASession = temp2FASessionRaw ? hydrateTempSession(temp2FASessionRaw) : null;

    if (!temp2FASession) {
      throw AppError.unauthorized("2FA session expired. Please login again.", "BFFService");
    }

    if (new Date() > temp2FASession.expiresAt) {
      await this.cache.delete(cacheConstants.keys.BFF.TEMP_2FA_SESSION, tempSessionId);
      throw AppError.unauthorized("2FA session expired. Please login again.", "BFFService");
    }

    // Fetch user
    const user = await this.getUserById(temp2FASession.userId);

    if (!user || !user.isActive || user.agency.status !== AgencyStatus.ACTIVE) {
      await this.cache.delete(cacheConstants.keys.BFF.TEMP_2FA_SESSION, tempSessionId);
      throw AppError.unauthorized("User or agency is no longer active", "BFFService");
    }

    // Verify 2FA code
    let isValid = false;
    let verificationMethod = "UNKNOWN";

    // Backup code (8 chars)
    if (code.length === 8) {
      isValid = await TwoFactorService.verifyBackupCode(user.id, code, user.twoFactorBackupCodes!);
      verificationMethod = "BACKUP_CODE";
    }
    // TOTP or Email OTP (6 digits)
    else if (code.length === 6) {
      if (temp2FASession.twoFactorMethod === TwoFactorMethod.GOOGLE_AUTHENTICATOR) {
        if (!user.twoFactorSecret) {
          throw AppError.internal("2FA configuration error: missing secret", null, "BFFService");
        }
        isValid = await TwoFactorService.verifyTOTP(user.id, code, user.twoFactorSecret);
        verificationMethod = "GOOGLE_AUTHENTICATOR";
      } else if (temp2FASession.twoFactorMethod === TwoFactorMethod.EMAIL) {
        isValid = await TwoFactorService.verifyEmailOTP(user.id, code);
        verificationMethod = "EMAIL";
      }
    } else {
      throw AppError.badRequest("Invalid verification code format", "BFFService");
    }

    if (!isValid) {
      await createAuditLog(
        user.id,
        ActionType.TWO_FA_VERIFICATION_FAILED,
        EntityType.USER,
        user.id,
        {
          description: "2FA verification failed",
          method: verificationMethod,
        },
        ipAddress,
        userAgent,
      );
      throw AppError.unauthorized("Invalid verification code", "BFFService");
    }

    // Clean up temp session
    await this.cache.delete(cacheConstants.keys.BFF.TEMP_2FA_SESSION, tempSessionId);

    // Complete login
    return this.completeLogin(user, temp2FASession.deviceFingerprint, ipAddress, userAgent, verificationMethod);
  }

  // ═══════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════

  static async logout(sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const sessionRaw = await this.cache.get<IBFFSession>(cacheConstants.keys.BFF.SESSION, sessionId);
    const session = sessionRaw ? hydrateBFFSession(sessionRaw) : null;

    if (session) {
      // Revoke the refresh token in the database
      await RefreshTokenService.revokeRefreshToken(session.refreshToken, session.userId);

      // Blacklist access token
      await this.cache.set(cacheConstants.keys.AUTH.TOKEN_BLACKLIST, session.accessToken, true, cacheConstants.ttl.TOKEN_BLACKLIST);

      await createAuditLog(
        session.userId,
        ActionType.LOGOUT,
        EntityType.SESSION,
        sessionId,
        {
          description: ACTION_DESCRIPTIONS[ActionType.LOGOUT],
        },
        ipAddress,
        userAgent,
      );
    }

    await this.revokeSession(sessionId);
    logger.info("BFF: User logged out", { sessionId });
  }

  static async logoutAll(userId: string, currentSessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const sessionIds = (await this.cache.get<string[]>(cacheConstants.keys.BFF.USER_SESSIONS, userId)) ?? [];

    // Revoke all sessions and their underlying tokens
    for (const sessionId of sessionIds) {
      const sessionRaw = await this.cache.get<IBFFSession>(cacheConstants.keys.BFF.SESSION, sessionId);
      const session = sessionRaw ? hydrateBFFSession(sessionRaw) : null;

      if (session) {
        await RefreshTokenService.revokeRefreshToken(session.refreshToken, userId);
        await this.cache.set(cacheConstants.keys.AUTH.TOKEN_BLACKLIST, session.accessToken, true, cacheConstants.ttl.TOKEN_BLACKLIST);
      }

      await this.cache.delete(cacheConstants.keys.BFF.SESSION, sessionId);
    }

    await this.cache.delete(cacheConstants.keys.BFF.USER_SESSIONS, userId);

    await createAuditLog(
      userId,
      ActionType.LOGOUT_ALL,
      EntityType.USER,
      userId,
      {
        description: "All sessions terminated",
        sessionCount: sessionIds.length,
        initiatedFrom: currentSessionId,
      },
      ipAddress,
      userAgent,
    );

    logger.info("BFF: All sessions revoked", {
      userId,
      count: sessionIds.length,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  static async getSessionStatus(sessionId: string): Promise<IBFFSessionStatusResponse> {
    const sessionRaw = await this.cache.get<IBFFSession>(cacheConstants.keys.BFF.SESSION, sessionId);
    const session = sessionRaw ? hydrateBFFSession(sessionRaw) : null;

    if (!session) {
      throw AppError.unauthorized("Session not found", "BFFService");
    }

    const user = await this.getUserById(session.userId);

    if (!user) {
      throw AppError.unauthorized("User not found", "BFFService");
    }

    const now = new Date();
    const idleTime = now.getTime() - session.lastActivityAt.getTime();
    const remainingIdleTime = bffConfig.session.idleTimeout - idleTime; // idleTimeout already in ms
    const accessTokenTimeLeft = session.accessTokenExpiresAt.getTime() - now.getTime();
    const refreshTokenTimeLeft = session.refreshTokenExpiresAt.getTime() - now.getTime();

    return {
      success: true,
      data: {
        sessionId: session.sessionId,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          agencyId: user.agencyId,
          mustChangePassword: user.mustChangePassword,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
        },
        session: {
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          lastActivityAt: session.lastActivityAt,
          remainingIdleTime: Math.max(0, Math.floor(remainingIdleTime / 1000)),
          accessTokenExpiresAt: session.accessTokenExpiresAt,
          accessTokenExpiresIn: Math.max(0, Math.floor(accessTokenTimeLeft / 1000)),
          refreshTokenExpiresAt: session.refreshTokenExpiresAt,
          refreshTokenExpiresIn: Math.max(0, Math.floor(refreshTokenTimeLeft / 1000)),
          maxIdleTime: Math.floor(bffConfig.session.idleTimeout / 1000), // send seconds to client
        },
        requiresPasswordChange: session.requiresPasswordChange,
      },
    };
  }

  static async getUserSessions(userId: string, currentSessionId: string): Promise<IBFFSessionsListResponse> {
    const sessionIds = (await this.cache.get<string[]>(cacheConstants.keys.BFF.USER_SESSIONS, userId)) ?? [];

    const sessions: any[] = [];

    for (const id of sessionIds) {
      const sRaw = await this.cache.get<IBFFSession>(cacheConstants.keys.BFF.SESSION, id);
      const s = sRaw ? hydrateBFFSession(sRaw) : null;
      if (s) {
        sessions.push({
          sessionId: s.sessionId,
          createdAt: s.createdAt,
          lastActivityAt: s.lastActivityAt,
          expiresAt: s.expiresAt,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          isCurrent: s.sessionId === currentSessionId,
        });
      }
    }

    // Sort by last activity (most recent first)
    sessions.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

    return {
      success: true,
      message: "Sessions retrieved",
      data: { sessions },
    };
  }

  static async revokeOneSession(userId: string, sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const sessionRaw = await this.cache.get<IBFFSession>(cacheConstants.keys.BFF.SESSION, sessionId);
    const session = sessionRaw ? hydrateBFFSession(sessionRaw) : null;

    if (!session) {
      throw AppError.notFound("Session not found", "BFFService");
    }

    if (session.userId !== userId) {
      throw AppError.forbidden("Cannot revoke another user's session", "BFFService");
    }

    // Revoke tokens
    await RefreshTokenService.revokeRefreshToken(session.refreshToken, userId);
    await this.cache.set(cacheConstants.keys.AUTH.TOKEN_BLACKLIST, session.accessToken, true, cacheConstants.ttl.TOKEN_BLACKLIST);

    await this.revokeSession(sessionId);

    await createAuditLog(
      userId,
      ActionType.SESSION_REVOKED,
      EntityType.SESSION,
      sessionId,
      {
        description: "Session manually revoked",
      },
      ipAddress,
      userAgent,
    );

    logger.info("BFF: Session revoked", { userId, sessionId });
  }

  // ═══════════════════════════════════════════════════════════════
  // PASSWORD MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  static async changePassword(sessionId: string, userId: string, currentPassword: string, newPassword: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.notFound("User not found", "BFFService");
    }

    // Verify current password
    const isValid = await JWTService.verifyPasswordArgon2(user.passwordHash!, currentPassword);

    if (!isValid) {
      throw AppError.unauthorized("Current password is incorrect", "BFFService");
    }

    // Hash new password
    const newPasswordHash = await JWTService.hashPasswordArgon2(newPassword);

    // Update password and clear mustChangePassword flag
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });

    // Invalidate all refresh tokens (force re-login on all devices)
    await RefreshTokenService.revokeAllUserTokens(userId);

    // Revoke all BFF sessions
    await this.revokeAllUserSessions(userId);

    // Invalidate user cache
    await Promise.all([this.cache.delete(cacheConstants.keys.USER.BY_ID, userId), this.cache.delete(cacheConstants.keys.USER.BY_EMAIL, user.email.toLowerCase())]);

    await createAuditLog(
      userId,
      ActionType.PASSWORD_CHANGE,
      EntityType.USER,
      userId,
      {
        description: ACTION_DESCRIPTIONS[ActionType.PASSWORD_CHANGE],
        initiatedFrom: sessionId,
      },
      ipAddress,
      userAgent,
    );

    logger.info("BFF: Password changed, all sessions revoked", { userId });
  }

  // ═══════════════════════════════════════════════════════════════
  // USER DATA
  // ═══════════════════════════════════════════════════════════════

  static async getCurrentUser(userId: string): Promise<any> {
    const user = await this.getUserById(userId);

    if (!user) {
      throw AppError.notFound("User not found", "BFFService");
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      agencyId: user.agencyId,
      agency: user.agency,
      mustChangePassword: user.mustChangePassword,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════

  static async getUserAuditLogs(userId: string, filters: IBFFAuditLogFilters): Promise<{ data: IAuditLogData[]; pagination: IPaginationMeta }> {
    const { action, startDate, endDate, pagination, sortOptions } = filters;

    const where: any = { userId };

    if (action) where.action = action;
    if (startDate) where.createdAt = { ...where.createdAt, gte: startDate };
    if (endDate) where.createdAt = { ...where.createdAt, lte: endDate };
    const { currentPage, limit, skip } = pagination;
    const { sortBy } = sortOptions;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: skip,
        take: limit,
        orderBy: sortBy,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.limit);

    return {
      data: logs as any,
      pagination: {
        total,
        currentPage: currentPage,
        limit: limit,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
      },
    };
  }

  static async getAgencyAuditLogs(agencyId: string, filters: IBFFAuditLogFilters): Promise<{ data: IAuditLogData[]; pagination: IPaginationMeta }> {
    const { action, entityType, userId, startDate, endDate, pagination, sortOptions } = filters;

    const where: any = { agencyId };

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;
    if (startDate) where.createdAt = { ...where.createdAt, gte: startDate };
    if (endDate) where.createdAt = { ...where.createdAt, lte: endDate };

    const { currentPage, limit, skip } = pagination;
    const { sortBy } = sortOptions;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: skip,
        take: limit,
        orderBy: sortBy,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.limit);

    return {
      data: logs as any,
      pagination: {
        total,
        currentPage: currentPage,
        limit: limit,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PASSWORD RESET (Stateless — no session required)
  // ═══════════════════════════════════════════════════════════════

  // static async verifyResetToken(userId: string, token: string): Promise<{ valid: boolean; requiresTwoFactor: boolean }> {
  //   const user = await prisma.user.findUnique({
  //     where: { id: userId },
  //     select: {
  //       id: true,
  //       passwordResetToken: true,
  //       passwordResetExpiry: true,
  //       isTwoFactorEnabled: true,
  //     },
  //   });

  //   if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
  //     throw AppError.badRequest("Invalid or expired reset token", "BFFService");
  //   }

  //   if (new Date() > user.passwordResetExpiry) {
  //     throw AppError.badRequest("Reset token has expired", "BFFService");
  //   }

  //   const isValid = await JWTService.verifyPasswordArgon2(user.passwordResetToken, token);

  //   if (!isValid) {
  //     throw AppError.badRequest("Invalid reset token", "BFFService");
  //   }

  //   return {
  //     valid: true,
  //     requiresTwoFactor: user.isTwoFactorEnabled,
  //   };
  // }

  static async verifyResetToken(userId: string, token: string): Promise<{ valid: boolean; requiresTwoFactor: boolean; twoFactorMethod?: TwoFactorMethod | string }> {
    // Token is stored in Redis (not DB columns) — consistent with AuthService pattern
    const tokenData = await this.cache.get<{
      hashedToken: string;
      email: string;
      expiresAt: number;
    }>(cacheConstants.keys.AUTH.PASSWORD_RESET_TOKEN, userId);

    if (!tokenData) {
      throw AppError.badRequest("Invalid or expired reset token", "BFFService");
    }

    if (Date.now() > tokenData.expiresAt) {
      await this.cache.delete(cacheConstants.keys.AUTH.PASSWORD_RESET_TOKEN, userId);
      throw AppError.badRequest("Reset token has expired", "BFFService");
    }

    const isValid = await JWTService.verifyPasswordArgon2(tokenData.hashedToken, token);

    if (!isValid) {
      throw AppError.badRequest("Invalid reset token", "BFFService");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isTwoFactorEnabled: true, twoFactorMethod: true },
    });

    if (!user) {
      throw AppError.notFound("User not found", "BFFService");
    }

    return {
      valid: true,
      requiresTwoFactor: user.isTwoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
    };
  }

  static async completePasswordReset(userId: string, token: string, newPassword: string, totpCode?: string): Promise<void> {
    // Verify token
    const verification = await this.verifyResetToken(userId, token);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isTwoFactorEnabled: true,
        twoFactorMethod: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user) {
      throw AppError.notFound("User not found", "BFFService");
    }

    // If 2FA is enabled, verify the code
    if (verification.requiresTwoFactor) {
      if (!totpCode) {
        throw AppError.badRequest("2FA code required", "BFFService");
      }

      let isValid = false;

      if (totpCode.length === 8) {
        isValid = await TwoFactorService.verifyBackupCode(user.id, totpCode, user.twoFactorBackupCodes!);
      } else if (totpCode.length === 6) {
        if (user.twoFactorMethod === TwoFactorMethod.GOOGLE_AUTHENTICATOR) {
          isValid = await TwoFactorService.verifyTOTP(user.id, totpCode, user.twoFactorSecret!);
        } else if (user.twoFactorMethod === TwoFactorMethod.EMAIL) {
          isValid = await TwoFactorService.verifyEmailOTP(user.id, totpCode);
        }
      }

      if (!isValid) {
        throw AppError.unauthorized("Invalid 2FA code", "BFFService");
      }
    }

    // Hash new password
    const newPasswordHash = await JWTService.hashPasswordArgon2(newPassword);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });

    // Revoke all existing sessions and tokens
    await RefreshTokenService.revokeAllUserTokens(userId);
    await this.revokeAllUserSessions(userId);

    await createAuditLog(userId, ActionType.PASSWORD_RESET, EntityType.USER, userId, {
      description: "Password reset completed",
    });

    logger.info("BFF: Password reset completed", { userId });
  }

  static async resendLoginOTP(tempSessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const temp2FASessionRaw = await this.cache.get<IBFFTemp2FASession>(cacheConstants.keys.BFF.TEMP_2FA_SESSION, tempSessionId);
    const temp2FASession = temp2FASessionRaw ? hydrateTempSession(temp2FASessionRaw) : null;

    if (!temp2FASession) {
      throw AppError.unauthorized("2FA session expired. Please login again.", "BFFService");
    }

    if (temp2FASession.twoFactorMethod !== TwoFactorMethod.EMAIL) {
      throw AppError.badRequest("OTP resend is only available for email 2FA", "BFFService");
    }

    await TwoFactorService.sendEmailOTP(temp2FASession.userId, temp2FASession.email);

    await createAuditLog(
      temp2FASession.userId,
      ActionType.EMAIL_OTP_SENT,
      EntityType.USER,
      temp2FASession.userId,
      {
        description: "OTP resent (login)",
      },
      ipAddress,
      userAgent,
    );

    logger.info("BFF: Login OTP resent", {
      userId: temp2FASession.userId,
      tempSessionId,
    });
  }

  static async resendPasswordResetOTP(userId: string, token: string, ipAddress?: string, userAgent?: string): Promise<void> {
    // Verify the reset token to ensure the request is legitimate
    await this.verifyResetToken(userId, token);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        twoFactorMethod: true,
      },
    });

    if (!user) {
      throw AppError.notFound("User not found", "BFFService");
    }

    if (user.twoFactorMethod !== TwoFactorMethod.EMAIL) {
      throw AppError.badRequest("OTP resend is only available for email 2FA", "BFFService");
    }

    await TwoFactorService.sendEmailOTP(userId, user.email);

    await createAuditLog(
      userId,
      ActionType.EMAIL_OTP_SENT,
      EntityType.USER,
      userId,
      {
        description: "OTP resent (password reset)",
      },
      ipAddress,
      userAgent,
    );

    logger.info("BFF: Password reset OTP resent", { userId });
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE HELPER METHODS
  // ═══════════════════════════════════════════════════════════════

  private static async getUserById(userId: string): Promise<IUser | null> {
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

    return user;
  }

  private static async createBFFSession(userId: string, agencyId: string, role: UserRole, accessToken: string, refreshToken: string, requiresPasswordChange: boolean, has2FAEnabled: boolean, deviceFingerprint?: string, ipAddress?: string, userAgent?: string): Promise<IBFFSession> {
    const sessionId = this.generateSessionId("bff");
    const now = new Date();

    const decoded = JWTService.verifyAccessToken(accessToken);
    const accessTokenExpiresAt = new Date(decoded.exp! * 1000);
    const refreshTokenExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(now.getTime() + bffConfig.session.absoluteTimeout);

    // Enforce max concurrent sessions
    const activeCount = await this.getActiveSessionCount(userId);
    if (activeCount >= bffConfig.session.maxConcurrent) {
      await this.revokeOldestSession(userId);
    }

    const session: IBFFSession = {
      sessionId,
      userId,
      agencyId,
      role,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
      ipAddress: ipAddress as string,
      userAgent: userAgent as string,
      deviceFingerprint: deviceFingerprint as string,
      requiresPasswordChange,
      has2FAEnabled,
    };

    const ttl = Math.floor(bffConfig.session.absoluteTimeout / 1000);
    await this.cache.set(cacheConstants.keys.BFF.SESSION, sessionId, session, ttl);
    await this.addToUserSessions(userId, sessionId);

    return session;
  }

  private static async completeLogin(user: IUser, deviceFingerprint?: string, ipAddress?: string, userAgent?: string, twoFactorMethod?: string): Promise<IBFFLoginResponse> {
    const accessToken = JWTService.generateAccessToken(user.id, user.agencyId, user.role);
    const refreshToken = await RefreshTokenService.createRefreshToken(
      {
        userId: user.id,
        agencyId: user.agencyId,
        role: user.role,
      },
      ipAddress,
      userAgent,
    );

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const session = await this.createBFFSession(user.id, user.agencyId, user.role, accessToken, refreshToken, user.mustChangePassword, user.isTwoFactorEnabled, deviceFingerprint, ipAddress, userAgent);

    await createAuditLog(
      user.id,
      ActionType.LOGIN_SUCCESS,
      EntityType.SESSION,
      session.sessionId,
      {
        description: ACTION_DESCRIPTIONS[ActionType.LOGIN_SUCCESS],
        agencyId: user.agencyId,
        role: user.role,
        ...(twoFactorMethod && { twoFactorMethod, isTwoFactor: true }),
      },
      ipAddress,
      userAgent,
    );

    // Invalidate stale user cache
    await Promise.all([this.cache.delete(cacheConstants.keys.USER.BY_ID, user.id), this.cache.delete(cacheConstants.keys.USER.BY_EMAIL, user.email.toLowerCase())]);

    logger.info("BFF: Login complete", {
      userId: user.id,
      sessionId: session.sessionId,
      twoFactorMethod: twoFactorMethod ?? "none",
    });

    return {
      success: true,
      data: {
        sessionId: session.sessionId,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          agencyId: user.agencyId,
          mustChangePassword: user.mustChangePassword,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          twoFactorMethod: user.twoFactorMethod as TwoFactorMethod,
        },
        session: {
          expiresAt: session.expiresAt,
          maxIdleTime: Math.floor(bffConfig.session.idleTimeout / 1000), // send seconds to client
        },
      },
    };
  }

  // ─────────────────────────────────────────────
  // Redis session registry helpers
  // ─────────────────────────────────────────────

  private static async revokeSession(sessionId: string): Promise<void> {
    const sessionRaw = await this.cache.get<IBFFSession>(cacheConstants.keys.BFF.SESSION, sessionId);
    const session = sessionRaw ? hydrateBFFSession(sessionRaw) : null;
    await this.cache.delete(cacheConstants.keys.BFF.SESSION, sessionId);

    if (session) {
      const ids = (await this.cache.get<string[]>(cacheConstants.keys.BFF.USER_SESSIONS, session.userId)) ?? [];
      const updated = ids.filter((id) => id !== sessionId);
      await this.cache.set(cacheConstants.keys.BFF.USER_SESSIONS, session.userId, updated, cacheConstants.ttl.BFF_SESSION);
    }
  }

  private static async revokeAllUserSessions(userId: string): Promise<void> {
    const ids = (await this.cache.get<string[]>(cacheConstants.keys.BFF.USER_SESSIONS, userId)) ?? [];
    await Promise.all(ids.map((id) => this.cache.delete(cacheConstants.keys.BFF.SESSION, id)));
    await this.cache.delete(cacheConstants.keys.BFF.USER_SESSIONS, userId);
  }

  private static async addToUserSessions(userId: string, sessionId: string): Promise<void> {
    const ids = (await this.cache.get<string[]>(cacheConstants.keys.BFF.USER_SESSIONS, userId)) ?? [];
    ids.push(sessionId);
    await this.cache.set(cacheConstants.keys.BFF.USER_SESSIONS, userId, ids, cacheConstants.ttl.BFF_SESSION);
  }

  private static async getActiveSessionCount(userId: string): Promise<number> {
    const ids = (await this.cache.get<string[]>(cacheConstants.keys.BFF.USER_SESSIONS, userId)) ?? [];
    let count = 0;
    for (const id of ids) {
      const sRaw = await this.cache.get<IBFFSession>(cacheConstants.keys.BFF.SESSION, id);
      const s = sRaw ? hydrateBFFSession(sRaw) : null;
      if (s) count++;
    }
    return count;
  }

  private static async revokeOldestSession(userId: string): Promise<void> {
    const ids = (await this.cache.get<string[]>(cacheConstants.keys.BFF.USER_SESSIONS, userId)) ?? [];
    let oldest: IBFFSession | null = null;
    let oldestId: string | null = null;

    for (const id of ids) {
      const sRaw = await this.cache.get<IBFFSession>(cacheConstants.keys.BFF.SESSION, id);
      const s = sRaw ? hydrateBFFSession(sRaw) : null;
      if (s && (!oldest || s.createdAt < oldest.createdAt)) {
        oldest = s;
        oldestId = id;
      }
    }

    if (oldestId) {
      logger.info("BFF: Revoking oldest session (max concurrent limit)", {
        userId,
        oldestId,
      });
      await this.revokeSession(oldestId);
    }
  }

  private static generateSessionId(prefix: "bff" | "temp" = "bff"): string {
    return `${prefix}_sess_${crypto.randomBytes(32).toString("hex")}`;
  }

  static generateDeviceFingerprintHash(fp: IDeviceFingerprint): string {
    const data = [fp.userAgent, fp.platform, fp.language, fp.timezone, fp.screenResolution, fp.colorDepth].filter(Boolean).join("|");

    return crypto.createHash("sha256").update(data).digest("hex");
  }
}
