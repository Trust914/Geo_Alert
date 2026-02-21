import { cacheConstants } from "../config/cache.constants.js";
import { serverConfig } from "../config/server.config.js";
import { mapToSafeUser } from "../helpers/service.helpers.js";
import { prisma } from "../lib/prisma.js";
import { ActionType, AgencyStatus, AgencyType, EntityType, JurisdictionLevel, UserRole } from "../prisma/prisma/generated/enums.js";
import { RabbitMQService } from "../rabbitmq/rabbitmq.queue.js";
import { ACTION_DESCRIPTIONS } from "../types/actions.types.js";
import { AccountType, type IActivationEmailData } from "../types/activation.types.js";
import { EmailType, type IPasswordResetData, type IUserWelcomeData } from "../types/email.types.js";
import type { IAgencyListResponse, ICreateUserDTO, ISafeUser, IUpdateUserDTO, IUserFilters } from "../types/user.types.js";
import { getNemaAgencyId } from "../utils/app.utils.js";
import { createAuditLog } from "../utils/auditLog.util.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { ActivationService } from "./activation.service.js";
import { getCacheService } from "./cache.service.js";
import { EmailService } from "./email/email.service.js";
import { EmailTemplateService } from "./email/email.templates.service.js";
import { JWTService } from "./jwt.service.js";

export class UserService {
  private static get cache() {
    return getCacheService();
  }

  private static readonly APP_NAME = serverConfig.app.name.split("_")[0]; // Extract app name from API_NAME
  private static readonly APP_NAME_LOWER = this.APP_NAME?.toLowerCase();

  static async createUser(data: ICreateUserDTO, creatorUserId: string): Promise<ISafeUser> {
    // const cache = getCacheService();

    // Get creator user to validate permissions
    const creator = await prisma.user.findUnique({
      where: { id: creatorUserId },
      include: { agency: true },
    });

    if (!creator) {
      throw AppError.notFound("Creator user not found", "UserService");
    }

    // Only ADMIN can create users
    if (creator.role !== UserRole.ADMIN) {
      throw AppError.forbidden("Only administrators can create users", "UserService");
    }

    const nemaAgencyId = await getNemaAgencyId();

    // Determine if creator is super admin (NEMA admin)
    const isSuperAdmin = creator.agency.type === AgencyType.FEDERAL && creator.agency.jurisdictionLevel === JurisdictionLevel.NATIONAL && creator.role === UserRole.ADMIN && creator.agencyId === nemaAgencyId;

    // Smart agency ID handling
    let targetAgencyId: string;

    if (isSuperAdmin) {
      // Super admin MUST provide agencyId
      if (!data.agencyId) {
        throw AppError.badRequest("Agency ID is required when creating users as NEMA administrator", "UserService");
      }
      targetAgencyId = data.agencyId;
    } else {
      // Regular admin: automatically use their own agency
      // Ignore any agencyId provided in the request
      targetAgencyId = creator.agencyId;

      // Log if they tried to specify a different agency
      if (data.agencyId && data.agencyId !== creator.agencyId) {
        logger.warn("Regular admin attempted to create user for different agency", {
          adminId: creatorUserId,
          adminAgencyId: creator.agencyId,
          attemptedAgencyId: data.agencyId,
        });
      }
    }

    // Validate target agency exists and is active
    const agency = await prisma.agency.findUnique({
      where: { id: targetAgencyId },
    });

    if (!agency) {
      throw AppError.notFound("Target agency not found", "UserService");
    }

    if (agency.status !== AgencyStatus.ACTIVE) {
      throw AppError.badRequest(`Cannot create users for inactive agency: ${agency.name}`, "UserService");
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw AppError.conflict(`User with email "${data.email}" already exists`, "UserService");
    }

    // Generate temporary password
    const temporaryPassword = JWTService.generateSystemSecret();
    const hashedPassword = await JWTService.hashPasswordArgon2(temporaryPassword);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        agencyId: targetAgencyId, // Use the determined agency ID
        isActive: false,
        mustChangePassword: false,
        emailVerified: false,
      },
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            type: true,
            jurisdictionLevel: true,
            status: true,
          },
        },
      },
    });

    // AUDIT LOG
    await createAuditLog(creatorUserId, ActionType.USER_CREATED, EntityType.USER, user.id, {
      description: ACTION_DESCRIPTIONS[ActionType.USER_CREATED],
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
      agencyName: agency.name,
      createdBy: isSuperAdmin ? "SUPER_ADMIN" : "AGENCY_ADMIN",
    });

    // Send welcome email with temporary credentials
    // this.sendUserWelcomeEmail(user, agency, temporaryPassword, creator).catch(
    //   (error) => {
    //     logger.error("Failed to send user welcome email", {
    //       userId: user.id,
    //       error: error.message,
    //     });
    //   }
    // );

    const emaildata: IActivationEmailData = {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      accountType: user.role === UserRole.ADMIN ? AccountType.AGENCY_ADMIN : AccountType.USER,
      metadata: {
        agencyName: agency.name,
        role: user.role,
        creatorName: `${creator.firstName} ${creator.lastName}`,
        agencyType: agency.type,
        jurisdiction: agency.jurisdictionLevel,
      },
    };

    await ActivationService.sendActivationEmail(emaildata);

    // Invalidate agency users cache
    await this.cache.deletePattern(`${cacheConstants.keys.AGENCY.USERS}:${targetAgencyId}:*`);

    logger.info("User created successfully", {
      userId: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
      agencyName: agency.name,
      createdBy: creatorUserId,
      creatorType: isSuperAdmin ? "SUPER_ADMIN" : "AGENCY_ADMIN",
    });

    return mapToSafeUser(user);
  }

  /**
   * Get all users for an agency (with filters)
   */
  static async getAgencyUsers(agencyId: string, filters: IUserFilters, requestingUserId: string): Promise<IAgencyListResponse> {
    // const cache = getCacheService();

    // Verify requesting user has permission
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      include: { agency: true },
    });

    if (!requestingUser) {
      throw AppError.notFound("Requesting User not found", "UserService");
    }

    const { role, isActive, search, pagination, sortOptions } = filters;
    const { currentPage, limit, skip } = pagination;
    const { sortBy } = sortOptions;

    logger.debug("Filters in getAgencyUsers service:", { filters });
    // Check permissions
    const nemaAgencyId = await getNemaAgencyId();

    const isSuperAdmin = requestingUser.agency.type === AgencyType.FEDERAL && requestingUser.agency.jurisdictionLevel === JurisdictionLevel.NATIONAL && requestingUser.role === UserRole.ADMIN && requestingUser.agencyId === nemaAgencyId;

    if (!isSuperAdmin && requestingUser.agencyId !== agencyId) {
      throw AppError.forbidden("You can only view users from your own agency", "UserService");
    }

    // Create cache key
    const cacheKey = `${agencyId}-${role || "all"}-${isActive ?? "all"}-${search || "all"}-${currentPage}-${limit}`;
    logger.debug("Cache key for getAgencyUsers", { cacheKey });

    // Try cache first
    const cached = await this.cache.get<any>(cacheConstants.keys.AGENCY.USERS, cacheKey);
    if (cached) {
      return cached;
    }

    // Build where clause
    const where: any = { agencyId };

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }];
    }

    logger.debug("where clause for getAgencyUsers", { where });

    // Fetch users
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          agencyId: true,
          emailVerified: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          agency: true,
          isTwoFactorEnabled: true,
          twoFactorMethod: true,
        },
        orderBy: sortBy,
      }),
      prisma.user.count({ where }),
    ]);

    logger.debug("Fetched users from DB", { count: users.length, total });
    // Transform users to ISafeUser with computed property
    const usersData: ISafeUser[] = users.map((user) => ({
      ...user,
      // Compute requiresActivation based on isActive
      requiresActivation: !user.isActive,
    }));

    const totalPages = Math.ceil(total / limit);
    const result = {
      data: usersData,
      pagination: {
        total,
        currentPage,
        limit,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
      },
    };

    // Cache result
    await this.cache.set(cacheConstants.keys.AGENCY.USERS, cacheKey, result, cacheConstants.ttl.MEDIUM);

    return result;
  }

  /**
   * Get ALL users across all agencies (Super Admin only)
   */
  static async getAllUsers(filters: IUserFilters, requestingUserId: string): Promise<IAgencyListResponse> {
    // Verify requesting user exists and is a super admin
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      include: { agency: true },
    });

    if (!requestingUser) {
      throw AppError.notFound("Requesting user not found", "UserService");
    }

    const nemaAgencyId = await getNemaAgencyId();

    const isSuperAdmin = requestingUser.agency.type === AgencyType.FEDERAL && requestingUser.agency.jurisdictionLevel === JurisdictionLevel.NATIONAL && requestingUser.role === UserRole.ADMIN && requestingUser.agencyId === nemaAgencyId;

    if (!isSuperAdmin) {
      throw AppError.forbidden("Only super administrators can view all users", "UserService");
    }

    const { role, isActive, search, pagination, sortOptions } = filters;
    const { currentPage, limit, skip } = pagination;
    const { sortBy } = sortOptions;

    // Build where clause (no agencyId filter — global view)
    const where: any = {};

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }];
    }

    const cacheKey = `all-${role || "all"}-${isActive ?? "all"}-${search || "all"}-${currentPage}-${limit}`;
    const cached = await this.cache.get<any>(cacheConstants.keys.AGENCY.USERS, cacheKey);
    if (cached) return cached;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          agencyId: true,
          emailVerified: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          agency: true,
          isTwoFactorEnabled: true,
          twoFactorMethod: true,
        },
        orderBy: sortBy,
      }),
      prisma.user.count({ where }),
    ]);

    const usersData: ISafeUser[] = users.map((user) => ({
      ...user,
      requiresActivation: !user.isActive,
    }));

    const totalPages = Math.ceil(total / limit);
    const result = {
      data: usersData,
      pagination: {
        total,
        currentPage,
        limit,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
      },
    };

    await this.cache.set(cacheConstants.keys.AGENCY.USERS, cacheKey, result, cacheConstants.ttl.MEDIUM);
    console.log("Fetched all users (super admin)", result);
    return result;
  }

  /**
   * Get user by ID
   */

  static async getUserById(userId: string, requestingUserId: string): Promise<ISafeUser> {
    // 1. Fetch the Requesting User first (This is usually full due to Auth Middleware)
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      include: { agency: true },
    });

    if (!requestingUser) {
      throw AppError.unauthorized("Requesting user not found");
    }

    logger.debug("Requesting user details:", {
      id: requestingUser.id,
      agencyName: requestingUser.agency?.name,
    });

    let targetUser: any;

    // If the user is viewing themselves, don't re-query the DB for the same record.
    if (userId === requestingUserId) {
      logger.debug("User is viewing their own profile. Skipping redundant fetch.");
      targetUser = requestingUser;
    } else {
      // Use the PROFILE key for full data
      targetUser = await this.cache.get<any>(cacheConstants.keys.USER.PROFILE, userId);

      if (!targetUser) {
        targetUser = await prisma.user.findUnique({
          where: { id: userId },
          include: { agency: true },
        });

        if (targetUser) {
          await this.cache.set(cacheConstants.keys.USER.PROFILE, userId, targetUser, cacheConstants.ttl.USER_DATA);
        }
      }
    }

    if (!targetUser) {
      throw AppError.notFound("User not found", "UserService");
    }

    // 4. PERMISSION CHECK
    const nemaAgencyId = await getNemaAgencyId();
    const isSuperAdmin = requestingUser.agency.type === AgencyType.FEDERAL && requestingUser.agency.jurisdictionLevel === JurisdictionLevel.NATIONAL && requestingUser.role === UserRole.ADMIN && requestingUser.agencyId === nemaAgencyId;

    if (!isSuperAdmin && requestingUser.agencyId !== targetUser.agencyId && requestingUserId !== userId) {
      throw AppError.forbidden("You can only view users from your own agency", "UserService");
    }

    // logger.debug("Final targetUser agency data before mapping:", targetUser.agency);

    return mapToSafeUser(targetUser);
  }

  /**
   * Update user
   */
  static async updateUser(userId: string, data: IUpdateUserDTO, requestingUserId: string): Promise<ISafeUser> {
    // const cache = getCacheService();

    // Get user to update
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw AppError.notFound("User not found", "UserService");
    }

    // Get requesting user
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      include: { agency: true },
    });

    if (!requestingUser) {
      throw AppError.notFound("Requesting user not found", "UserService");
    }

    // Only ADMIN can update users
    if (requestingUser.role !== "ADMIN") {
      throw AppError.forbidden("Only administrators can update users", "UserService");
    }

    const isSelfUpdate = userId === requestingUserId;

    const nemaAgencyId = await getNemaAgencyId();

    const isSuperAdmin = requestingUser?.agency.type === AgencyType.FEDERAL && requestingUser?.agency.jurisdictionLevel === JurisdictionLevel.NATIONAL && requestingUser?.role === UserRole.ADMIN && requestingUser?.agencyId === nemaAgencyId;

    // Regular admins can only update users in their agency
    if (!isSuperAdmin && requestingUser.agencyId !== targetUser.agencyId) {
      throw AppError.forbidden("You can only update users in your own agency", "UserService");
    }

    // // Prevent admins from changing their own role
    // if (userId === requestingUserId && data.role) {
    //   throw AppError.badRequest("You cannot change your own role", "UserService");
    // }

    // Admins cannot change their own role or active status
    if (isSelfUpdate) {
      if (data.role && data.role !== targetUser.role) {
        throw AppError.forbidden("You cannot change your own role", "UserService");
      }
      if (data.isActive !== undefined && data.isActive !== targetUser.isActive) {
        throw AppError.forbidden("You cannot change your own active status", "UserService");
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(isSelfUpdate
          ? {}
          : {
              ...(data.role && { role: data.role }),
              ...(data.isActive !== undefined && { isActive: data.isActive }),
            }),
      },
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            type: true,
            jurisdictionLevel: true,
          },
        },
      },
    });

    // AUDIT LOG
    await createAuditLog(requestingUserId, ActionType.USER_UPDATED, EntityType.USER, userId, {
      description: ACTION_DESCRIPTIONS[ActionType.USER_UPDATED],
      updatedFields: Object.keys(data),
      before: {
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        role: targetUser.role,
        isActive: targetUser.isActive,
      },
      after: {
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      },
    });

    // Invalidate caches
    await Promise.all([this.cache.delete(cacheConstants.keys.USER.BY_ID, userId), this.cache.delete(cacheConstants.keys.USER.BY_EMAIL, targetUser.email), this.cache.deletePattern(`${cacheConstants.keys.AGENCY.USERS}:${targetUser.agencyId}:*`)]);

    logger.info("User updated successfully", {
      userId: updatedUser.id,
      updatedFields: Object.keys(data),
      updatedBy: requestingUserId,
    });

    return mapToSafeUser(updatedUser);
  }

  /**
   * Deactivate user
   */
  static async deactivateUser(userId: string, requestingUserId: string): Promise<void> {
    // const cache = getCacheService();

    // Prevent self-deactivation
    if (userId === requestingUserId) {
      throw AppError.badRequest("You cannot deactivate your own account. Please contact another administrator.", "UserService");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.notFound("User not found", "UserService");
    }

    // Verify permissions (same as update)
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      include: { agency: true },
    });

    if (requestingUser?.role !== UserRole.ADMIN) {
      throw AppError.forbidden("Only administrators can deactivate users", "UserService");
    }

    const nemaAgencyId = await getNemaAgencyId();

    const isSuperAdmin = requestingUser?.agency.type === AgencyType.FEDERAL && requestingUser?.agency.jurisdictionLevel === JurisdictionLevel.NATIONAL && requestingUser?.role === UserRole.ADMIN && requestingUser?.agencyId === nemaAgencyId;

    if (!isSuperAdmin && requestingUser.agencyId !== user.agencyId) {
      throw AppError.forbidden("You can only deactivate users in your own agency", "UserService");
    }

    // Deactivate user
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false, updatedAt: new Date() },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    // AUDIT LOG
    await createAuditLog(requestingUserId, ActionType.USER_DEACTIVATED, EntityType.USER, userId, {
      description: ACTION_DESCRIPTIONS[ActionType.USER_DEACTIVATED],
      deactivatedUser: {
        email: user.email,
        role: user.role,
        agencyId: user.agencyId,
      },
      tokensRevoked: true,
      deactivatedBy: requestingUserId,
      deactivatedAt: new Date().toISOString(),
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(cacheConstants.keys.USER.BY_ID, userId),
      this.cache.delete(cacheConstants.keys.USER.BY_EMAIL, user.email),
      this.cache.deletePattern(`${cacheConstants.keys.AGENCY.USERS}:${user.agencyId}:*`),
      this.cache.deletePattern(`${cacheConstants.keys.USER.SESSIONS}:${userId}:*`),
    ]);

    logger.info("User deactivated", {
      userId,
      deactivatedBy: requestingUserId,
    });
  }

  /**
   * Reactivate user
   */
  static async reactivateUser(userId: string, requestingUserId: string): Promise<void> {
    // const cache = getCacheService();

    // Prevent self-deactivation
    if (userId === requestingUserId) {
      throw AppError.badRequest("You cannot reactivate your own account. Please contact another administrator.", "UserService");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.notFound("User not found", "UserService");
    }

    if (user.isActive) {
      throw AppError.badRequest("User is already active", "UserService");
    }

    // Verify permissions
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      include: { agency: true },
    });

    if (requestingUser?.role !== "ADMIN") {
      throw AppError.forbidden("Only administrators can reactivate users", "UserService");
    }

    const nemaAgencyId = await getNemaAgencyId();

    const isSuperAdmin = requestingUser?.agency.type === AgencyType.FEDERAL && requestingUser?.agency.jurisdictionLevel === JurisdictionLevel.NATIONAL && requestingUser?.role === UserRole.ADMIN && requestingUser?.agencyId === nemaAgencyId;

    if (!isSuperAdmin && requestingUser.agencyId !== user.agencyId) {
      throw AppError.forbidden("You can only reactivate users in your own agency", "UserService");
    }

    // Reactivate user
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true, updatedAt: new Date() },
    });

    // AUDIT LOG
    await createAuditLog(requestingUserId, ActionType.USER_ACTIVATED, EntityType.USER, userId, {
      description: ACTION_DESCRIPTIONS[ActionType.USER_ACTIVATED],
      reactivatedBy: requestingUserId,
      reactivatedAt: new Date().toISOString(),
      activatedUser: {
        email: user.email,
        role: user.role,
        agencyId: user.agencyId,
      },
    });
    // Invalidate caches
    await Promise.all([this.cache.delete(cacheConstants.keys.USER.BY_ID, userId), this.cache.delete(cacheConstants.keys.USER.BY_EMAIL, user.email), this.cache.deletePattern(`${cacheConstants.keys.AGENCY.USERS}:${user.agencyId}:*`)]);

    logger.info("User reactivated", {
      userId,
      reactivatedBy: requestingUserId,
    });
  }

  /**
   * Reset user password (by admin)
   */
  static async resetUserPassword(userId: string, requestingUserId: string): Promise<void> {
    // const cache = getCacheService();

    // Prevent self-deactivation
    if (userId === requestingUserId) {
      throw AppError.badRequest("You cannot reset your own password. Please contact another administrator or use the Security Settings page to change your own password.", "UserService");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { agency: true },
    });

    if (!user) {
      throw AppError.notFound("User not found", "UserService");
    }

    // Verify permissions
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      include: { agency: true },
    });

    if (requestingUser?.role !== "ADMIN") {
      throw AppError.forbidden("Only administrators can reset passwords", "UserService");
    }

    const nemaAgencyId = await getNemaAgencyId();

    const isSuperAdmin = requestingUser?.agency.type === AgencyType.FEDERAL && requestingUser?.agency.jurisdictionLevel === JurisdictionLevel.NATIONAL && requestingUser?.role === UserRole.ADMIN && requestingUser?.agencyId === nemaAgencyId;

    if (!isSuperAdmin && requestingUser.agencyId !== user.agencyId) {
      throw AppError.forbidden("You can only reset passwords for users in your own agency", "UserService");
    }

    // Generate new temporary password
    // const temporaryPassword = JWTService.generateRandomPassword();
    // const hashedPassword = await JWTService.hashPasswordArgon2(
    //   temporaryPassword
    // );

    const dummyHash = await JWTService.hashPasswordArgon2(JWTService.generateSystemSecret());

    // Update password and force change
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: dummyHash,
          mustChangePassword: true,
        },
      });

      // Revoke all existing refresh tokens
      await tx.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
    });

    // 2. Generate Secure Reset Token
    const resetToken = JWTService.generateSystemSecret();
    const hashedToken = await JWTService.hashPasswordArgon2(resetToken);
    const expirySeconds = cacheConstants.ttl.LONG; // 1 hour

    // 3. Store Token in Redis
    // Key format: auth:reset_token:{userId}
    await this.cache.set(
      cacheConstants.keys.AUTH.PASSWORD_RESET_TOKEN,
      userId,
      {
        hashedToken,
        email: user.email,
        createdAt: Date.now(),
        expiresAt: Date.now() + expirySeconds * 1000,
      },
      expirySeconds,
    );

    // 4. Construct Reset URL
    const resetUrl = `${serverConfig.cors.frontendDomain}/reset-password?token=${resetToken}&userId=${userId}`;

    // Send password reset email
    this.sendPasswordResetEmail(user, resetUrl, requestingUser).catch((error) => {
      logger.error("Failed to send password reset email", {
        userId: user.id,
        error: error.message,
      });
    });

    // AUDIT LOG
    await createAuditLog(requestingUserId, ActionType.PASSWORD_RESET, EntityType.USER, userId, {
      description: ACTION_DESCRIPTIONS[ActionType.PASSWORD_RESET],
      resetBy: requestingUserId,
      targetUser: user.email,
      tokensRevoked: true,
      mustChangePassword: true,
    });
    // Invalidate caches
    await Promise.all([this.cache.delete(cacheConstants.keys.USER.BY_ID, userId), this.cache.delete(cacheConstants.keys.USER.BY_EMAIL, user.email), this.cache.deletePattern(`${cacheConstants.keys.USER.SESSIONS}:${userId}:*`)]);

    logger.info("User password reset initiated by admin", {
      userId,
      resetBy: requestingUserId,
      resetUrl: serverConfig.app.isDev ? resetUrl : undefined,
      method: "Email link",
    });

    // return temporaryPassword;
  }

  /**
   * Send welcome email to new user
   */
  private static async sendUserWelcomeEmail(user: any, agency: any, temporaryPassword: string, creator: any): Promise<void> {
    try {
      // Prepare template data
      const templateData: IUserWelcomeData = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        agencyName: agency.name,
        role: user.role,
        temporaryPassword: temporaryPassword,
        appName: this.APP_NAME!,
        loginUrl: `https://${this.APP_NAME_LOWER}.gov.ng/dashboard`,
        creatorName: `${creator.firstName} ${creator.lastName}`,
      };

      const { subject, html } = EmailTemplateService.generateHtml(EmailType.USER_WELCOME, templateData);

      await RabbitMQService.addEmailJob({
        to: user.email,
        subject,
        html,
      });

      logger.info("User welcome email queued successfully", {
        userId: user.id,
        email: EmailService.maskEmail(user.email),
        agencyName: agency.name,
      });
    } catch (error) {
      logger.error("Failed to queue user welcome email", {
        userId: user.id,
        email: user.email,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  private static async sendPasswordResetEmail(user: any, resetUrl: string, resetBy: any): Promise<void> {
    try {
      // Prepare template data
      const templateData: IPasswordResetData = {
        firstName: user.firstName,
        appName: this.APP_NAME!,
        resetUrl,
        requestorIp: resetBy.ipAddress,
      };

      const { subject, html } = EmailTemplateService.generateHtml(EmailType.PASSWORD_RESET, templateData);

      await RabbitMQService.addEmailJob({
        to: user.email,
        subject,
        html,
      });

      logger.info("Password reset email queued successfully", {
        userId: user.id,
        email: EmailService.maskEmail(user.email),
        resetBy: resetBy.id,
      });
    } catch (error) {
      logger.error("Failed to queue password reset email", {
        userId: user.id,
        email: user.email,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
