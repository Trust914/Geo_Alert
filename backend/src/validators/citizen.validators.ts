import { z } from "zod";
import { Language } from "../prisma/prisma/generated/enums.js";
import { serverConfig } from "../config/server.config.js";

const phoneRegex = /^(\+234|234|0)[789]\d{9}$/;

export const registerCitizenSchema = z.object({
  body: z.object({
    phoneNumber: z.string().regex(phoneRegex, "Invalid Nigerian phone number"),
    firstName: z.string().min(2, "First name must be at least 2 characters").max(50, "First name must not exceed 50 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters").max(50, "Last name must not exceed 50 characters"),
    stateId: z.string().cuid2("Invalid state ID"),
    lgaId: z.cuid2("Invalid LGA ID"),
    wardId: z.cuid2("Invalid ward ID").optional(),
    preferredLanguage: z.nativeEnum(Language).optional(),
    location: z
      .object({
        latitude: z.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
        longitude: z.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
      })
      .optional(),
  }),
});

export const updateCitizenSchema = z.object({
  params: z.object({
    phoneNumber: z.string().regex(phoneRegex, "Invalid phone number"),
  }),
  body: z.object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    stateId: z.cuid2().optional(),
    lgaId: z.cuid2().optional(),
    wardId: z.cuid2().optional(),
    preferredLanguage: z.enum(Language).optional(),
    isOptedIn: z.boolean().optional(),
    location: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .optional(),
  }),
});

export const citizenPhoneSchema = z.object({
  params: z.object({
    phoneNumber: z.string().regex(phoneRegex, "Invalid phone number"),
  }),
});

export const citizenFilterSchema = z.object({
  query: z.object({
    stateId: z.cuid2("Invalid state ID format").optional(),
    lgaId: z.cuid2("Invalid LGA ID format").optional(),
    wardId: z.cuid2("Invalid ward ID format").optional(),
    isOptedIn: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    search: z.string().trim().optional(),
    currentPage: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(serverConfig.pagination.defaultLimit),
  }),
});

export const citizensNearbySchema = z.object({
  query: z.object({
    latitude: z.coerce
      .number({
        error: "Latitude is required",
      })
      .min(-90, "Latitude must be between -90 and 90")
      .max(90, "Latitude must be between -90 and 90"),

    longitude: z.coerce
      .number({
        error: "Longitude is required",
      })
      .min(-180, "Longitude must be between -180 and 180")
      .max(180, "Longitude must be between -180 and 180"),

    radiusKm: z.coerce
      .number({
        error: "Radius must be a number",
      })
      .min(0.1, "Radius must be at least 0.1km")
      .max(1000, "Radius cannot exceed 1000km")
      .default(10),

    // limit: z.coerce
    //   .number({
    //     error: "Limit must be a number",
    //   })
    //   .int("Limit must be an integer")
    //   .min(1, "Limit must be at least 1")
    //   .max(1000, "Limit cannot exceed 1000")
    //   .default(100),
  }),
});
