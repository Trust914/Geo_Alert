import { z } from "zod";
import { AlertCategory, AlertStatus, Severity, TargetType, Urgency } from "../prisma/prisma/generated/enums.js";
import { serverConfig } from "../config/server.config.js";

/**
 * Geo point schema
 */
const geoPointSchema = z.object({
  latitude: z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
  longitude: z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
});

const geoJSONPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

const geoJSONPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

const geoJSONLineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
});

// Accept multiple geometry types
const geometrySchema = z.union([geoJSONPointSchema, geoJSONPolygonSchema, geoJSONLineStringSchema]);

/**
 * Alert target validation schema
 */
const alertTargetSchema = z.discriminatedUnion("targetType", [
  // STATE target
  z.object({
    targetType: z.literal(TargetType.STATE),
    stateId: z.cuid2("Invalid state ID"),
    lgaId: z.cuid2().optional(),
    wardId: z.cuid2().optional(),
    locationName: z.string().optional(),
  }),
  // LGA target
  z.object({
    targetType: z.literal(TargetType.LGA),
    stateId: z.cuid2("Invalid state ID").optional(),
    lgaId: z.cuid2("Invalid LGA ID"),
    wardId: z.cuid2().optional(),
    locationName: z.string().optional(),
  }),
  // WARD target
  z.object({
    targetType: z.literal(TargetType.WARD),
    stateId: z.cuid2().optional(),
    lgaId: z.cuid2().optional(),
    wardId: z.cuid2("Invalid ward ID"),
    locationName: z.string().optional(),
  }),
  // RADIUS (frontend sends Polygon representing circle)
  z.object({
    targetType: z.literal(TargetType.RADIUS),
    geometry: geoJSONPolygonSchema, // Accept Polygon for circle approximation
    radiusMeters: z.number().min(100, "Radius must be at least 100 meters").max(100000, "Radius cannot exceed 100km"),
    locationName: z.string().optional(),
  }),
  // POLYGON (frontend sends Polygon)
  z.object({
    targetType: z.literal(TargetType.POLYGON),
    geometry: geoJSONPolygonSchema,
    locationName: z.string().optional(),
  }),
  // PATH (frontend sends Polygon representing buffered path)
  z.object({
    targetType: z.literal(TargetType.PATH),
    geometry: geoJSONPolygonSchema, // Accept Polygon for buffered path
    bufferMeters: z.number().min(10, "Buffer must be at least 10 meters").max(50000, "Buffer cannot exceed 50km"),
    locationName: z.string().optional(),
  }),
]);

/**
 * Create alert validation schema
 */
export const createAlertSchema = z.object({
  body: z.object({
    category: z.enum(AlertCategory, {
      error: () => ({ message: "Invalid alert category" }),
    }),

    severity: z.enum(Severity, {
      error: () => ({ message: "Invalid severity level" }),
    }),

    urgency: z.enum(Urgency, {
      error: () => ({ message: "Invalid urgency level" }),
    }),

    headline: z.string().min(10, "Headline must be at least 10 characters").max(160, "Headline must not exceed 160 characters"),

    description: z.string().min(20, "Description must be at least 20 characters").max(918, "Description must not exceed 918 characters"),

    instruction: z.string().max(500, "Instruction must not exceed 500 characters").optional().or(z.literal("")),

    expiresAt: z.iso
      .datetime("Invalid date format")
      .or(z.date())
      .refine((date) => new Date(date) > new Date(), "Expiration date must be in the future")
      .optional(),

    incidentLocation: geoPointSchema.optional(),

    targets: z.array(alertTargetSchema).min(1, "At least one target area is required"),
  }),
});

/**
 * Cancel alert validation schema
 */
export const cancelAlertSchema = z.object({
  body: z.object({
    reason: z.string().min(10, "Cancellation reason must be at least 10 characters").max(500, "Cancellation reason must not exceed 500 characters"),
  }),
});

/**
 * Alert filters validation schema
 */
export const alertFiltersSchema = z.object({
  query: z
    .object({
      category: z.enum(AlertCategory).optional(),
      severity: z.enum(Severity).optional(),
      status: z.enum(AlertStatus).optional(),
      startDate: z.iso.datetime().or(z.date()).optional(),
      endDate: z.iso.datetime().or(z.date()).optional(),
      currentPage: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(serverConfig.pagination.defaultLimit),
    })
    .refine(
      (data) => {
        if (data.startDate && data.endDate) {
          return new Date(data.endDate) > new Date(data.startDate);
        }
        return true;
      },
      {
        message: "End date must be after start date",
        path: ["endDate"],
      },
    ),
});

export const alertIdSchema = z.object({
  params: z.object({
    alertId: z.cuid2("Invalid alert ID format"),
  }),
});

/**
 * Estimate recipients validation schema
 */
export const estimateRecipientsSchema = z.object({
  body: z.object({
    targets: z.array(alertTargetSchema).min(1, "At least one target area is required"),
  }),
});

export const DeliveryReportSchema = z.object({
  body: z.object({
    id: z.string().min(1, "Message ID is required"),
    status: z.string().min(1, "Status is required"),
    phoneNumber: z.string().optional(),
    networkCode: z.string().optional(),
    failureReason: z.string().optional(),
    retryCount: z.coerce.number().optional(), // Using coerce because AT sends "0" (string) but we want 0 (number)
  }),
});

export const BatchDeliveryReportSchema = z.object({
  body: z.array(
    z.object({
      id: z.string().min(1, "Message ID is required"),
      status: z.string().min(1, "Status is required"),
      phoneNumber: z.string().optional(),
      networkCode: z.string().optional(),
      failureReason: z.string().optional(),
      retryCount: z.coerce.number().optional(),
    }),
  ),
});

export const IncomingSMSSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  text: z.string().min(1),
  date: z.string().optional(),
  id: z.string().optional(),
  linkId: z.string().optional(),
});
