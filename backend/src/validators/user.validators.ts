import { z } from "zod";
import { UserRole } from "../prisma/prisma/generated/enums.js";

export const createUserSchema = z.object({
  body: z.object({
    email: z
      .string({
        error: "Email is required",
      })
      .email("Invalid email format")
      .toLowerCase()
      .trim(),

    firstName: z
      .string({
        error: "First name is required",
      })
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name must not exceed 50 characters")
      .trim(),

    lastName: z
      .string({
        error: "Last name is required",
      })
      .min(2, "Last name must be at least 2 characters")
      .max(50, "Last name must not exceed 50 characters")
      .trim(),

    role: z.enum(UserRole, {
      error: "Invalid role. Must be ADMIN, COORDINATOR, OPERATOR, or VIEWER",
    }),

    agencyId: z.cuid2("Invalid agency ID format").optional(),
    // .string({
    //   error: "Agency ID is required",
    // })
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().cuid2("Invalid user ID format"),
  }),
  body: z.object({
    firstName: z.string().min(2, "First name must be at least 2 characters").max(50, "First name must not exceed 50 characters").trim().optional(),

    lastName: z.string().min(2, "Last name must be at least 2 characters").max(50, "Last name must not exceed 50 characters").trim().optional(),

    role: z.enum(UserRole).optional(),

    isActive: z.boolean().optional(),
  }),
});

export const userIdSchema = z.object({
  params: z.object({
    id: z
      // .string()
      .cuid2("Invalid user ID format"),
  }),
});

export const userFiltersSchema = z.object({
  params: z.object({
    agencyId: z.string().cuid2("Invalid agency ID format"),
  }),
  query: z.object({
    role: z.enum(UserRole).optional(),
    isActive: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    search: z.string().trim().optional(),
    currentPage: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});
