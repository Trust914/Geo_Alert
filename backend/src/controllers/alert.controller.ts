import type { Request, Response } from "express";
import statusCodes from "http-status";
import type { ZodCUID } from "zod";
import type { AlertCategory, AlertStatus, Severity } from "../prisma/prisma/generated/enums.js";
import { AlertService } from "../services/alert.service.js";
import type { IAlertFilters, ISendAlertResponse, TAlertPreviewResponse, TAlertResponse, TAlertStatsResponse, TCancelAlertResponse, TEstimateRecipientsResponse, TGetAlertsResponse, TSendAlertResponse } from "../types/alert.types.js";
import { asyncHandler } from "../utils/app.utils.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";

export class AlertController {
  /**
   * Create a new alert (DRAFT)
   */
  static createAlert = asyncHandler(async (req: Request, res: Response<TAlertResponse>) => {
    logger.debug("Creating alert", { userId: req.user?.id });
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AlertController");
    }
    logger.debug("user authenticated, creating alert");
    const data = req.body;
    const userId = req.user.id as string;

    if (!data.targets || !Array.isArray(data.targets) || data.targets.length === 0) {
      throw AppError.badRequest("At least one alert target is required", "AlertController", {
        providedData: {
          hasTargets: !!data.targets,
          isArray: Array.isArray(data.targets),
        },
      });
    }

    logger.debug("Creating alert with calculated location", { data });
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];

    const alert = await AlertService.createAlert(data, userId, ipAddress, userAgent);
    logger.debug("Alert created successfully", { alert });

    res.status(statusCodes.CREATED).json({
      success: true,
      message: "Alert created successfully",
      data: alert,
    });
  });

  /**
   * Preview alert before sending
   */
  static previewAlert = asyncHandler(async (req: Request, res: Response<TAlertPreviewResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AlertController");
    }

    const { alertId } = req.params as { alertId: string };
    const userId = req.user.id as string;

    const preview = await AlertService.previewAlert(alertId, userId);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Alert previewed generated successfully",
      data: preview,
    });
  });

  /**
   * Send alert (change from DRAFT to SENT)
   */
  static sendAlert = asyncHandler(async (req: Request, res: Response<TSendAlertResponse>) => {
    // Authentication is handled by middleware
    const { alertId } = req.params;

    // Calls the service which now returns instantly
    const result = await AlertService.sendAlert(alertId as string, req.user!.id, req.ip, req.headers["user-agent"]);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Alert queued for massive delivery. Progress can be monitored.",
      data: result,
    });
  });

  /**
   * Cancel an alert
   */
  static cancelAlert = asyncHandler(async (req: Request, res: Response<TCancelAlertResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AlertController");
    }

    const { alertId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id as string;
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];

    if (!reason) {
      throw AppError.badRequest("Cancellation reason is required", "AlertController");
    }

    const alert = await AlertService.cancelAlert(alertId as string, userId, reason, ipAddress, userAgent);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Alert cancelled successfully",
      data: alert,
    });
  });

  /**
   * Get all alerts with filters
   */
  static getAlerts = asyncHandler(async (req: Request, res: Response<TGetAlertsResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AlertController");
    }

    const userId = req.user.id as string;

    //Validate pagination exists (should be added by middleware)
    if (!req.pagination) {
      throw AppError.internal("Pagination middleware not applied", null, "AuthController");
    }

    const filters: IAlertFilters = {
      category: req.query.category as AlertCategory,
      severity: req.query.severity as Severity,
      status: req.query.status as AlertStatus,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      pagination: req.pagination,
      sortOptions: req.sort!,
    };

    const result = await AlertService.getAlerts(filters, userId);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Alerts retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  });

  /**
   * Get alert by ID
   */
  static getAlertById = asyncHandler(async (req: Request, res: Response<TAlertResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AlertController");
    }

    const { alertId } = req.params;
    const userId = req.user.id as string;

    const alert = await AlertService.getAlertById(alertId as string, userId);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Alert statistics retrieved",
      data: alert,
    });
  });

  /**
   * Get alert delivery statistics
   */
  static getAlertStats = asyncHandler(async (req: Request, res: Response<TAlertStatsResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AlertController");
    }

    const { alertId } = req.params;
    const userId = req.user.id as string;

    const stats = await AlertService.getAlertStats(alertId as string, userId);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Alert statistics retrieved",
      data: stats,
    });
  });

  /**
   * Estimate recipients for alert targets
   */
  static estimateRecipients = asyncHandler(async (req: Request, res: Response<TEstimateRecipientsResponse>) => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", "AlertController");
    }

    const { targets } = req.body;

    if (!targets || !Array.isArray(targets)) {
      throw AppError.badRequest("Valid targets array is required", "AlertController");
    }

    const count = await AlertService.estimateRecipients(targets);

    res.status(statusCodes.OK).json({
      success: true,
      message: "Estimation calculated",
      data: {
        estimatedRecipients: count,
      },
    });
  });
}
