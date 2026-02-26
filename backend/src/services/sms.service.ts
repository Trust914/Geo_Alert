import { AT_CONFIG, atSMS } from "../config/africasTalking.config.js";
import { cacheConstants } from "../config/cache.constants.js";
import { serverConfig } from "../config/server.config.js";
import { prisma } from "../lib/prisma.js";
import { ActionType, DeliveryStatus, EntityType } from "../prisma/prisma/generated/enums.js";
import { RabbitMQService } from "../rabbitmq/rabbitmq.queue.js";
import type { ATDeliveryReport, ISMSDeliveryStatsData, ISMSRetryResultData, SendSMSOptions, SMSResult } from "../types/sms.types.js";
import { mapStatusToEnum } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { getCacheService } from "./cache.service.js";

export class SMSService {
  private static APP_NAME = serverConfig.app.name.split("_")[0];

  private static get cache() {
    return getCacheService();
  }

  static async sendSMS(options: SendSMSOptions): Promise<SMSResult[]> {
    const { to, message, from, enqueue = false } = options;

    const recipients = Array.isArray(to) ? to : [to];

    const validRecipients = recipients.filter((phone) => this.validatePhoneNumber(phone));

    if (validRecipients.length === 0) {
      throw AppError.badRequest("No valid phone numbers provided", "SMSService");
    }

    if (validRecipients.length !== recipients.length) {
      logger.warn("Some phone numbers were invalid and skipped", {
        total: recipients.length,
        valid: validRecipients.length,
        invalid: recipients.filter((p) => !validRecipients.includes(p)),
      });
    }

    try {
      logger.debug("Sending SMS via Africa's Talking", {
        recipients: validRecipients,
        messageLength: message.length,
        from: from || AT_CONFIG.senderId,
        enqueue,
        username: AT_CONFIG.username,
      });

      const response = await atSMS.send({
        to: validRecipients,
        message: message.substring(0, 918),
        from: from || AT_CONFIG.shortCode,
        enqueue: enqueue,
      });

      logger.info("SMS API Response", {
        response: JSON.stringify(response, null, 2),
      });

      if (!response.SMSMessageData) {
        throw new Error("Invalid response from Africa's Talking API - missing SMSMessageData");
      }

      if (!response.SMSMessageData.Recipients) {
        throw new Error("Invalid response from Africa's Talking API - missing Recipients");
      }

      if (!enqueue) {
        logger.info("SMS sent via Africa's Talking", {
          recipients: validRecipients.length,
          messageLength: message.length,
          response: response.SMSMessageData,
        });
      }

      const results: SMSResult[] = response.SMSMessageData.Recipients.map((recipient: any) => ({
        success: recipient.status === "Success" || recipient.status === "Sent",
        messageId: recipient.messageId,
        phoneNumber: recipient.number,
        status: recipient.status,
        cost: recipient.cost,
        error: recipient.status !== "Success" && recipient.status !== "Sent" ? recipient.status : undefined,
      }));

      // Trigger Delivery Report Job for each result
      // This ensures we capture the initial status ("Sent"/"Queued") immediately
      const jobPromises = results
        .filter((r) => r.messageId && r.messageId !== "None") // Only if we have a valid ID
        .map((result) => {
          const report: ATDeliveryReport = {
            id: result.messageId!,
            status: result.status,
            phoneNumber: result.phoneNumber,
            networkCode: result.networkCode,
            failureReason: result.error as string,
            retryCount: 0,
          };

          return RabbitMQService.addDeliveryReportJob(report).catch((err) => {
            logger.warn("Failed to queue initial delivery report", {
              id: result.messageId,
              error: err.message,
            });
          });
        });

      // Fire and forget (don't block the response)
      Promise.all(jobPromises);

      return results;
    } catch (error: any) {
      // Better error logging
      logger.error("Failed to send SMS via Africa's Talking", {
        errorMessage: error?.message || "Unknown error",
        errorName: error?.name,
        errorStack: error?.stack,
        errorDetails: JSON.stringify(error, null, 2),
        recipients: validRecipients.length,
        username: AT_CONFIG.username,
        hasApiKey: !!AT_CONFIG.apiKey,
      });

      throw AppError.internal(`SMS gateway communication failed: ${error?.message || "Unknown error"}`, error, "SMSService", {
        recipientCount: validRecipients.length,
        messageLength: message.length,
        provider: "AfricasTalking",
        errorDetails: error?.message,
      });
    }
  }

  static async sendAlertSMSBatch(phoneNumbers: string[], headline: string, description: string, severity: string, alertId: string): Promise<SMSResult[]> {
    const severityEmoji: Record<string, string> = {
      EXTREME: "🔴",
      SEVERE: "🟠",
      MODERATE: "🟡",
      MINOR: "🟢",
    };

    const emoji = severityEmoji[severity] || "⚠️";
    const message = `${emoji} ${this.APP_NAME?.toUpperCase()} - ${severity}\n\n${headline}\n\n${description}\n\nStay safe.`;
    const cleanMessage = message.substring(0, 918);

    // Validate numbers
    const validNumbers = phoneNumbers.filter(this.validatePhoneNumber);

    if (validNumbers.length === 0) return [];

    try {
      // Use AT's built-in bulk capability
      const response = await atSMS.send({
        to: validNumbers,
        message: cleanMessage,
        from: AT_CONFIG.shortCode,
        enqueue: true,
      });

      logger.debug("Bulk SMS sent", { response });

      // Map AT response back to our format
      const results: SMSResult[] = response.SMSMessageData.Recipients.map((r: any) => ({
        success: r.status === "Success" || r.status === "Queued",
        messageId: r.messageId,
        phoneNumber: r.number,
        status: r.status,
        cost: r.cost,
      }));

      const jobPromises = results
        .filter((r) => r.messageId && r.messageId !== "None")
        .map(async (result: any) => {
          const report: ATDeliveryReport = {
            id: result.messageId!,
            status: result.status,
            phoneNumber: result.phoneNumber,
            networkCode: result.networkCode,
            failureReason: result.error as string,
            retryCount: 0,
          };

          try {
            return await RabbitMQService.addDeliveryReportJob(report);
          } catch (err) {
            const errObj = err as Error;
            logger.warn("Failed to queue initial batch delivery report", {
              id: result.messageId,
              error: errObj.message,
            });
          }
        });

      Promise.all(jobPromises);

      return results;
    } catch (error) {
      logger.error("Bulk SMS Provider Error", {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  static async sendWelcomeSMS(phoneNumber: string, firstName: string): Promise<SMSResult> {
    const message = `Welcome to ${this.APP_NAME}, ${firstName}! You'll now receive emergency alerts for your area. To stop alerts, reply STOP. For help, reply HELP. Stay safe!`;

    logger.debug("Attempting to send welcome SMS", {
      phoneNumber,
      firstName,
      messageLength: message.length,
    });

    const results = await this.sendSMS({
      to: phoneNumber,
      message,
    });

    const result = results[0];
    if (!result) {
      throw AppError.internal("Failed to send welcome SMS: No response from provider", null, "SMSService");
    }

    if (result.messageId) {
      await this.cache.set(
        cacheConstants.keys.SMS.TRANSACTIONAL, // Prefix
        result.messageId, // Identifier
        "welcome", // Data
        cacheConstants.ttl.LONG, // TTL (1 hour)
      );
    }

    logger.info("Welcome SMS sent successfully", {
      phoneNumber,
      messageId: result.messageId,
      status: result.status,
    });

    return result;
  }

  static async sendOTP(phoneNumber: string, otp: string): Promise<SMSResult> {
    const message = `Your ${this.APP_NAME} verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;

    const results = await this.sendSMS({
      to: phoneNumber,
      message,
    });

    const result = results[0];
    if (!result) {
      throw AppError.internal("Failed to send OTP SMS: No response from provider", null, "SMSService");
    }

    if (result.messageId) {
      await this.cache.set(
        cacheConstants.keys.SMS.TRANSACTIONAL, // Prefix
        result.messageId, // Identifier
        "otp", // Data
        cacheConstants.ttl.LONG, // TTL (1 hour)
      );
    }

    return result;
  }

  static validatePhoneNumber(phone: string): boolean {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    const patterns = [/^\+234[789]\d{9}$/, /^234[789]\d{9}$/, /^0[789]\d{9}$/];

    return patterns.some((pattern) => pattern.test(cleaned));
  }

  static normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");

    if (cleaned.startsWith("+234")) {
      return cleaned;
    }

    if (cleaned.startsWith("234")) {
      return `+${cleaned}`;
    }

    if (cleaned.startsWith("0")) {
      return `+234${cleaned.substring(1)}`;
    }

    throw AppError.badRequest(`Invalid phone number format: ${phone}`, "SMSService");
  }

  /**
   * Get SMS delivery status with Caching
   */
  static async getDeliveryStatus(gatewayMessageId: string): Promise<any> {
    return this.cache.getOrSet(
      cacheConstants.keys.SMS.DELIVERY_STATUS,
      gatewayMessageId,
      async () => {
        const delivery = await prisma.deliveredAlert.findFirst({
          where: { gatewayMessageId },
          select: {
            status: true,
            deliveredAt: true,
            failureReason: true,
            retryCount: true,
          },
        });

        if (!delivery) {
          throw AppError.notFound("Delivery record not found", "SMSService");
        }

        return delivery;
      },
      cacheConstants.ttl.SHORT,
    );
  }

  /**
   * Process multiple delivery reports in batch
   * More efficient than processing one-by-one
   */
  static async processDeliveryReportsBatch(reports: ATDeliveryReport[]): Promise<void> {
    if (reports.length === 0) return;

    logger.info("Processing delivery reports batch", {
      count: reports.length,
    });

    const startTime = Date.now();

    try {
      // Group reports by status for efficient processing
      const reportsByStatus = reports.reduce(
        (acc, report) => {
          const status = mapStatusToEnum(report.status);
          if (!acc[status]) acc[status] = [];
          acc[status].push(report);
          return acc;
        },
        {} as Record<DeliveryStatus, ATDeliveryReport[]>,
      );

      // Process each status group
      const updatePromises = Object.entries(reportsByStatus).map(([status, groupReports]) => this.updateDeliveryStatusBatch(groupReports, status as DeliveryStatus));

      await Promise.allSettled(updatePromises);

      // Invalidate cache for all processed message IDs
      const cacheInvalidations = reports.map((report) => this.cache.delete(cacheConstants.keys.SMS.DELIVERY_STATUS, report.id));
      await Promise.all(cacheInvalidations);

      const duration = Date.now() - startTime;
      logger.info("Delivery reports batch processed", {
        count: reports.length,
        durationMs: duration,
      });
    } catch (error) {
      logger.error("Failed to process delivery reports batch", {
        error: (error as Error).message,
        reportCount: reports.length,
      });
      throw error;
    }
  }

  /**
   * Update delivery status for multiple reports at once
   */
  private static async updateDeliveryStatusBatch(reports: ATDeliveryReport[], status: DeliveryStatus): Promise<void> {
    const messageIds = reports.map((r) => r.id);

    logger.debug("Updating delivery status batch", {
      status,
      count: messageIds.length,
    });

    try {
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      // Add delivered timestamp for successful deliveries
      if (status === DeliveryStatus.DELIVERED) {
        updateData.deliveredAt = new Date();
      }

      // Add failure reasons for failed deliveries
      const failureReasons = reports
        .filter((r) => r.failureReason)
        .reduce(
          (acc, r) => {
            acc[r.id] = r.failureReason!;
            return acc;
          },
          {} as Record<string, string>,
        );

      // Batch update all matching records
      const result = await prisma.$transaction(
        messageIds.map((id) =>
          prisma.deliveredAlert.updateMany({
            where: { gatewayMessageId: id },
            data: {
              ...updateData,
              failureReason: failureReasons[id] || null,
            },
          }),
        ),
      );

      const totalUpdated = result.reduce((sum, r) => sum + r.count, 0);

      logger.info("Delivery status batch updated", {
        status,
        expected: messageIds.length,
        updated: totalUpdated,
      });

      // Log warnings for unmatched message IDs
      if (totalUpdated < messageIds.length) {
        const unmatchedIds = messageIds.filter((id, index) => result[index]?.count === 0);
        logger.warn("Some delivery reports had no matching records", {
          unmatchedIds,
          count: unmatchedIds.length,
        });
      }
    } catch (error) {
      logger.error("Failed to update delivery status batch", {
        error: (error as Error).message,
        status,
        count: messageIds.length,
      });
      throw error;
    }
  }

  /**
   * Get delivery statistics for a specific alert
   */
  static async getAlertDeliveryStats(alertId: string): Promise<ISMSDeliveryStatsData> {
    return this.cache.getOrSet(
      cacheConstants.keys.SMS.DELIVERY_STATUS,
      `stats:${alertId}`,
      async () => {
        const deliveries = await prisma.deliveredAlert.findMany({
          where: { alertId },
          select: {
            status: true,
            sentAt: true,
            deliveredAt: true,
          },
        });

        const total = deliveries.length;
        const delivered = deliveries.filter((d) => d.status === DeliveryStatus.DELIVERED).length;
        const failed = deliveries.filter((d) => d.status === DeliveryStatus.FAILED).length;
        const sent = deliveries.filter((d) => d.status === DeliveryStatus.SENT).length;
        const queued = deliveries.filter((d) => d.status === DeliveryStatus.QUEUED).length;
        const pending = sent + queued; // Pending = sent but not yet delivered + queued

        // Calculate average delivery time (in seconds)
        const deliveredWithTime = deliveries.filter((d) => d.status === DeliveryStatus.DELIVERED && d.deliveredAt);

        const averageDeliveryTime =
          deliveredWithTime.length > 0
            ? deliveredWithTime.reduce((sum, d) => {
                const diff = d.deliveredAt!.getTime() - d.sentAt!.getTime();
                return sum + diff;
              }, 0) /
              deliveredWithTime.length /
              1000 // Convert to seconds
            : undefined;

        return {
          total,
          delivered,
          failed,
          pending,
          sent,
          queued,
          deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
          failureRate: total > 0 ? (failed / total) * 100 : 0,
          averageDeliveryTime,
        };
      },
      cacheConstants.ttl.SHORT, // Cache for 5 minutes
    );
  }

  /**
   * Retry failed deliveries for a specific alert
   */
  static async retryFailedDeliveries(alertId: string): Promise<ISMSRetryResultData> {
    logger.info("Retrying failed deliveries", { alertId });

    const MAX_RETRY_COUNT = 3;

    // Get all failed deliveries that haven't exceeded max retries
    const failedDeliveries = await prisma.deliveredAlert.findMany({
      where: {
        alertId,
        status: DeliveryStatus.FAILED,
        retryCount: { lt: MAX_RETRY_COUNT },
      },
      include: {
        citizen: true,
        alert: true,
      },
    });

    // Count deliveries that have already exceeded retry limit
    const maxRetriesReached = await prisma.deliveredAlert.count({
      where: {
        alertId,
        status: DeliveryStatus.FAILED,
        retryCount: { gte: MAX_RETRY_COUNT },
      },
    });

    if (failedDeliveries.length === 0) {
      logger.info("No failed deliveries to retry", {
        alertId,
        maxRetriesReached,
      });
      return {
        retriedCount: 0,
        skippedCount: 0,
        maxRetriesReached,
      };
    }

    const alert = failedDeliveries[0]?.alert;
    const phoneNumbers = failedDeliveries.map((d) => d.citizen.phoneNumber);

    // Resend SMS
    const results = await this.sendAlertSMSBatch(phoneNumbers, alert?.headline as string, alert?.description as string, alert?.severity as string, alertId);

    // Update retry counts and new message IDs
    const updatePromises = results.map((result, index) => {
      const delivery = failedDeliveries[index];
      return prisma.deliveredAlert.update({
        where: { id: delivery?.id as string },
        data: {
          gatewayMessageId: result.messageId as string,
          status: result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
          retryCount: { increment: 1 },
          failureReason: result.error || null,
          sentAt: result.success ? new Date() : null,
        },
      });
    });

    await Promise.all(updatePromises);

    const retriedCount = results.filter((r) => r.success).length;
    const skippedCount = results.length - retriedCount;

    logger.info("Failed deliveries retry completed", {
      alertId,
      retriedCount,
      skippedCount,
      maxRetriesReached,
    });

    // Invalidate cache
    await this.cache.delete(cacheConstants.keys.SMS.DELIVERY_STATUS, `stats:${alertId}`);

    return {
      retriedCount,
      skippedCount,
      maxRetriesReached,
    };
  }

  /**
   * Clean up old delivery reports (for maintenance)
   */
  static async cleanupOldDeliveryReports(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.deliveredAlert.deleteMany({
      where: {
        sentAt: { lt: cutoffDate },
        status: { in: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED] },
      },
    });

    logger.info("Old delivery reports cleaned up", {
      deletedCount: result.count,
      olderThan: daysOld,
    });

    return result.count;
  }

  /**
   * Process single delivery report (legacy support)
   */
  static async processDeliveryReport(data: ATDeliveryReport): Promise<void> {
    await this.processDeliveryReportsBatch([data]);
  }
}
