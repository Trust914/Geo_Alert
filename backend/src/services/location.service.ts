import { cacheConstants } from "../config/cache.constants.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/error.util.js";
import { getCacheService } from "./cache.service.js";

export class LocationService {
  private static get cache() {
    return getCacheService();
  }

  /**
   * Get all States
   */
  static async getStates() {
    return this.cache.getOrSet(
      cacheConstants.keys.REFERENCE.STATES, // Prefix: "ref:states"
      "ALL", // Identifier
      async () => {
        const states = await prisma.state.findMany({
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: "asc",
          },
        });

        return states.map((s) => ({ ...s, type: "STATE" }));
      },
      cacheConstants.ttl.WEEK // 7 DAYS
    );
  }

  /**
   * Get LGAs by State ID
   */
  static async getLgasByStateId(stateId: string) {
    if (!stateId) throw AppError.badRequest("State ID is required");

    return this.cache.getOrSet(
      cacheConstants.keys.REFERENCE.LGAS, // Prefix: "ref:lgas"
      stateId, // Identifier: The State ID
      async () => {
        const lgas = await prisma.lGA.findMany({
          where: { stateId },
          select: {
            id: true,
            name: true,
            stateId: true,
          },
          orderBy: {
            name: "asc",
          },
        });

        return lgas.map((l) => ({ ...l, type: "LGA" }));
      },
      cacheConstants.ttl.WEEK // 7 DAYS
    );
  }

  /**
   * Get Wards by LGA ID
   */
  static async getWardsByLgaId(lgaId: string) {
    if (!lgaId) throw AppError.badRequest("LGA ID is required");

    return this.cache.getOrSet(
      cacheConstants.keys.REFERENCE.WARDS, // Prefix: "ref:wards"
      lgaId, // Identifier: The LGA ID
      async () => {
        const wards = await prisma.ward.findMany({
          where: { lgaId },
          select: {
            id: true,
            name: true,
            lgaId: true,
          },
          orderBy: {
            name: "asc",
          },
        });

        return wards.map((w) => ({ ...w, type: "WARD" }));
      },
      cacheConstants.ttl.WEEK // 7 DAYS
    );
  }
}