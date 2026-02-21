import { prisma } from "../lib/prisma.js";
import type { ActionType, EntityType } from "../prisma/prisma/generated/enums.js";
import type { IAuditLogData } from "../types/common.types.js";
import { logger } from "./logger.util";

export const createAuditLog = async(
    userId: string | null,
    action: ActionType,
    entityType: EntityType,
    entityId: string,
    changes?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> => {
    try {
      // Build data object only with defined values
      const data: IAuditLogData = {
        userId,
        action,
        entityType,
        entityId
      };

      // Only add optional fields if they have values
      if (changes !== undefined) {
        data.changes = changes;
      }
      if (ipAddress) {
        data.ipAddress = ipAddress;
      }
      if (userAgent) {
        data.userAgent = userAgent;
      }

      await prisma.auditLog.create({ data });
    } catch (error) {
      logger.error("Failed to create audit log", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        action,
        entityId,
      });
    }
  }