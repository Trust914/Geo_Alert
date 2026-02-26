import { cacheConstants } from "../config/cache.constants.js";
import { mapToAgencyData, mapToCitizenData } from "../helpers/service.helpers.js";
import { prisma } from "../lib/prisma.js";
import { ActionType, EntityType, Language } from "../prisma/prisma/generated/enums.js";
import { ACTION_DESCRIPTIONS } from "../types/actions.types.js";
import type { IPaginationMeta } from "../types/api.response.js";
import type { CitizenFilters, ICitizenData, ICitizenNearbyData, ICitizenStats, RegisterCitizenDTO, UpdateCitizenDTO } from "../types/citizen.types.js";
import { createAuditLog } from "../utils/auditLog.util.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { getCacheService } from "./cache.service.js";
import { GeoTargetingService } from "./geoTargeting.service.js";
import { SMSService } from "./sms.service.js";

export class CitizenService {
  private static get cache() {
    return getCacheService();
  }

  /**
   * Register a new citizen
   */
  static async registerCitizen(data: RegisterCitizenDTO): Promise<ICitizenData> {
    // 1. Validate Phone Number
    if (!SMSService.validatePhoneNumber(data.phoneNumber)) {
      throw AppError.badRequest("Invalid phone number format", "CitizenService");
    }

    const normalizedPhone = SMSService.normalizePhoneNumber(data.phoneNumber);

    const existing = await prisma.citizen.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (existing) {
      throw AppError.conflict("Phone number already registered", "CitizenService");
    }

    // 2. Validate Address Existence
    const state = await prisma.state.findUnique({
      where: { id: data.stateId },
    });
    if (!state) throw AppError.notFound("State not found", "CitizenService");

    const lga = await prisma.lGA.findFirst({
      where: { id: data.lgaId, stateId: data.stateId },
    });
    if (!lga) throw AppError.notFound("LGA not found or invalid", "CitizenService");

    if (data.wardId) {
      const ward = await prisma.ward.findFirst({
        where: { id: data.wardId, lgaId: data.lgaId },
      });
      if (!ward) throw AppError.notFound("Ward not found or invalid", "CitizenService");
    }

    // 3. Determine Location (GPS vs Calculated)
    let finalLocation = data.location;

    if (!finalLocation) {
      const derived = await GeoTargetingService.deriveLocationFromAddress(data.stateId, data.lgaId, data.wardId);
      if (derived) {
        finalLocation = derived;
        logger.debug("Derived citizen location from address", {
          phone: normalizedPhone,
          source: data.wardId ? "WARD" : "LGA",
        });
      }
    }

    // Create WKT string (SRID=4326 is required for ST_GeomFromEWKT)
    const locationWKT = finalLocation ? `SRID=4326;POINT(${finalLocation.longitude} ${finalLocation.latitude})` : null;

    try {
      // 4. Create Citizen + Update Location (Wrapped in Transaction)
      const citizen = await prisma.$transaction(async (tx) => {
        // Step A: Create the record WITHOUT the location field
        const created = await tx.citizen.create({
          data: {
            phoneNumber: normalizedPhone,
            firstName: data.firstName,
            lastName: data.lastName,
            stateId: data.stateId,
            lgaId: data.lgaId,
            wardId: data.wardId || null,
            preferredLanguage: data.preferredLanguage || Language.ENGLISH,
            isOptedIn: true,
            // REMOVE 'location' from here entirely
          },
          include: {
            state: { select: { id: true, name: true } },
            lga: { select: { id: true, name: true } },
            ward: { select: { id: true, name: true } },
          },
        });

        // Step B: Update the location using Raw SQL if we have coordinates
        // We use ST_GeomFromEWKT because your string includes "SRID=4326;"
        if (locationWKT) {
          await tx.$executeRaw`
            UPDATE citizens
            SET location = ST_GeomFromEWKT(${locationWKT})
            WHERE id = ${created.id}
          `;
        }

        return created;
      });

      // 5. Post-Registration Tasks (Async)
      createAuditLog(null, ActionType.CITIZEN_REGISTERED, EntityType.CITIZEN, citizen.id, {
        description: ACTION_DESCRIPTIONS[ActionType.CITIZEN_REGISTERED],
        phoneMasked: normalizedPhone,
        registrationMethod: data.location ? "GPS" : finalLocation ? "DERIVED" : "ADDRESS_ONLY",
        location: `${citizen.state?.name}, ${citizen.lga?.name}`,
      }).catch((err) => logger.error("Audit log failed", { error: err }));

      SMSService.sendWelcomeSMS(normalizedPhone, data.firstName).catch((err) => logger.error("Welcome SMS failed", { error: err }));

      // Invalidate Caches
      await Promise.all([this.cache.deletePattern(`${cacheConstants.keys.CITIZEN.LIST}:*`), this.cache.delete(cacheConstants.keys.CITIZEN.STATS, "global")]);

      return mapToCitizenData(citizen);
    } catch (error: any) {
      if (error.code === "P2002") {
        throw AppError.conflict("Phone number already registered", "CitizenService");
      }
      throw error;
    }
  }

  /**
   * Get citizen by phone number
   */
  static async getCitizenByPhone(phoneNumber: string): Promise<ICitizenData> {
    const normalizedPhone = SMSService.normalizePhoneNumber(phoneNumber);

    //READ CACHE
    return this.cache.getOrSet(
      cacheConstants.keys.CITIZEN.BY_PHONE,
      normalizedPhone,
      async () => {
        const citizen = await prisma.citizen.findUnique({
          where: { phoneNumber: normalizedPhone },
          include: {
            state: { select: { id: true, name: true } },
            lga: { select: { id: true, name: true } },
            ward: { select: { id: true, name: true } },
          },
        });

        if (!citizen) {
          throw AppError.notFound("Citizen not found", "CitizenService");
        }

        // Also cache by ID to save future lookups
        await this.cache.set(cacheConstants.keys.CITIZEN.BY_ID, citizen.id, citizen, cacheConstants.ttl.LONG);

        return mapToCitizenData(citizen);
      },
      cacheConstants.ttl.LONG,
    );
  }

  /**
   * Get citizen by ID
   */
  static async getCitizenById(id: string): Promise<ICitizenData> {
    //READ CACHE
    return this.cache.getOrSet(
      cacheConstants.keys.CITIZEN.BY_ID,
      id,
      async () => {
        const citizen = await prisma.citizen.findUnique({
          where: { id },
          include: {
            state: { select: { id: true, name: true } },
            lga: { select: { id: true, name: true } },
            ward: { select: { id: true, name: true } },
          },
        });

        if (!citizen) {
          throw AppError.notFound("Citizen not found", "CitizenService");
        }

        return mapToCitizenData(citizen);
      },
      cacheConstants.ttl.LONG,
    );
  }

  /**
   * Update citizen information
   */
  static async updateCitizen(phoneNumber: string, data: UpdateCitizenDTO): Promise<ICitizenData> {
    const normalizedPhone = SMSService.normalizePhoneNumber(phoneNumber);

    const citizen = await prisma.citizen.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (!citizen) {
      throw AppError.notFound("Citizen not found", "CitizenService");
    }

    // 1. Validate FKs only if they are being updated
    if (data.stateId) {
      const state = await prisma.state.findUnique({
        where: { id: data.stateId },
      });
      if (!state) throw AppError.notFound("State not found", "CitizenService");
    }

    if (data.lgaId) {
      const lga = await prisma.lGA.findFirst({
        where: {
          id: data.lgaId,
          stateId: data.stateId || citizen.stateId, // Use new or existing
        },
      });
      if (!lga) throw AppError.notFound("LGA not found", "CitizenService");
    }

    if (data.wardId) {
      const ward = await prisma.ward.findFirst({
        where: {
          id: data.wardId,
          lgaId: data.lgaId || citizen.lgaId, // Use new or existing
        },
      });
      if (!ward) throw AppError.notFound("Ward not found", "CitizenService");
    }

    // 2. Efficiently Determine New Location
    let locationWKT: string | null = null;

    // Check if any address-related field is being modified
    // (Check against undefined because wardId can be explicitly null)
    const isAddressChanged = data.stateId || data.lgaId || data.wardId !== undefined;
    const isLocationExplicitlyProvided = !!data.location;

    if (isLocationExplicitlyProvided) {
      // Priority A: Explicit GPS provided (User overrides address)
      const { longitude, latitude } = data.location!;
      locationWKT = `SRID=4326;POINT(${longitude} ${latitude})`;
    } else if (isAddressChanged) {
      // Priority B: Address changed but no GPS -> Recalculate Centroid
      // We must merge new Data with Existing Data to get the full context
      const effectiveStateId = data.stateId ?? citizen.stateId;
      const effectiveLgaId = data.lgaId ?? citizen.lgaId;
      // If wardId is undefined, use existing. If null (removed), use null.
      const effectiveWardId = data.wardId !== undefined ? data.wardId : citizen.wardId;

      const derived = await GeoTargetingService.deriveLocationFromAddress(effectiveStateId, effectiveLgaId, effectiveWardId);

      if (derived) {
        locationWKT = `SRID=4326;POINT(${derived.longitude} ${derived.latitude})`;
      } else {
        logger.debug("Failed to derive location from address");
      }
    }

    // 3. Perform Update
    const updatedCitizen = await prisma.$transaction(async (tx) => {
      const updated = await tx.citizen.update({
        where: { id: citizen.id },
        data: {
          ...(data.firstName && { firstName: data.firstName }),
          ...(data.lastName && { lastName: data.lastName }),
          ...(data.stateId && { stateId: data.stateId }),
          ...(data.lgaId && { lgaId: data.lgaId }),
          ...(data.wardId !== undefined && { wardId: data.wardId }), // Handles null updates
          ...(data.preferredLanguage && {
            preferredLanguage: data.preferredLanguage,
          }),
          ...(data.isOptedIn !== undefined && { isOptedIn: data.isOptedIn }),
        },
        include: {
          state: { select: { id: true, name: true } },
          lga: { select: { id: true, name: true } },
          ward: { select: { id: true, name: true } },
        },
      });

      // Only run the spatial update if location actually changed
      if (locationWKT) {
        await tx.$executeRaw`
            UPDATE citizens
            SET location = ST_GeomFromEWKT(${locationWKT})
            WHERE id = ${updated.id}
          `;
      }

      return updated;
    });

    // 4. Audit & Cache
    await createAuditLog(null, ActionType.CITIZEN_UPDATED, EntityType.CITIZEN, citizen.id, {
      description: ACTION_DESCRIPTIONS[ActionType.CITIZEN_UPDATED],
      phoneNumber: normalizedPhone,
      updatedFields: Object.keys(data),
    });

    await Promise.all([this.cache.delete(cacheConstants.keys.CITIZEN.BY_ID, citizen.id), this.cache.delete(cacheConstants.keys.CITIZEN.BY_PHONE, normalizedPhone), this.cache.deletePattern(`${cacheConstants.keys.CITIZEN.LIST}:*`), this.cache.delete(cacheConstants.keys.CITIZEN.STATS, "global")]);

    logger.info("Citizen updated", {
      citizenId: citizen.id,
      updatedFields: Object.keys(data),
      locationUpdated: !!locationWKT,
    });

    return mapToCitizenData(updatedCitizen);
  }

  /**
   * Opt-in/out citizen
   */
  static async toggleOptIn(phoneNumber: string, optIn: boolean): Promise<void> {
    // const cache = getCacheService();
    const normalizedPhone = SMSService.normalizePhoneNumber(phoneNumber);

    const citizen = await prisma.citizen.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (!citizen) {
      throw AppError.notFound("Citizen not found", "CitizenService");
    }

    await prisma.citizen.update({
      where: { id: citizen.id },
      data: { isOptedIn: optIn },
    });

    // AUDIT LOG
    await createAuditLog(null, optIn ? ActionType.CITIZEN_OPTED_IN : ActionType.CITIZEN_OPTED_OUT, EntityType.CITIZEN, citizen.id, {
      description: ACTION_DESCRIPTIONS[optIn ? ActionType.CITIZEN_OPTED_IN : ActionType.CITIZEN_OPTED_OUT],
      phoneNumber: normalizedPhone,
      action: optIn ? ActionType.CITIZEN_OPTED_IN : ActionType.CITIZEN_OPTED_OUT,
      timestamp: new Date(),
    });

    // CACHE INVALIDATION
    await Promise.all([
      this.cache.delete(cacheConstants.keys.CITIZEN.BY_ID, citizen.id),
      this.cache.delete(cacheConstants.keys.CITIZEN.BY_PHONE, normalizedPhone),
      this.cache.delete(cacheConstants.keys.CITIZEN.STATS, "global"), // Affects 'optedIn' count
    ]);

    logger.info("Citizen opt-in status changed", {
      citizenId: citizen.id,
      isOptedIn: optIn,
    });
  }

  /**
   * Get citizens with filters
   */
  static async getCitizens(filters: CitizenFilters): Promise<{ data: ICitizenData[]; pagination: IPaginationMeta }> {
    // const cache = getCacheService();

    // Create a unique key based on filters for caching results
    const cacheKey = JSON.stringify(filters);

    //READ CACHE (Short TTL for lists)
    return this.cache.getOrSet(
      cacheConstants.keys.CITIZEN.LIST,
      cacheKey,
      async () => {
        const { stateId, lgaId, wardId, isOptedIn, search, pagination } = filters;
        const { currentPage, limit, skip } = pagination;

        const where: any = {};

        if (stateId) where.stateId = stateId;
        if (lgaId) where.lgaId = lgaId;
        if (wardId) where.wardId = wardId;
        if (isOptedIn !== undefined) where.isOptedIn = isOptedIn;
        if (search) {
          where.OR = [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { phoneNumber: { contains: search } }];
        }

        // const skip = (page - 1) * limit;

        const [citizens, total] = await Promise.all([
          prisma.citizen.findMany({
            where,
            skip,
            take: limit,
            include: {
              state: { select: { id: true, name: true } },
              lga: { select: { id: true, name: true } },
              ward: { select: { id: true, name: true } },
            },
            orderBy: { registeredAt: "desc" },
          }),
          prisma.citizen.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
          data: citizens,
          pagination: {
            total,
            currentPage,
            limit,
            totalPages,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1,
          },
        };
      },
      cacheConstants.ttl.SHORT, // Lists expire quickly to reflect updates
    );
  }

  /**
   * Get citizens within radius of a point
   */
  static async getCitizensNearby(latitude: number, longitude: number, radiusMeters: number): Promise<ICitizenNearbyData[]> {
    // const cache = getCacheService();
    // Cache key based on rounded coordinates to group nearby requests
    // Rounding to 3 decimal places (~100m precision) helps hit cache for similar locations
    const latKey = latitude.toFixed(3);
    const lonKey = longitude.toFixed(3);
    const cacheKey = `${latKey}:${lonKey}:${radiusMeters}`;

    // READ CACHE
    return this.cache.getOrSet(
      cacheConstants.keys.CITIZEN.NEARBY,
      cacheKey,
      async () => {
        // Using PostGIS ST_DWithin for efficient spatial query
        try {
          const citizens = await prisma.$queryRaw`
          SELECT
            c.id,
            c.phone_number,
            c.first_name,
            c.last_name,
            c.preferred_language,
            c.is_opted_in,
            ST_Distance(c.location::geography, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) as distance
          FROM citizens c
          WHERE
            c.location IS NOT NULL
            AND c.is_opted_in = true
            AND ST_DWithin(
              c.location::geography,
              ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
              ${radiusMeters}
            )
          ORDER BY distance ASC
        `;

          return citizens as any[];
        } catch (error) {
          throw AppError.internal("Spatial query failed", error, "CitizenService", { latitude, longitude, radiusMeters });
        }
      },
      cacheConstants.ttl.SHORT, // Spatial data expires quickly
    );
  }

  /**
   * Get citizen statistics
   */
  static async getStatistics(): Promise<ICitizenStats> {
    return this.cache.getOrSet(
      cacheConstants.keys.CITIZEN.STATS,
      "global",
      async () => {
        const [total, optedIn, byState, byLanguage] = await Promise.all([
          prisma.citizen.count(),
          prisma.citizen.count({ where: { isOptedIn: true } }),
          prisma.citizen.groupBy({
            by: ["stateId"],
            _count: { _all: true },
          }),
          prisma.citizen.groupBy({
            by: ["preferredLanguage"],
            _count: { _all: true },
          }),
        ]);

        const byStateMap: Record<string, number> = {};
        for (const item of byState) {
          if (item.stateId) {
            byStateMap[item.stateId] = item._count._all;
          }
        }

        const byLanguageMap: Record<string, number> = {};
        for (const item of byLanguage) {
          if (item.preferredLanguage) {
            byLanguageMap[item.preferredLanguage] = item._count._all;
          }
        }

        return {
          total,
          optedIn,
          optedOut: total - optedIn,
          byState: byStateMap,
          byLanguage: byLanguageMap,
        };
      },
      cacheConstants.ttl.MEDIUM, // Stats update every 30 mins or on new registration
    );
  }
}
