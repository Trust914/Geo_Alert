import { cacheConstants } from "../config/cache.constants.js";
import { rabbitmqConfig } from "../config/rabbitmq.config.js";
import { prisma } from "../lib/prisma.js";
import { AlertStatus, DeliveryStatus, TargetType } from "../prisma/prisma/generated/enums.js";
import { AlertStatusService } from "../services/alert.status.service.js";
import { getCacheService } from "../services/cache.service.js";
import { EmailService } from "../services/email/email.service.js";
import { SMSService } from "../services/sms.service.js";
import type { AlertJobData } from "../types/alert.types.js";
import type { EmailType } from "../types/email.types.js";
import type { ATDeliveryReport } from "../types/sms.types.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { subscribeToEvent } from "../utils/rabbitmq.util.js";
import { RabbitMQService } from "./rabbitmq.queue.js";

/**
 * Start all workers
 */
export async function startWorkers(): Promise<void> {
  await Promise.all([startAlertPreparationWorker(), startAlertBatchWorker(), startDeliveryReportWorker(), startEmailWorker()]);
  logger.info("All RabbitMQ workers started");
}

/**
 * WORKER 1: Prepare Recipients (Geotargeting)
 */
async function startAlertPreparationWorker(): Promise<void> {
  await subscribeToEvent(
    rabbitmqConfig.constants.exchange,
    rabbitmqConfig.events.PREPARE_RECIPIENTS_EVENT,
    async (data: AlertJobData) => {
      const { alertId, userId, agencyId } = data;
      logger.info("Processing alert preparation", { alertId });

      try {
        const alert = await prisma.alert.findUnique({
          where: { id: alertId, agencyId },
          include: { targets: true },
        });

        if (!alert || !alert.targets.length) {
          throw AppError.notFound("Alert or targets not found", "RabbitMQStartAlertPreparationWorker", { data });
        }
        await prisma.alert.update({
          where: { id: alertId },
          data: { status: AlertStatus.PENDING, updatedAt: new Date() },
        });

        logger.debug("Alert Status set to PENDING", { alertStatus: alert.status });

        let totalRecipients = 0;
        for (const target of alert.targets) {
          let count = 0;

          if (target.targetType === TargetType.STATE && target.stateId) {
            count = await prisma.$executeRaw`
              INSERT INTO deliveries (id, alert_id, citizen_id, phone_number, status, retry_count, updated_at, queued_at)
              SELECT gen_random_uuid(), ${alertId}, c.id, c.phone_number, 'QUEUED', 0, NOW(), NOW()
              FROM citizens c
              WHERE c.state_id = ${target.stateId} AND c.is_opted_in = true
              ON CONFLICT DO NOTHING
            `;
          } else if (target.targetType === TargetType.LGA && target.lgaId) {
            count = await prisma.$executeRaw`
              INSERT INTO deliveries (id, alert_id, citizen_id, phone_number, status, retry_count, updated_at, queued_at)
              SELECT gen_random_uuid(), ${alertId}, c.id, c.phone_number, 'QUEUED', 0, NOW(), NOW()
              FROM citizens c
              WHERE c.lga_id = ${target.lgaId} AND c.is_opted_in = true
              ON CONFLICT DO NOTHING
            `;
          } else if (target.targetType === TargetType.WARD && target.wardId) {
            count = await prisma.$executeRaw`
              INSERT INTO deliveries (id, alert_id, citizen_id, phone_number, status, retry_count, updated_at, queued_at)
              SELECT gen_random_uuid(), ${alertId}, c.id, c.phone_number, 'QUEUED', 0, NOW(), NOW()
              FROM citizens c
              WHERE c.ward_id = ${target.wardId} AND c.is_opted_in = true
              ON CONFLICT DO NOTHING
            `;
          } else if (target.targetType === TargetType.RADIUS && target.radiusMeters) {
            count = await prisma.$executeRaw`
              INSERT INTO deliveries (id, alert_id, citizen_id, phone_number, status, retry_count, updated_at, queued_at)
              SELECT gen_random_uuid(), ${alertId}, c.id, c.phone_number, 'QUEUED', 0, NOW(), NOW()
              FROM citizens c
              JOIN alert_targets t ON t.id = ${target.id}
              WHERE c.is_opted_in = true
                AND ST_DWithin(c.location, t.center_point::geography, t.radius_meters)
              ON CONFLICT DO NOTHING
            `;
          } else if (target.targetType === TargetType.POLYGON) {
            count = await prisma.$executeRaw`
              INSERT INTO deliveries (id, alert_id, citizen_id, phone_number, status, retry_count, updated_at, queued_at)
              SELECT gen_random_uuid(), ${alertId}, c.id, c.phone_number, 'QUEUED', 0, NOW(), NOW()
              FROM citizens c
              JOIN alert_targets t ON t.id = ${target.id}
              WHERE c.is_opted_in = true
                AND ST_Within(c.location, t.target_polygon)
              ON CONFLICT DO NOTHING
            `;
          } else if (target.targetType === TargetType.PATH) {
            // FIX: PATH targets were not handled — citizens within a buffered corridor along the path
            count = await prisma.$executeRaw`
              INSERT INTO deliveries (id, alert_id, citizen_id, phone_number, status, retry_count, updated_at, queued_at)
              SELECT gen_random_uuid(), ${alertId}, c.id, c.phone_number, 'QUEUED', 0, NOW(), NOW()
              FROM citizens c
              JOIN alert_targets t ON t.id = ${target.id}
              WHERE c.is_opted_in = true
                AND ST_DWithin(
                  c.location::geography,
                  t.target_path::geography,
                  COALESCE(t.radius_meters, 1000)
                )
              ON CONFLICT DO NOTHING
            `;
          }

          totalRecipients += count;
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { agency: true },
        });

        await prisma.alert.update({
          where: { id: alertId },
          data: {
            status: AlertStatus.SENT,
            sentAt: new Date(),
            sentByUserId: userId,
            updatedAt: new Date(),
          },
        });

        if (totalRecipients > 0) {
          await RabbitMQService.addAlertBatchJob({ alertId, userId, agencyId });
        }

        logger.info("Alert preparation completed", {
          alertId,
          agencyId,
          totalRecipients,
        });
      } catch (error) {
        logger.error("Alert preparation failed", {
          alertId,
          error: (error as Error).message,
        });
        await prisma.alert.update({
          where: { id: alertId },
          data: { status: AlertStatus.CANCELLED },
        });
        throw AppError.worker("Alert preparation failed", "RabbitMQStartPreparationWorker", { error, data });
      }
    },
    // { queueName: "alert-preparation", prefetch: 2 }
  );

  logger.info("Alert preparation worker started");
}

/**
 * WORKER 2: Process Batch SMS
 */
async function startAlertBatchWorker(): Promise<void> {
  await subscribeToEvent(
    rabbitmqConfig.constants.exchange,
    rabbitmqConfig.events.PROCESS_BATCH_EVENT,
    async (data: AlertJobData) => {
      const { alertId, userId, agencyId } = data;
      logger.debug("Processing alert batch", { alertId, agencyId });

      try {
        const deliveries = await prisma.deliveredAlert.findMany({
          where: { alertId, status: DeliveryStatus.QUEUED },
          take: rabbitmqConfig.constants.batchSize,
          select: { id: true, phoneNumber: true },
        });

        if (deliveries.length === 0) {
          logger.info("No more queued deliveries", { alertId });
          return;
        }

        const alert = await prisma.alert.findUnique({
          where: { id: alertId },
          select: {
            headline: true,
            description: true,
            severity: true,
            agencyId: true,
          },
        });

        if (!alert) throw AppError.notFound("Alert not found", "RabbitMQStartPreparationWorker");

        const phoneNumbers = deliveries.map((d) => d.phoneNumber);
        logger.debug("Sending SMS batch", { phoneNumbers });
        const idMap = new Map(deliveries.map((d) => [d.phoneNumber, d.id]));

        const results = await SMSService.sendAlertSMSBatch(phoneNumbers, alert.headline, alert.description, alert.severity, alertId);

        logger.debug("SMS batch sent", { results });

        const successIds: string[] = [];
        const failedIds: string[] = [];
        const gatewayIds: { id: string; msgId: string }[] = [];

        const processedIds = new Set<string>();

        results.forEach((res) => {
          const dbId = idMap.get(res.phoneNumber);
          if (dbId) {
            processedIds.add(dbId); // Mark found
            if (res.success) {
              successIds.push(dbId);
              if (res.messageId) gatewayIds.push({ id: dbId, msgId: res.messageId });
            } else {
              failedIds.push(dbId);
            }
          }
        });

        const skippedIds = deliveries.filter((d) => !processedIds.has(d.id)).map((d) => d.id);

        await prisma.$transaction([
          prisma.deliveredAlert.updateMany({
            where: { id: { in: successIds } },
            data: { status: DeliveryStatus.SENT, sentAt: new Date(), deliveredAt: new Date(), updatedAt: new Date() },
          }),
          prisma.deliveredAlert.updateMany({
            where: { id: { in: failedIds } },
            data: {
              status: DeliveryStatus.FAILED,
              failureReason: "Gateway Error",
              updatedAt: new Date(),
            },
          }),
          // Fail the skipped items so they don't get picked up again
          ...(skippedIds.length > 0
            ? [
                prisma.deliveredAlert.updateMany({
                  where: { id: { in: skippedIds } },
                  data: {
                    status: DeliveryStatus.FAILED,
                    failureReason: "Validation Failed / ID Mismatch",
                    updatedAt: new Date(),
                  },
                }),
              ]
            : []),
          ...gatewayIds.map((g) =>
            prisma.deliveredAlert.update({
              where: { id: g.id },
              data: { gatewayMessageId: g.msgId, updatedAt: new Date() },
            }),
          ),
        ]);

        logger.info("Batch processed", {
          alertId,
          sent: successIds.length,
          failed: failedIds.length,
        });

        const remaining = await prisma.deliveredAlert.count({
          where: { alertId, status: DeliveryStatus.QUEUED },
        });

        if (remaining > 0) {
          await RabbitMQService.addAlertBatchJob({ alertId, userId, agencyId });
        } else {
          // FIX: All batches processed — update the alert status based on final delivery outcomes
          const deliveryCounts = await prisma.deliveredAlert.groupBy({
            by: ["status"],
            where: { alertId },
            _count: { status: true },
          });

          const total = deliveryCounts.reduce((sum, r) => sum + r._count.status, 0);
          const delivered = deliveryCounts.find((r) => r.status === DeliveryStatus.DELIVERED)?._count.status ?? 0;
          const failed = deliveryCounts.find((r) => r.status === DeliveryStatus.FAILED)?._count.status ?? 0;
          const sent = deliveryCounts.find((r) => r.status === DeliveryStatus.SENT)?._count.status ?? 0;

          // If every record is accounted for and none are still QUEUED, mark the alert DELIVERED
          // "SENT" here means SMS gateway accepted it but hasn't confirmed delivery yet —
          // we still mark the alert DELIVERED at the alert level since our job is done.
          if (total > 0 && (delivered + failed + sent) === total) {
            await prisma.alert.update({
              where: { id: alertId },
              data: { status: AlertStatus.DELIVERED, updatedAt: new Date() },
            });
            logger.info("Alert marked as DELIVERED", { alertId, delivered, failed, sent });
          } else if (total === 0) {
            // No recipients matched — mark DELIVERED with 0/0 so UI reflects completion
            await prisma.alert.update({
              where: { id: alertId },
              data: { status: AlertStatus.DELIVERED, updatedAt: new Date() },
            });
            logger.info("Alert marked as DELIVERED (0 recipients matched)", { alertId });
          }
        }
      } catch (error) {
        logger.error("Batch processing failed", {
          alertId,
          error: (error as Error).message,
        });
        throw error;
      }
    },
    // { queueName: "alert-batch", prefetch: 5 }
  );

  logger.info("Alert batch worker started");
}

// /**
//  * WORKER 3: Process Delivery Reports
//  */
// async function startDeliveryReportWorker(): Promise<void> {
//   await subscribeToEvent(RABBITMQ_EXCHANGE, rabbitmqEvents.PROCESS_DELIVERY_EVENT, async (data: ATDeliveryReport) => {
//     logger.debug("Processing delivery report", { data });
//     const { id, status, failureReason } = data;
//     // logger.debug("Processing delivery report", { id, status }); // Optional: Reduce log spam

//     try {
//       // STEP 1: Fast initial check
//       let record = await prisma.deliveredAlert.findUnique({
//         where: { gatewayMessageId: id },
//       });

//       // STEP 2: If record exists, process immediately
//       if (record) {
//         await SMSService.processDeliveryReport({
//           id,
//           status,
//           failureReason,
//           phoneNumber: data.phoneNumber,
//           networkCode: data.networkCode,
//           retryCount: data.retryCount,
//         });
//         return;
//       }

//       // STEP 3: If not in DB, IMMEDIATE Cache Check
//       // (Fixes the 6-second delay for Welcome SMS)
//       const cacheService = getCacheService();
//       const isTransactional = await cacheService.get(CACHE_KEYS.SMS.TRANSACTIONAL, id);

//       if (isTransactional) {
//         logger.info("Delivery report skipped (Transactional SMS)", {
//           id,
//           type: isTransactional,
//         });
//         return;
//       }

//       // STEP 4: Race Condition Handling (Retry Loop)
//       // We only reach here if it's NOT in DB and NOT a Welcome SMS.
//       // It might be a real alert that is slow to commit to DB.
//       let attempts = 0;
//       while (attempts < 2 && !record) {
//         // Reduced to 2 retries since we did 1 initial check
//         await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s

//         record = await prisma.deliveredAlert.findUnique({
//           where: { gatewayMessageId: id },
//         });

//         if (record) break;
//         attempts++;
//       }

//       // STEP 5: Final Processing after retry
//       if (record) {
//         await SMSService.processDeliveryReport({
//           id,
//           status,
//           failureReason,
//           phoneNumber: data.phoneNumber,
//           networkCode: data.networkCode,
//           retryCount: data.retryCount,
//         });
//         logger.debug("Delivery report processed after retry", { id });
//       } else {
//         // Genuine error: Valid alert record never appeared
//         logger.warn("Delivery record not found after retries", { id });
//       }
//     } catch (error) {
//       logger.error("Delivery report processing failed", {
//         id,
//         error: (error as Error).message,
//       });
//       // Don't throw if you want to avoid infinite requeuing of bad data
//       // throw error;
//     }
//   });

//   logger.info("Delivery report worker started");
// }

/**
 * WORKER 3: Process Delivery Reports
 * UPDATED: Now updates alert status after processing
 */
async function startDeliveryReportWorker(): Promise<void> {
  await subscribeToEvent(rabbitmqConfig.constants.exchange, rabbitmqConfig.events.PROCESS_DELIVERY_EVENT, async (data: ATDeliveryReport) => {
    logger.debug("Processing delivery report", { data });
    const { id, status, failureReason } = data;

    try {
      // STEP 1: Fast initial check
      let record = await prisma.deliveredAlert.findUnique({
        where: { gatewayMessageId: id },
        select: {
          id: true,
          alertId: true, // IMPORTANT: Get alertId for status update
        },
      });

      // STEP 2: If record exists, process immediately
      if (record) {
        await SMSService.processDeliveryReport({
          id,
          status,
          failureReason,
          phoneNumber: data.phoneNumber,
          networkCode: data.networkCode,
          retryCount: data.retryCount,
        });

        // NEW: Update alert status after processing delivery
        await AlertStatusService.updateAlertStatusFromDeliveries(record.alertId);
        return;
      }

      // STEP 3: If not in DB, IMMEDIATE Cache Check
      const cacheService = getCacheService();
      const isTransactional = await cacheService.get(cacheConstants.keys.SMS.TRANSACTIONAL, id);

      if (isTransactional) {
        logger.info("Delivery report skipped (Transactional SMS)", {
          id,
          type: isTransactional,
        });
        return;
      }

      // STEP 4: Race Condition Handling (Retry Loop)
      let attempts = 0;
      while (attempts < 2 && !record) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        record = await prisma.deliveredAlert.findUnique({
          where: { gatewayMessageId: id },
          select: {
            id: true,
            alertId: true,
          },
        });

        if (record) break;
        attempts++;
      }

      // STEP 5: Final Processing after retry
      if (record) {
        await SMSService.processDeliveryReport({
          id,
          status,
          failureReason,
          phoneNumber: data.phoneNumber,
          networkCode: data.networkCode,
          retryCount: data.retryCount,
        });

        // NEW: Update alert status after processing delivery
        await AlertStatusService.updateAlertStatusFromDeliveries(record.alertId);
        logger.debug("Delivery report processed after retry", { id });
      } else {
        logger.warn("Delivery record not found after retries", { id });
      }
    } catch (error) {
      logger.error("Delivery report processing failed", {
        id,
        error: (error as Error).message,
      });
    }
  });

  logger.info("Delivery report worker started");
}
/**
 * WORKER 4: Process Email Notifications
 * Updated to handle pre-generated HTML
 */
async function startEmailWorker(): Promise<void> {
  await subscribeToEvent(rabbitmqConfig.constants.exchange, rabbitmqConfig.events.SEND_EMAIL_EVENT, async (data: { to: string; subject: string; html: string; action: string }) => {
    const { to, subject, html } = data;
    logger.debug("Processing email job", { to, subject });

    try {
      // Send the email directly using pre-generated HTML
      await EmailService.sendDirect(to, subject, html);

      logger.info("Email sent successfully via worker", { to });
    } catch (error) {
      logger.error("Email worker failed", {
        to,
        subject,
        error: (error as Error).message,
      });
      // Throwing here will requeue the message depending on your RabbitMQ retry policy
      throw error;
    }
  });

  logger.info("Email worker started");
}