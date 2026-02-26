import type { Request, Response } from "express";
import statusCodes from "http-status";
import { RabbitMQService } from "../rabbitmq/rabbitmq.queue.js";
import { CitizenService } from "../services/citizen.service.js";
import { SMSService } from "../services/sms.service.js";
import type { TSMSRetryResponse, TSMSStatsResponse } from "../types/sms.types.js";
import { asyncHandler } from "../utils/app.utils.js";
import { logger } from "../utils/logger.util.js";

export class SMSController {
  /**
   * Handle incoming SMS from Africa's Talking
   */
  static handleIncomingSMS = asyncHandler(async (req: Request, res: Response) => {
    logger.debug("Handling incoming SMS", req.body);
    const { from, to, text, date, id } = req.body;

    logger.info("Incoming SMS received", {
      from,
      to,
      text,
      messageId: id,
    });

    // Handle STOP/HELP keywords
    const textLower = text.toLowerCase().trim();

    if (textLower === "stop") {
      await CitizenService.toggleOptIn(from, false);
      await SMSService.sendSMS({
        to: from,
        message: "You have unsubscribed from GeoAlert. To re-subscribe, dial our USSD code.",
      });
    } else if (textLower === "help") {
      await SMSService.sendSMS({
        to: from,
        message: "GeoAlert: Receive emergency alerts via SMS. Dial *384*1234# to manage your subscription. Reply STOP to unsubscribe.",
      });
    } else if (textLower === "start" || textLower === "subscribe") {
      await CitizenService.toggleOptIn(from, true);
      await SMSService.sendSMS({
        to: from,
        message: "You have re-subscribed to GeoAlert. Stay safe!",
      });
    }

    // Send empty response (required by Africa's Talking)
    res.status(statusCodes.OK).send("");
  });

  /**
   * Handle delivery reports from Africa's Talking
   * Supports both single and bulk delivery reports
   */
  static handleDeliveryReport = asyncHandler(async (req: Request, res: Response) => {
    // Validation already done by middleware
    const reports = Array.isArray(req.body) ? req.body : [req.body];
    logger.debug("Processing delivery reports", {
      count: reports.length,
      reports,
    });

    logger.debug("Received delivery reports", {
      count: reports.length,
      reports: reports.map((r) => ({ id: r.id, status: r.status })),
    });

    // Queue for background processing (fire-and-forget)
    const queuePromises = reports.map((report) =>
      RabbitMQService.addDeliveryReportJob(report).catch((error) => {
        logger.error("Failed to queue delivery report", {
          error: error.message,
          reportId: report.id,
        });
      }),
    );

    await Promise.allSettled(queuePromises);

    logger.info("Delivery reports queued", { count: reports.length });

    // Fast response to Africa's Talking
    res.status(statusCodes.OK).send("OK");
  });

  /**
   * Get delivery statistics for an alert
   * Useful for monitoring alert delivery performance
   */
  static getAlertDeliveryStats = asyncHandler(async (req: Request, res: Response<TSMSStatsResponse>) => {
    const { alertId } = req.params;

    const stats = await SMSService.getAlertDeliveryStats(alertId as string);

    res.status(statusCodes.OK).json({
      success: true,
      message: "SMS statistics retrieved",
      data: stats,
    });
  });

  /**
   * Retry failed deliveries for a specific alert
   */
  static retryFailedDeliveries = asyncHandler(async (req: Request, res: Response<TSMSRetryResponse>) => {
    const { alertId } = req.params;

    const result = await SMSService.retryFailedDeliveries(alertId as string);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Retry initiated for failed deliveries",
      data: result,
    });
  });
}
