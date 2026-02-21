import { cacheConstants } from "../config/cache.constants.js";
import { serverConfig } from "../config/server.config.js";
import { mapToAgencyData } from "../helpers/service.helpers.js";
import { prisma } from "../lib/prisma.js";
import { ActionType, AgencyStatus, EntityType, JurisdictionLevel, UserRole } from "../prisma/prisma/generated/enums.js";
import { RabbitMQService } from "../rabbitmq/rabbitmq.queue.js";
import { ACTION_DESCRIPTIONS } from "../types/actions.types.js";
import { AccountType, type IActivationEmailData } from "../types/activation.types.js";
import type { IAgency, IAgencyFilters, IAgencyWithAdmin, ICreateAgencyDTO, IUpdateAgencyDTO } from "../types/agency.types.js";
import type { IPaginatedApiResponse, IPaginationMeta } from "../types/api.response.js";
import type { IPagination } from "../types/common.types.js";
import { EmailType, type IAgencyWelcomeData } from "../types/email.types.js";
import type { IUser } from "../types/user.types.js";
import { createAuditLog } from "../utils/auditLog.util.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { ActivationService } from "./activation.service.js";
import { getCacheService } from "./cache.service.js";
import { EmailService } from "./email/email.service.js";
import { EmailTemplateService } from "./email/email.templates.service.js";
import { JWTService } from "./jwt.service.js";

export class AgencyService {
  private static APP_NAME = serverConfig.app.name.split("_")[0];
  private static APP_NAME_LOWER = this.APP_NAME?.toLowerCase();

  static async createAgency(data: ICreateAgencyDTO): Promise<IAgencyWithAdmin> {
    const cache = getCacheService();

    // Check if agency name already exists (check cache first)
    const cachedAgency = await cache.get<IAgency>(cacheConstants.keys.AGENCY.BY_NAME, data.name);

    if (cachedAgency) {
      throw AppError.conflict(`Agency with name "${data.name}" already exists`, "AgencyService");
    }

    const existingAgency = await prisma.agency.findUnique({
      where: { name: data.name },
    });

    if (existingAgency) {
      throw AppError.conflict(`Agency with name "${data.name}" already exists`, "AgencyService");
    }

    // Check if admin email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.adminEmail },
    });

    if (existingUser) {
      throw AppError.conflict(`User with email "${data.adminEmail}" already exists`, "AgencyService");
    }

    // Validate jurisdiction level matches agency type
    this.validateJurisdictionLevel(data.type, data.jurisdictionLevel);

    const createdBy = await prisma.user.findUnique({
      where: { id: data.createdById },
    });

    if (!createdBy) {
      throw AppError.notFound("User who created the agency not found", "AgencyService");
    }

    // Generate temporary password for admin
    const temporaryPassword = JWTService.generateSystemSecret();
    const hashedPassword = await JWTService.hashPasswordArgon2(temporaryPassword);

    // Create agency and admin user in a transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        const agency = await tx.agency.create({
          data: {
            name: data.name,
            type: data.type,
            jurisdiction: data.jurisdiction,
            jurisdictionLevel: data.jurisdictionLevel,
            contactEmail: data.contactEmail,
            contactPhone: data.contactPhone,
            status: AgencyStatus.ACTIVE,
            createdById: createdBy.id,
          },
        });

        const adminUser = await tx.user.create({
          data: {
            email: data.adminEmail,
            passwordHash: hashedPassword,
            firstName: data.adminFirstName,
            lastName: data.adminLastName,
            role: UserRole.ADMIN,
            agencyId: agency.id,
            isActive: false,
            mustChangePassword: false,
            emailVerified: false,
          },
        });

        // AUDIT LOG: Agency creation
        await createAuditLog(
          null, // System-level action
          ActionType.AGENCY_CREATED,
          EntityType.AGENCY,
          agency.id,
          {
            description: ACTION_DESCRIPTIONS[ActionType.AGENCY_CREATED],
            agencyName: agency.name,
            agencyType: agency.type,
            jurisdictionLevel: agency.jurisdictionLevel,
            adminEmail: data.adminEmail,
          }
        );

        // AUDIT LOG: Admin user creation
        await createAuditLog(null, ActionType.USER_CREATED, EntityType.USER, adminUser.id, {
          description: ACTION_DESCRIPTIONS[ActionType.USER_CREATED],
          email: adminUser.email,
          role: adminUser.role,
          agencyId: agency.id,
          isInitialAdmin: true,
        });

        return { agency, adminUser };
      });

      // Cache the new agency
      await Promise.all([
        cache.set(cacheConstants.keys.AGENCY.BY_ID, result.agency.id, result.agency, cacheConstants.ttl.AGENCY_DATA),
        cache.set(cacheConstants.keys.AGENCY.BY_NAME, result.agency.name, result.agency, cacheConstants.ttl.AGENCY_DATA),
        // Invalidate agency list cache
        cache.deletePattern(`${cacheConstants.keys.AGENCY.LIST}:*`),
        // Invalidate stats cache
        cache.delete(cacheConstants.keys.AGENCY.STATS, "all"),
      ]);

      // Send welcome email (async, non-blocking)
      // this.sendWelcomeEmail(
      //   { ...result.adminUser, agency: result.agency },
      //   result.agency,
      //   result.temporaryPassword
      // ).catch((error) => {
      //   logger.error("Failed to send welcome email", {
      //     userId: result.adminUser.id,
      //     agencyId: result.agency.id,
      //     error: error.message,
      //   });
      // });

      //  CHANGED: Send activation email
      const emailData: IActivationEmailData = {
        userId: result.adminUser.id,
        email: result.adminUser.email,
        firstName: result.adminUser.firstName,
        accountType: result.adminUser.role === UserRole.ADMIN ? AccountType.AGENCY_ADMIN : AccountType.USER,
        metadata: {
          agencyName: result.agency.name,
          role: result.adminUser.role,
          creatorName: `${createdBy.firstName} ${createdBy.lastName}`,
          agencyType: result.agency.type,
          jurisdiction: result.agency.jurisdiction,
        },
      };
      await ActivationService.sendActivationEmail(emailData).catch((error) => {
        logger.error("Failed to send activation email", {
          userId: result.adminUser.id,
          error: error.message,
        });
      });

      logger.info("Agency created successfully", {
        agencyId: result.agency.id,
        agencyName: result.agency.name,
        adminUserId: result.adminUser.id,
      });

      return {
        id: result.agency.id,
        name: result.agency.name,
        type: result.agency.type,
        jurisdiction: result.agency.jurisdiction,
        jurisdictionLevel: result.agency.jurisdictionLevel,
        contactEmail: result.agency.contactEmail,
        contactPhone: result.agency.contactPhone,
        status: result.agency.status,
        createdAt: result.agency.createdAt,
        updatedAt: result.agency.updatedAt,
        admin: {
          id: result.adminUser.id,
          firstName: result.adminUser.firstName,
          lastName: result.adminUser.lastName,
          email: result.adminUser.email,
          mustChangePassword: result.adminUser.mustChangePassword,
          requiresActivation: true,
        },
        _count: {
          users: 1,
          alerts: 0,
        },
      };
    } catch (error) {
      throw AppError.internal("Agency creation transaction failed", error, "AgencyService", {
        agencyName: data.name,
        adminEmail: data.adminEmail,
        type: data.type,
      });
    }
  }

  static async getAllAgencies(filters: IAgencyFilters): Promise<{ data: IAgencyWithAdmin[]; pagination: IPaginationMeta }> {
    const cache = getCacheService();
    const { type, jurisdictionLevel, status, search, pagination, sortOptions } = filters;
    const { currentPage, limit, skip } = pagination;
    const { sortBy } = sortOptions;

    // Create cache key from filters
    const cacheKey = `list-${JSON.stringify(filters)}`; // Simplified key generation

    // Try to get from cache
    const cached = await cache.get<any>(cacheConstants.keys.AGENCY.LIST, cacheKey);
    if (cached) {
      logger.debug("Agency list retrieved from cache", { cacheKey });
      return cached;
    }

    // const skip = (currentPage - 1) * limit;

    // Build where clause
    const where: any = {};
    if (type) where.type = type;
    if (jurisdictionLevel) where.jurisdictionLevel = jurisdictionLevel;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { jurisdiction: { contains: search, mode: "insensitive" } },
        { contactEmail: { contains: search, mode: "insensitive" } },
        { contactPhone: { contains: search, mode: "insensitive" } },
      ];
    }

    // Execute queries in parallel
    const [agencies, total] = await Promise.all([
      prisma.agency.findMany({
        where,
        skip,
        take: limit,
        orderBy: sortBy,
        include: {
          users: {
            where: { role: UserRole.ADMIN },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,
            },
            take: 1,
          },
          _count: {
            select: {
              users: true,
              alerts: true,
            },
          },
        },
      }),
      prisma.agency.count({ where }),
    ]);

    // const result = {
    //   data: agencies.map((agency) => ({
    //     ...agency,
    //     admin: agency.users[0] || null,
    //     users: undefined,
    //   })),
    //   pagination: {
    //     total,
    //     currentPage,
    //     limit,
    //     totalPages: Math.ceil(total / limit),
    //   },
    // };

    //MAP TO STRICT TYPE
    const mappedData = agencies.map(mapToAgencyData);
    const totalPages = Math.ceil(total / limit);
    // Cache the result
    const result = {
      data: mappedData,
      pagination: {
        total,
        currentPage,
        limit,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
      },
    };
    await cache.set(cacheConstants.keys.AGENCY.LIST, cacheKey, result, cacheConstants.ttl.MEDIUM);

    return result;
  }

  static async getAgencyById(agencyId: string): Promise<IAgencyWithAdmin> {
    const cache = getCacheService();

    return cache.getOrSet(
      cacheConstants.keys.AGENCY.BY_ID,
      agencyId,
      async () => {
        const agency = await prisma.agency.findUnique({
          where: { id: agencyId },
          include: {
            users: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
                emailVerified: true,
              },
              orderBy: { createdAt: "desc" },
              take: 1, // Only need one admin
            },
            _count: {
              select: {
                users: true,
                alerts: true,
              },
            },
          },
        });

        if (!agency) {
          throw AppError.notFound(`Agency with ID ${agencyId} not found`, "AgencyService");
        }

        return agency;
      },
      cacheConstants.ttl.AGENCY_DATA
    );
  }

  static async updateAgency(agencyId: string, data: IUpdateAgencyDTO, requestingUserId: string): Promise<IAgencyWithAdmin> {
    const cache = getCacheService();

    // Check if agency exists
    const existingAgency = await prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!existingAgency) {
      throw AppError.notFound(`Agency with ID ${agencyId} not found`, "AgencyService");
    }

    // Check if new name conflicts with existing agency
    if (data.name && data.name !== existingAgency.name) {
      const nameConflict = await prisma.agency.findUnique({
        where: { name: data.name },
      });

      if (nameConflict) {
        throw AppError.conflict(`Agency with name "${data.name}" already exists`, "AgencyService");
      }
    }

    // Update agency
    const updatedAgency = await prisma.agency.update({
      where: { id: agencyId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.jurisdiction && { jurisdiction: data.jurisdiction }),
        ...(data.contactEmail && { contactEmail: data.contactEmail }),
        ...(data.contactPhone && { contactPhone: data.contactPhone }),
        ...(data.status && { status: data.status }),
      },
      include: {
        users: {
          where: { role: UserRole.ADMIN },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            mustChangePassword: true,
            isActive: true,
          },
          take: 1,
        },
        _count: {
          select: {
            users: true,
            alerts: true,
          },
        },
      },
    });

    // AUDIT LOG
    await createAuditLog(requestingUserId || null, ActionType.AGENCY_UPDATED, EntityType.AGENCY, agencyId, {
      description: ACTION_DESCRIPTIONS[ActionType.AGENCY_UPDATED],
      updatedFields: Object.keys(data),
      before: {
        name: existingAgency.name,
        status: existingAgency.status,
      },
      after: {
        name: updatedAgency.name,
        status: updatedAgency.status,
      },
    });

    // Invalidate related caches
    await Promise.all(
      [
        cache.delete(cacheConstants.keys.AGENCY.BY_ID, agencyId),
        cache.delete(cacheConstants.keys.AGENCY.BY_NAME, existingAgency.name),
        data.name && cache.delete(cacheConstants.keys.AGENCY.BY_NAME, data.name),
        cache.deletePattern(`${cacheConstants.keys.AGENCY.LIST}:*`),
        cache.deletePattern(`${cacheConstants.keys.AGENCY.USERS}:${agencyId}:*`),
        cache.delete(cacheConstants.keys.AGENCY.STATS, "all"),
      ].filter(Boolean)
    );

    logger.info("Agency updated successfully", {
      agencyId: updatedAgency.id,
      updatedFields: Object.keys(data),
    });

    return updatedAgency;
  }

  static async deleteAgency(agencyId: string, requestingUserId: string): Promise<IAgencyWithAdmin> {
    const cache = getCacheService();

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      include: {
        _count: {
          select: {
            alerts: true,
            users: true,
          },
        },
      },
    });

    if (!agency) {
      throw AppError.notFound(`Agency with ID ${agencyId} not found`, "AgencyService");
    }

    if (agency._count.alerts > 0) {
      throw AppError.badRequest(`Cannot delete agency with ${agency._count.alerts} alerts.`, "AgencyService");
    }

    const deletedAgency = await prisma.agency.update({
      where: { id: agencyId },
      data: {
        status: AgencyStatus.INACTIVE,
        users: {
          updateMany: {
            where: {},
            data: { isActive: false },
          },
        },
      },
      include: {
        users: {
          where: { role: UserRole.ADMIN },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            mustChangePassword: true,
            isActive: true,
          },
          take: 1,
        },
        _count: {
          select: {
            users: true,
            alerts: true,
          },
        },
      },
    });

    // AUDIT LOG
    await createAuditLog(requestingUserId || null, ActionType.AGENCY_DELETED, EntityType.AGENCY, agencyId, {
      description: ACTION_DESCRIPTIONS[ActionType.AGENCY_DELETED],
      agencyName: agency.name,
      usersDeactivated: agency._count.users,
      reason: "Soft delete",
    });

    // Invalidate all agency caches
    await Promise.all([
      cache.delete(cacheConstants.keys.AGENCY.BY_ID, agencyId),
      cache.delete(cacheConstants.keys.AGENCY.BY_NAME, agency.name),
      cache.deletePattern(`${cacheConstants.keys.AGENCY.LIST}:*`),
      cache.deletePattern(`${cacheConstants.keys.AGENCY.USERS}:${agencyId}:*`),
      cache.delete(cacheConstants.keys.AGENCY.STATS, "all"),
    ]);

    logger.warn("Agency deleted (soft delete)", {
      agencyId: deletedAgency.id,
      agencyName: deletedAgency.name,
      usersDeactivated: agency._count.users,
    });

    return deletedAgency;
  }

  static async reactivateAgency(agencyId: string) {
    const cache = getCacheService();

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency) {
      throw AppError.notFound(`Agency with ID ${agencyId} not found`, "AgencyService");
    }

    if (agency.status === AgencyStatus.ACTIVE) {
      throw AppError.badRequest("Agency is already active", "AgencyService");
    }

    const reactivatedAgency = await prisma.agency.update({
      where: { id: agencyId },
      data: { status: AgencyStatus.ACTIVE },
    });

    // Invalidate caches
    await Promise.all([
      cache.delete(cacheConstants.keys.AGENCY.BY_ID, agencyId),
      cache.delete(cacheConstants.keys.AGENCY.BY_NAME, agency.name),
      cache.deletePattern(`${cacheConstants.keys.AGENCY.LIST}:*`),
      cache.delete(cacheConstants.keys.AGENCY.STATS, "all"),
    ]);

    logger.info("Agency reactivated", {
      agencyId: reactivatedAgency.id,
      agencyName: reactivatedAgency.name,
    });

    return reactivatedAgency;
  }

  static async getAgencyStats() {
    const cache = getCacheService();

    return cache.getOrSet(
      cacheConstants.keys.AGENCY.STATS,
      "all",
      async () => {
        const [totalAgencies, activeAgencies, suspendedAgencies, agenciesByType, agenciesByJurisdiction] = await Promise.all([
          prisma.agency.count(),
          prisma.agency.count({ where: { status: AgencyStatus.ACTIVE } }),
          prisma.agency.count({ where: { status: AgencyStatus.SUSPENDED } }),
          prisma.agency.groupBy({
            by: ["type"],
            _count: true,
          }),
          prisma.agency.groupBy({
            by: ["jurisdictionLevel"],
            _count: true,
          }),
        ]);

        return {
          total: totalAgencies,
          active: activeAgencies,
          suspended: suspendedAgencies,
          inactive: totalAgencies - activeAgencies - suspendedAgencies,
          byType: agenciesByType.reduce((acc, item) => {
            acc[item.type] = item._count;
            return acc;
          }, {} as Record<string, number>),
          byJurisdiction: agenciesByJurisdiction.reduce((acc, item) => {
            acc[item.jurisdictionLevel] = item._count;
            return acc;
          }, {} as Record<string, number>),
        };
      },
      cacheConstants.ttl.AGENCY_STATS
    );
  }

  private static validateJurisdictionLevel(type: string, jurisdictionLevel: JurisdictionLevel): void {
    const validCombinations: Record<string, string[]> = {
      FEDERAL: ["NATIONAL"],
      STATE: ["STATE"],
      LOCAL: ["LGA", "WARD"],
      SECURITY: ["NATIONAL", "STATE", "LGA", "WARD"],
      HEALTH: ["NATIONAL", "STATE", "LGA", "WARD"],
      EMERGENCY: ["NATIONAL", "STATE", "LGA", "WARD"],
    };

    if (!validCombinations[type]?.includes(jurisdictionLevel)) {
      throw AppError.badRequest(`Invalid combination: ${type} agency cannot have ${jurisdictionLevel} jurisdiction`, "AgencyService");
    }
  }

  // private static async sendWelcomeEmail(
  //   user: IUser,
  //   agency: IAgency,
  //   temporaryPassword: string
  // ): Promise<void> {
  //   try {
  //     // Prepare template data
  //     const templateData: IAgencyWelcomeData = {
  //       adminName: `${user.firstName} ${user.lastName}`,
  //       agencyName: agency.name,
  //       agencyType: agency.type,
  //       jurisdiction: agency.jurisdiction,
  //       jurisdictionLevel: agency.jurisdictionLevel,
  //       email: agency.contactEmail,
  //       temporaryPassword: temporaryPassword,
  //       appName: this.APP_NAME!,
  //       loginUrl: `https://${this.APP_NAME_LOWER}.gov.ng/login`,
  //     };

  //     const { subject, html } = EmailTemplateService.generateHtml(
  //       EmailType.AGENCY_WELCOME,
  //       templateData
  //     );

  //     await RabbitMQService.addEmailJob({
  //       to: user.email,
  //       subject,
  //       html,
  //     });

  //     logger.info("Agency welcome email queued successfully", {
  //       userId: user.id,
  //       email: EmailService.maskEmail(user.email),
  //       agencyId: agency.id,
  //       agencyName: agency.name,
  //     });
  //   } catch (error) {
  //     logger.error("Failed to queue agency welcome email", {
  //       userId: user.id,
  //       email: user.email,
  //       agencyId: agency.id,
  //       error: error instanceof Error ? error.message : "Unknown error",
  //     });
  //     throw error;
  //   }
  // }
}
