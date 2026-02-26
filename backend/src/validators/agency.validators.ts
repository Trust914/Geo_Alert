import { z } from "zod";
import { AgencyStatus, AgencyType, JurisdictionLevel } from "../prisma/prisma/generated/enums.js";
import { serverConfig } from "../config/server.config.js";
// import { AgencyStatus, AgencyType, JurisdictionLevel } from "../types/enums.js";

export const createAgencySchema = z.object({
  body: z
    .object({
      name: z.string().min(3, "Agency name must be at least 3 characters").max(200, "Agency name must not exceed 200 characters").trim(),

      type: z.enum(AgencyType, {
        error: "Invalid agency type",
      }),

      jurisdiction: z.string().min(3, "Jurisdiction must be at least 3 characters").max(200, "Jurisdiction must not exceed 200 characters").trim(),

      jurisdictionLevel: z.enum(JurisdictionLevel, {
        error: "Invalid jurisdiction level",
      }),

      contactEmail: z
        .email("Invalid contact email format")
        //   .string()
        .toLowerCase()
        .trim(),

      contactPhone: z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
        .trim(),

      adminFirstName: z.string().min(2, "Admin first name must be at least 2 characters").trim(),

      adminLastName: z.string().min(2, "Admin last name must be at least 2 characters").trim(),

      adminEmail: z.string().email("Invalid admin email format").toLowerCase().trim(),
    })
    .refine(
      (data) => {
        // Validate jurisdiction level matches agency type
        const validCombinations: Record<AgencyType, JurisdictionLevel[]> = {
          [AgencyType.FEDERAL]: [JurisdictionLevel.NATIONAL],
          [AgencyType.STATE]: [JurisdictionLevel.STATE],
          [AgencyType.LOCAL]: [JurisdictionLevel.LGA, JurisdictionLevel.WARD],
          [AgencyType.SECURITY]: [JurisdictionLevel.NATIONAL, JurisdictionLevel.STATE, JurisdictionLevel.LGA, JurisdictionLevel.WARD],
          [AgencyType.HEALTH]: [JurisdictionLevel.NATIONAL, JurisdictionLevel.STATE, JurisdictionLevel.LGA, JurisdictionLevel.WARD],
          [AgencyType.EMERGENCY]: [JurisdictionLevel.NATIONAL, JurisdictionLevel.STATE, JurisdictionLevel.LGA, JurisdictionLevel.WARD],
        };

        const validLevels = validCombinations[data.type];
        return validLevels.includes(data.jurisdictionLevel);
      },
      {
        message: "Invalid combination: jurisdiction level does not match agency type",
        path: ["jurisdictionLevel"],
      },
    ),
});

export const updateAgencySchema = z.object({
  params: z.object({
    id: z.cuid2("Invalid agency ID format"),
  }),
  body: z.object({
    name: z.string().min(3).max(200).trim().optional(),
    jurisdiction: z.string().min(3).max(200).trim().optional(),
    contactEmail: z.string().email().toLowerCase().trim().optional(),
    contactPhone: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/)
      .trim()
      .optional(),
    status: z.enum(AgencyStatus).optional(),
  }),
});

export const agencyIdSchema = z.object({
  params: z.object({
    id: z.cuid2("Invalid agency ID format"),
  }),
});

export const agencyFiltersSchema = z.object({
  query: z.object({
    type: z.enum(AgencyType).optional(),
    jurisdictionLevel: z.enum(JurisdictionLevel).optional(),
    status: z.enum(AgencyStatus).optional(),
    search: z.string().trim().optional(),
    currentPage: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(serverConfig.pagination.defaultLimit),
  }),
});
