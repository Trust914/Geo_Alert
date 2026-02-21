import { cacheConstants } from "../config/cache.constants.js";
import { prisma } from "../lib/prisma.js";
import { AlertStatus, DeliveryStatus } from "../prisma/prisma/generated/enums.js";
import { logger } from "../utils/logger.util.js";
import { getCacheService } from "./cache.service.js";

export class AlertStatusService {
  private static get cache() {
    return getCacheService();
  }

  /**
   * Updates alert status based on delivery completion
   * Should be called after delivery report processing
   */
  static async updateAlertStatusFromDeliveries(alertId: string): Promise<void> {
    try {
      const alert = await prisma.alert.findUnique({
        where: { id: alertId },
        select: {
          id: true,
          status: true,
          agencyId: true,
        },
      });

      // Only update alerts that are currently in SENT status
      if (!alert || alert.status !== AlertStatus.SENT) {
        return;
      }

      // Get delivery statistics
      const stats = await prisma.deliveredAlert.groupBy({
        by: ["status"],
        where: { alertId },
        _count: { _all: true },
      });

      const totals = {
        total: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
      };

      stats.forEach((group) => {
        const count = group._count._all;
        totals.total += count;

        switch (group.status) {
          case DeliveryStatus.DELIVERED:
            totals.delivered = count;
            break;
          case DeliveryStatus.FAILED:
            totals.failed = count;
            break;
          case DeliveryStatus.QUEUED:
          case DeliveryStatus.SENT:
            totals.pending += count;
            break;
        }
      });

      // Determine new status based on delivery completion
      let newStatus: AlertStatus | null = null;

      // All deliveries completed (either delivered or failed)
      if (totals.pending === 0 && totals.total > 0) {
        // Check if all succeeded
        if (totals.delivered === totals.total) {
          newStatus = AlertStatus.DELIVERED;
          logger.info("Alert fully delivered successfully", {
            alertId,
            total: totals.total,
            delivered: totals.delivered,
          });
        }
        // Check if all failed
        else if (totals.failed === totals.total) {
          newStatus = AlertStatus.FAILED;
          logger.warn("Alert completely failed", {
            alertId,
            total: totals.total,
            failed: totals.failed,
          });
        }
        // Mixed results (some delivered, some failed)
        else if (totals.delivered > 0) {
          // Majority delivered - mark as DELIVERED
          if (totals.delivered > totals.failed) {
            newStatus = AlertStatus.DELIVERED;
            logger.info("Alert partially delivered (majority successful)", {
              alertId,
              total: totals.total,
              delivered: totals.delivered,
              failed: totals.failed,
              successRate: ((totals.delivered / totals.total) * 100).toFixed(2),
            });
          }
          // Majority failed - mark as FAILED
          else {
            newStatus = AlertStatus.FAILED;
            logger.warn("Alert partially delivered (majority failed)", {
              alertId,
              total: totals.total,
              delivered: totals.delivered,
              failed: totals.failed,
              successRate: ((totals.delivered / totals.total) * 100).toFixed(2),
            });
          }
        }
      }

      // Update status if needed
      if (newStatus) {
        await prisma.alert.update({
          where: { id: alertId },
          data: { status: newStatus, updatedAt: new Date() },
        });

        // Invalidate cache
        await Promise.all([this.cache.deletePattern(`${cacheConstants.keys.ALERT.LIST}:*`), this.cache.delete(cacheConstants.keys.ALERT.BY_ID, alertId)]);

        logger.info("Alert status updated", {
          alertId,
          oldStatus: alert.status,
          newStatus,
          stats: totals,
        });
      }
    } catch (error) {
      logger.error("Failed to update alert status from deliveries", {
        alertId,
        error: (error as Error).message,
      });
      // Don't throw - this is a background job
    }
  }

  /**
   * Batch update multiple alert statuses
   * More efficient for processing many delivery reports
   */
  static async batchUpdateAlertStatuses(alertIds: string[]): Promise<void> {
    if (alertIds.length === 0) return;

    const uniqueAlertIds = [...new Set(alertIds)];

    logger.debug("Batch updating alert statuses", {
      count: uniqueAlertIds.length,
    });

    await Promise.all(uniqueAlertIds.map((id) => this.updateAlertStatusFromDeliveries(id)));
  }
}
