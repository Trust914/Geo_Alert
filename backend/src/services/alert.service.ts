import { mapToAlertData } from "../helpers/service.helpers.js";
import { prisma } from "../lib/prisma.js";
import {
  ActionType,
  AlertCertainty,
  AlertScope,
  AlertStatus,
  AgencyType,
  DeliveryStatus,
  EntityType,
  JurisdictionLevel,
  MessageType,
  TargetType,
  UserRole,
} from "../prisma/prisma/generated/enums.js";
import { RabbitMQService } from "../rabbitmq/rabbitmq.queue.js";
import { ACTION_DESCRIPTIONS } from "../types/actions.types.js";
import type {
  IAlertData,
  IAlertFilters,
  IAlertPreviewData,
  IAlertStatsData,
  IAlertTarget,
  ICreateAlertDTO,
  IGeoJSONLineString,
  IGeoJSONPolygon,
  ISendAlertResponse,
} from "../types/alert.types.js";
import type { IPaginationMeta } from "../types/api.response.js";
import { createAuditLog } from "../utils/auditLog.util.js";
import { CAPXMLGenerator } from "../utils/cap.util.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { getCacheService } from "./cache.service.js";
import { GeoTargetingService } from "./geoTargeting.service.js";
import { cacheConstants } from "../config/cache.constants.js";
import { serverConfig } from "../config/server.config.js";
import { getNemaAgencyId } from "../utils/app.utils.js";

export class AlertService {
  private static readonly APP_NAME = serverConfig.app.name.split("_")[0];

  private static get cache() {
    return getCacheService();
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Determines if a user is a NEMA super admin.
   * Super admins can view (but not manage) alerts across all agencies.
   */
  private static async isSuperAdmin(user: {
    role: UserRole;
    agencyId: string;
    agency: { type: string; jurisdictionLevel: string };
  }): Promise<boolean> {
    const nemaAgencyId = await getNemaAgencyId();
    return (
      user.role === UserRole.ADMIN &&
      user.agency.type === AgencyType.FEDERAL &&
      user.agency.jurisdictionLevel === JurisdictionLevel.NATIONAL &&
      user.agencyId === nemaAgencyId
    );
  }

  /**
   * Validates that alert targets fall within the user's agency jurisdiction.
   * NATIONAL agencies can target anywhere; STATE/LGA/WARD are scoped accordingly.
   */
  private static async validateJurisdiction(userId: string, targets: IAlertTarget[]): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        agency: {
          select: { id: true, jurisdictionLevel: true, jurisdiction: true },
        },
      },
    });

    if (!user) {
      throw AppError.notFound("User not found", "AlertService", { userId });
    }

    const { jurisdictionLevel, jurisdiction } = user.agency;

    for (const target of targets) {
      try {
        switch (jurisdictionLevel) {
          case JurisdictionLevel.NATIONAL:
            // National agencies (e.g. NEMA) can target any area — no restriction
            break;

          case JurisdictionLevel.STATE:
            if (target.targetType === TargetType.STATE && target.stateId) {
              const state = await prisma.state.findUnique({ where: { id: target.stateId } });
              if (!state || state.name !== jurisdiction) {
                throw AppError.forbidden(
                  `You can only send alerts within ${jurisdiction}`,
                  "AlertService",
                  { userJurisdiction: jurisdiction, attemptedState: target.stateId, jurisdictionLevel }
                );
              }
            }
            break;

          case JurisdictionLevel.LGA:
            if (target.targetType === TargetType.LGA && target.lgaId) {
              const lga = await prisma.lGA.findUnique({ where: { id: target.lgaId } });
              if (!lga || lga.name !== jurisdiction) {
                throw AppError.forbidden(
                  `You can only send alerts within ${jurisdiction}`,
                  "AlertService",
                  { userJurisdiction: jurisdiction, attemptedLGA: target.lgaId, jurisdictionLevel }
                );
              }
            }
            break;

          case JurisdictionLevel.WARD:
            if (target.targetType === TargetType.WARD && target.wardId) {
              const ward = await prisma.ward.findUnique({ where: { id: target.wardId } });
              if (!ward || ward.name !== jurisdiction) {
                throw AppError.forbidden(
                  `You can only send alerts within ${jurisdiction}`,
                  "AlertService",
                  { userJurisdiction: jurisdiction, attemptedWard: target.wardId, jurisdictionLevel }
                );
              }
            }
            break;
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw AppError.internal("Jurisdiction validation failed", error, "AlertService", {
          target,
          jurisdictionLevel,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // ESTIMATE RECIPIENTS
  // ─────────────────────────────────────────────────────────────────

  static async estimateRecipients(targets: IAlertTarget[]): Promise<number> {
    let totalEstimate = 0;

    // Strategy 1: Admin boundary targets — batched + deduplicated via OR
    const adminTargets = targets.filter((t) =>
      [TargetType.STATE, TargetType.LGA, TargetType.WARD].includes(t.targetType as any)
    );

    if (adminTargets.length > 0) {
      const orConditions = adminTargets
        .map((t) => {
          if (t.targetType === TargetType.STATE && t.stateId) return { stateId: t.stateId };
          if (t.targetType === TargetType.LGA && t.lgaId) return { lgaId: t.lgaId };
          if (t.targetType === TargetType.WARD && t.wardId) return { wardId: t.wardId };
          return undefined;
        })
        .filter(Boolean);

      if (orConditions.length > 0) {
        const count = await prisma.citizen.count({
          where: { OR: orConditions as any, isOptedIn: true },
        });
        totalEstimate += count;
      }
    }

    // Strategy 2: Spatial targets — PostGIS queries per shape
    const mapTargets = targets.filter((t) =>
      [TargetType.POLYGON, TargetType.RADIUS, TargetType.PATH].includes(t.targetType as any)
    );

    for (const target of mapTargets) {
      if (!target.geometry) continue;

      try {
        let wktGeometry: string;

        if (target.geometry.type === "Polygon") {
          wktGeometry = this.geoJSONPolygonToWKT(target.geometry);
        } else if (target.geometry.type === "LineString") {
          wktGeometry = this.geoJSONLineStringToWKT(target.geometry);
        } else {
          const [lng, lat] = target.geometry.coordinates;
          wktGeometry = `POINT(${lng} ${lat})`;
        }

        const result = await prisma.$queryRawUnsafe<{ count: number }[]>(
          `SELECT COUNT(*)::int as count
           FROM "citizens"
           WHERE "location" IS NOT NULL
             AND "is_opted_in" = true
             AND ST_Within("location", ST_GeomFromText($1, 4326))`,
          wktGeometry
        );

        totalEstimate += result[0]?.count || 0;
      } catch (error) {
        logger.error("Spatial estimation failed, trying GeoJSON fallback", { error, target });
        try {
          const result = await prisma.$queryRawUnsafe<{ count: number }[]>(
            `SELECT COUNT(*)::int as count
             FROM "citizens"
             WHERE "location" IS NOT NULL
               AND "is_opted_in" = true
               AND ST_Contains(ST_GeomFromGeoJSON($1), "location")`,
            JSON.stringify(target.geometry)
          );
          totalEstimate += result[0]?.count || 0;
        } catch (fallbackError) {
          logger.error("Fallback spatial estimation failed", { fallbackError });
          throw AppError.internal(
            "Failed to estimate recipients for map-based target",
            error,
            "AlertService"
          );
        }
      }
    }

    logger.debug("Estimated total recipients", { totalEstimate, targetCount: targets.length });
    return totalEstimate;
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE ALERT (DRAFT)
  // Allowed: Admin, Coordinator, Operator
  // Denied:  Viewer
  // ─────────────────────────────────────────────────────────────────

  static async createAlert(
    data: ICreateAlertDTO,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IAlertData> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        agency: {
          select: { id: true, name: true, jurisdictionLevel: true, jurisdiction: true },
        },
      },
    });

    if (!user) {
      throw AppError.notFound("User not found", "AlertService", { userId });
    }

    if (user.role === UserRole.VIEWER) {
      throw AppError.forbidden("Viewers do not have permission to create alerts", "AlertService");
    }

    await this.validateJurisdiction(userId, data.targets);

    const capXml = CAPXMLGenerator.generate({
      identifier: `${user.agency.name}-${Date.now()}`,
      sender: user.agency.name,
      sent: new Date(),
      status: AlertStatus.DRAFT,
      msgType: MessageType.ALERT,
      scope: AlertScope.PUBLIC,
      category: data.category,
      event: data.headline,
      urgency: data.urgency,
      severity: data.severity,
      certainty: AlertCertainty.OBSERVED,
      headline: data.headline,
      description: data.description,
      instruction: data.instruction as string,
      areaDesc: this.generateAreaDescription(data.targets),
    });

    const alert = await prisma.$transaction(async (tx) => {
      const createdAlert = await tx.alert.create({
        data: {
          agencyId: user.agencyId,
          createdByUserId: userId,
          category: data.category,
          severity: data.severity,
          urgency: data.urgency,
          headline: data.headline,
          description: data.description,
          instruction: data.instruction,
          capXml,
          status: AlertStatus.DRAFT,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          agency: { select: { id: true, name: true, type: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      // Auto-calculate incident location from first target if not provided
      if (!data.incidentLocation && data.targets.length > 0) {
        const calculatedLocation = await GeoTargetingService.calculateIncidentLocation(
          data.targets[0] as IAlertTarget
        );
        if (calculatedLocation?.latitude && calculatedLocation?.longitude) {
          data.incidentLocation = calculatedLocation;
          await tx.$executeRawUnsafe(
            `UPDATE alerts SET incident_location = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
            calculatedLocation.longitude,
            calculatedLocation.latitude,
            createdAlert.id
          );
        }
      }

      // Create targets with per-target recipient estimates
      for (const target of data.targets) {
        const estimatedRecipients = await this.estimateRecipients([target]);
        const createdTarget = await tx.alertTarget.create({
          data: {
            alertId: createdAlert.id,
            targetType: target.targetType,
            stateId: target.stateId || null,
            lgaId: target.lgaId || null,
            wardId: (target.wardId as string) || null,
            radiusMeters:
              target.targetType === TargetType.RADIUS ? (target.radius as number) : null,
            pathBufferMeters:
              target.targetType === TargetType.PATH ? (target.bufferMeters as number) : null,
            estimatedRecipients,
          },
        });

        if (target.geometry) {
          await this.updateTargetGeometry(tx, createdTarget.id, target);
        }
      }

      return createdAlert;
    });

    await Promise.all([
      this.cache.invalidateGroup(cacheConstants.keys.ALERT.LIST),
      this.cache.invalidateGroup(cacheConstants.keys.ALERT.ACTIVE),
      this.cache.invalidateGroup(cacheConstants.keys.ALERT.STATS),
    ]);

    await createAuditLog(
      userId,
      ActionType.ALERT_CREATED,
      EntityType.ALERT,
      alert.id,
      {
        description: ACTION_DESCRIPTIONS[ActionType.ALERT_CREATED],
        category: data.category,
        severity: data.severity,
        urgency: data.urgency,
        headline: data.headline,
      },
      ipAddress,
      userAgent
    );

    const completeAlert = await prisma.alert.findUnique({
      where: { id: alert.id },
      include: {
        agency: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        targets: {
          include: {
            state: { select: { id: true, name: true } },
            lga: { select: { id: true, name: true } },
            ward: { select: { id: true, name: true } },
          },
        },
        _count: { select: { deliveries: true } },
      },
    });

    logger.info("Alert created", {
      alertId: alert.id,
      userId,
      category: data.category,
      severity: data.severity,
    });

    return mapToAlertData(completeAlert);
  }

  // ─────────────────────────────────────────────────────────────────
  // PREVIEW ALERT
  // Allowed: Admin, Coordinator, Operator (write-access roles)
  // ─────────────────────────────────────────────────────────────────

  static async previewAlert(alertId: string, userId: string): Promise<IAlertPreviewData> {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        targets: {
          include: {
            state: { select: { name: true } },
            lga: { select: { name: true } },
            ward: { select: { name: true } },
          },
        },
        agency: { select: { id: true, name: true, type: true } },
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        deliveries: {
          select: {
            id: true,
            status: true,
            queuedAt: true,
            sentAt: true,
            deliveredAt: true,
            failureReason: true,
          },
        },
      },
    });

    if (!alert) {
      throw AppError.notFound("Alert not found", "AlertService");
    }

    const smsMessage = this.formatSMSMessage(alert.headline, alert.description, alert.severity);
    const smsLength = smsMessage.length;
    const smsCount = Math.ceil(smsLength / 160);
    const totalRecipients = alert.targets.reduce(
      (sum, t) => sum + (t.estimatedRecipients || 0),
      0
    );

    return {
      alert: {
        id: alert.id,
        category: alert.category,
        severity: alert.severity,
        urgency: alert.urgency,
        headline: alert.headline,
        description: alert.description,
        instruction: alert.instruction as string,
        status: alert.status,
        expiresAt: alert.expiresAt as Date,
      },
      targets: alert.targets.map((t) => ({
        id: t.id,
        targetType: t.targetType,
        estimatedRecipients: t.estimatedRecipients || 0,
        locationName: t.state?.name ?? t.lga?.name ?? t.ward?.name ?? "Custom",
      })),
      agency: alert.agency,
      createdBy: alert.createdBy,
      smsPreview: {
        message: smsMessage,
        characterCount: smsLength,
        messageCount: smsCount,
        estimatedCost: smsCount * totalRecipients * 2.5,
      },
      deliveries: alert.deliveries.map((d) => ({
        id: d.id,
        status: d.status as AlertStatus,
        queuedAt: d.queuedAt as Date,
        sentAt: d.sentAt as Date,
        deliveredAt: d.deliveredAt as Date,
        failureReason: d.failureReason as string,
      })),
      estimatedRecipients: totalRecipients,
      capXml: alert.capXml,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SEND ALERT (DRAFT → PENDING → SENT)
  // Allowed: Admin, Coordinator, Operator
  // All users are pre-vetted before system access — no per-alert approval required
  // Denied:  Viewer
  // ─────────────────────────────────────────────────────────────────

  static async sendAlert(
    alertId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ISendAlertResponse> {
    const [alert, user] = await Promise.all([
      prisma.alert.findUnique({
        where: { id: alertId },
        include: { agency: true, targets: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          agency: { select: { id: true, type: true, jurisdictionLevel: true } },
        },
      }),
    ]);

    if (!alert) {
      throw AppError.notFound("Alert not found", "AlertService", { alertId });
    }

    if (!user) {
      throw AppError.notFound("User not found", "AlertService", { userId });
    }

    // Viewers cannot send alerts
    if (user.role === UserRole.VIEWER) {
      throw AppError.forbidden("Viewers do not have permission to send alerts", "AlertService");
    }

    // Users can only send alerts belonging to their own agency
    if (user.agencyId !== alert.agencyId) {
      throw AppError.forbidden(
        "You can only send alerts from your own agency",
        "AlertService",
        { alertId, userId, userAgencyId: user.agencyId, alertAgencyId: alert.agencyId }
      );
    }

    // Only DRAFT alerts can be sent
    if (alert.status !== AlertStatus.DRAFT) {
      throw AppError.badRequest(
        `Cannot send alert with status: ${alert.status}. Only DRAFT alerts can be sent.`,
        "AlertService",
        { alertId, currentStatus: alert.status }
      );
    }

    const updatedAlert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.PENDING,
        sentAt: new Date(),
        updatedAt: new Date(),
        sentByUserId: userId,
      },
      include: {
        agency: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        sentBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        targets: {
          include: {
            state: { select: { id: true, name: true } },
            lga: { select: { id: true, name: true } },
            ward: { select: { id: true, name: true } },
          },
        },
        _count: { select: { deliveries: true } },
      },
    });

    await RabbitMQService.addAlertPreparationJob({
      alertId,
      agencyId: alert.agencyId,
      userId,
    });

    await Promise.all([
      this.cache.invalidateGroup(cacheConstants.keys.ALERT.LIST),
      this.cache.delete(cacheConstants.keys.ALERT.BY_ID, alertId),
      this.cache.invalidateGroup(cacheConstants.keys.ALERT.STATS),
      this.cache.invalidateGroup(cacheConstants.keys.ALERT.ACTIVE),
      createAuditLog(
        userId,
        ActionType.ALERT_SENT,
        EntityType.ALERT,
        alertId,
        { description: ACTION_DESCRIPTIONS[ActionType.ALERT_SENT], status: DeliveryStatus.QUEUED },
        ipAddress,
        userAgent
      ),
    ]);

    logger.info(`Alert ${alertId} queued for delivery`, { userId, agencyId: alert.agencyId });

    return {
      alertId,
      alert: mapToAlertData(updatedAlert),
      status: AlertStatus.PENDING,
      message: "Alert queued for delivery",
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // CANCEL ALERT
  // Admin / Coordinator: can cancel any agency alert in DRAFT, PENDING, or SENT
  // Operator:            can only cancel their own DRAFT alerts
  // Denied:              already CANCELLED, DELIVERED, or EXPIRED alerts
  // ─────────────────────────────────────────────────────────────────

  static async cancelAlert(
    alertId: string,
    userId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IAlertData> {
    const [alert, user] = await Promise.all([
      prisma.alert.findUnique({
        where: { id: alertId },
        include: { agency: true, createdBy: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          agency: { select: { id: true, type: true, jurisdictionLevel: true } },
        },
      }),
    ]);

    if (!alert) throw AppError.notFound("Alert not found", "AlertService");
    if (!user) throw AppError.notFound("User not found", "AlertService");

    // Agency scope check
    if (user.agencyId !== alert.agencyId) {
      throw AppError.forbidden("You can only cancel alerts from your own agency", "AlertService");
    }

    // Operator restrictions: own DRAFT alerts only
    if (user.role === UserRole.OPERATOR) {
      if (alert.createdByUserId !== userId) {
        throw AppError.forbidden(
          "Operators can only cancel alerts they created",
          "AlertService"
        );
      }
      if (alert.status !== AlertStatus.DRAFT) {
        throw AppError.forbidden(
          "Operators can only cancel DRAFT alerts. Contact a Coordinator or Admin to cancel a live alert.",
          "AlertService"
        );
      }
    }

    // Globally cancellable statuses
    const cancellableStatuses: AlertStatus[] = [
      AlertStatus.DRAFT,
      AlertStatus.PENDING,
      AlertStatus.SENT,
    ];

    if (!cancellableStatuses.includes(alert.status)) {
      throw AppError.badRequest(
        `Alert cannot be cancelled. Current status: ${alert.status}`,
        "AlertService"
      );
    }

    const updatedAlert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.CANCELLED,
        cancelledAt: new Date(),
        updatedAt: new Date(),
        cancelReason: reason,
        cancelledByUserId: userId,
      },
      include: {
        agency: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        cancelledBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        sentBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        targets: {
          include: {
            state: { select: { id: true, name: true } },
            lga: { select: { id: true, name: true } },
            ward: { select: { id: true, name: true } },
          },
        },
        _count: { select: { deliveries: true } },
      },
    });

    await Promise.all([
      this.cache.invalidateGroup(cacheConstants.keys.ALERT.LIST),
      this.cache.delete(cacheConstants.keys.ALERT.BY_ID, alertId),
      this.cache.invalidateGroup(cacheConstants.keys.ALERT.ACTIVE),
      this.cache.invalidateGroup(cacheConstants.keys.ALERT.STATS),
      createAuditLog(
        userId,
        ActionType.ALERT_CANCELLED,
        EntityType.ALERT,
        alertId,
        { description: ACTION_DESCRIPTIONS[ActionType.ALERT_CANCELLED], reason },
        ipAddress,
        userAgent
      ),
    ]);

    logger.warn("Alert cancelled", { alertId, userId, reason });

    return mapToAlertData(updatedAlert);
  }

  // ─────────────────────────────────────────────────────────────────
  // GET ALERTS (List)
  // Super admin (NEMA): sees all agencies' alerts
  // All other roles:    scoped to their own agency only
  // ─────────────────────────────────────────────────────────────────

  static async getAlerts(
    filters: IAlertFilters,
    userId: string
  ): Promise<{ data: IAlertData[]; pagination: IPaginationMeta }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        agency: { select: { id: true, type: true, jurisdictionLevel: true } },
      },
    });

    if (!user) throw AppError.notFound("User not found", "AlertService");

    const superAdmin = await this.isSuperAdmin(user as any);
    const { category, severity, status, startDate, endDate, pagination, sortOptions } = filters;
    const { currentPage, limit, skip } = pagination;
    const { sortBy } = sortOptions;

    logger.debug("getAlerts sortBy", { sortBy });

    const scopeKey = superAdmin ? "all" : user.agencyId;
    const cacheKey = `${scopeKey}-${category ?? "all"}-${severity ?? "all"}-${status ?? "all"}-${startDate ?? "all"}-${endDate ?? "all"}-${currentPage}-${limit}`;

    return this.cache.getOrSet(
      cacheConstants.keys.ALERT.LIST,
      cacheKey,
      async () => {
        const where: any = {};

        // Super admin sees all agencies; all others scoped to their agency
        if (!superAdmin) {
          where.agencyId = user.agencyId;
        }

        if (category) where.category = category;
        if (severity) where.severity = severity;
        if (status) where.status = status;
        if (startDate || endDate) {
          where.createdAt = {};
          if (startDate) where.createdAt.gte = startDate;
          if (endDate) where.createdAt.lte = endDate;
        }

        const [alerts, total] = await Promise.all([
          prisma.alert.findMany({
            where,
            skip,
            take: limit,
            orderBy: sortBy,
            include: {
              createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
              agency: { select: { id: true, name: true, type: true } },
              targets: {
                include: {
                  state: { select: { name: true } },
                  lga: { select: { name: true } },
                  ward: { select: { name: true } },
                },
              },
              _count: { select: { deliveries: true } },
            },
          }),
          prisma.alert.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
          data: alerts,
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
      cacheConstants.ttl.SHORT
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // GET ALERT BY ID
  // Super admin: can view any agency's alert
  // All others:  own agency only
  // ─────────────────────────────────────────────────────────────────

  static async getAlertById(alertId: string, userId: string): Promise<IAlertData> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        agency: { select: { id: true, type: true, jurisdictionLevel: true } },
      },
    });

    if (!user) throw AppError.notFound("User not found", "AlertService");

    const superAdmin = await this.isSuperAdmin(user as any);

    return this.cache.getOrSet(
      cacheConstants.keys.ALERT.BY_ID,
      alertId,
      async () => {
        const alert = await prisma.alert.findUnique({
          where: { id: alertId },
          include: {
            agency: { select: { id: true, name: true, type: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            targets: {
              include: {
                state: { select: { name: true } },
                lga: { select: { name: true } },
                ward: { select: { name: true } },
              },
            },
            deliveries: {
              select: {
                id: true,
                status: true,
                queuedAt: true,
                sentAt: true,
                deliveredAt: true,
                failureReason: true,
              },
              take: 100,
            },
            cancelledBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            sentBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        });

        if (!alert) throw AppError.notFound("Alert not found", "AlertService");

        if (!superAdmin && user.agencyId !== alert.agencyId) {
          throw AppError.forbidden(
            "You can only view alerts from your own agency",
            "AlertService"
          );
        }

        return mapToAlertData(alert);
      },
      cacheConstants.ttl.SHORT
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // GET ALERT STATS
  // Super admin: can view stats for any agency's alert
  // All others:  own agency only
  // ─────────────────────────────────────────────────────────────────

  static async getAlertStats(alertId: string, userId: string): Promise<IAlertStatsData> {
    const [alert, user] = await Promise.all([
      prisma.alert.findUnique({
        where: { id: alertId },
        select: { id: true, agencyId: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          agency: { select: { id: true, type: true, jurisdictionLevel: true } },
        },
      }),
    ]);

    if (!alert) throw AppError.notFound("Alert not found", "AlertService");
    if (!user) throw AppError.notFound("User not found", "AlertService");

    const superAdmin = await this.isSuperAdmin(user as any);

    if (!superAdmin && user.agencyId !== alert.agencyId) {
      throw AppError.forbidden(
        "You do not have permission to view stats for this alert",
        "AlertService"
      );
    }

    const statsGrouped = await prisma.deliveredAlert.groupBy({
      by: ["status"],
      where: { alertId },
      _count: { _all: true },
    });

    const stats = { total: 0, queued: 0, sent: 0, delivered: 0, failed: 0 };

    for (const group of statsGrouped) {
      const count = group._count._all;
      stats.total += count;
      switch (group.status) {
        case DeliveryStatus.QUEUED:    stats.queued    = count; break;
        case DeliveryStatus.SENT:      stats.sent      = count; break;
        case DeliveryStatus.DELIVERED: stats.delivered = count; break;
        case DeliveryStatus.FAILED:    stats.failed    = count; break;
      }
    }

    const successRate = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;
    const failureRate = stats.total > 0 ? (stats.failed   / stats.total) * 100 : 0;

    return {
      total:       stats.total,
      queued:      stats.queued,
      sent:        stats.sent,
      delivered:   stats.delivered,
      failed:      stats.failed,
      pending:     stats.queued + stats.sent,
      successRate: parseFloat(successRate.toFixed(2)),
      failureRate: parseFloat(failureRate.toFixed(2)),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────

  private static formatSMSMessage(headline: string, description: string, severity: string): string {
    const severityEmoji: Record<string, string> = {
      EXTREME: "🔴",
      SEVERE:  "🟠",
      MODERATE:"🟡",
      MINOR:   "🟢",
    };
    const emoji = severityEmoji[severity] ?? "⚠️";
    return `${emoji} ${this.APP_NAME?.toUpperCase()} - ${severity}\n\n${headline}\n\n${description}\n\nStay safe and follow instructions from authorities.`;
  }

  private static generateAreaDescription(targets: any[]): string {
    return targets
      .map((t) => t.state?.name ?? t.lga?.name ?? t.ward?.name ?? "Custom Area")
      .join(", ");
  }

  private static formatTargetLocations(targets: any[]): string {
    return targets
      .map((t) => {
        if (t.targetType === TargetType.STATE && t.state) return t.state.name;
        if (t.targetType === TargetType.LGA   && t.lga)   return t.lga.name;
        if (t.targetType === TargetType.WARD  && t.ward)  return t.ward.name;
        if (
          [TargetType.POLYGON, TargetType.RADIUS, TargetType.PATH].includes(t.targetType) &&
          t.locationName
        ) {
          return t.locationName;
        }
        return "Custom Area";
      })
      .join(", ");
  }

  static async getLocationFromJurisdiction(
    targetType: TargetType,
    id: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    const tableMap: Partial<Record<TargetType, string>> = {
      [TargetType.STATE]: "states",
      [TargetType.LGA]:   "lgas",
      [TargetType.WARD]:  "wards",
    };

    const tableName = tableMap[targetType];
    if (!tableName) return null;

    try {
      const result = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
           ST_X(ST_Centroid(boundary::geometry)) as longitude,
           ST_Y(ST_Centroid(boundary::geometry)) as latitude
         FROM "${tableName}"
         WHERE id = $1`,
        id
      );
      return result.length > 0
        ? { latitude: result[0].latitude, longitude: result[0].longitude }
        : null;
    } catch {
      return null;
    }
  }

  private static async updateTargetGeometry(
    tx: any,
    targetId: string,
    target: IAlertTarget
  ): Promise<void> {
    if (!target.geometry) return;

    switch (target.targetType) {
      case TargetType.RADIUS:
        if (target.geometry.type === "Point") {
          const [longitude, latitude] = target.geometry.coordinates;
          await tx.$executeRawUnsafe(
            `UPDATE alert_targets SET center_point = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
            longitude, latitude, targetId
          );
        }
        break;

      case TargetType.POLYGON:
        if (target.geometry.type === "Polygon") {
          await tx.$executeRawUnsafe(
            `UPDATE alert_targets SET target_polygon = ST_GeomFromText($1, 4326) WHERE id = $2`,
            this.geoJSONPolygonToWKT(target.geometry), targetId
          );
        }
        break;

      case TargetType.PATH:
        if (target.geometry.type === "LineString") {
          await tx.$executeRawUnsafe(
            `UPDATE alert_targets SET target_path = ST_GeomFromText($1, 4326) WHERE id = $2`,
            this.geoJSONLineStringToWKT(target.geometry), targetId
          );
        }
        break;
    }
  }

  private static geoJSONPolygonToWKT(polygon: IGeoJSONPolygon): string {
    const rings = polygon.coordinates.map((ring) =>
      ring.map(([lng, lat]) => `${lng} ${lat}`).join(", ")
    );
    return `POLYGON((${rings.join("), (")}))`;
  }

  private static geoJSONLineStringToWKT(lineString: IGeoJSONLineString): string {
    const points = lineString.coordinates.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
    return `LINESTRING(${points})`;
  }
}