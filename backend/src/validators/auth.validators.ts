import { z } from "zod";
import { ActionType, EntityType } from "../prisma/prisma/generated/enums";
import { passwordSchema } from "./activation.validators";
import { serverConfig } from "../config/server.config";

export const loginSchema = z.object({
  body: z.object({
    email: z
      // .string({
      //   error: "Email is required",
      // })
      .email("Invalid email format")
      .toLowerCase()
      .trim(),
    password: z
      .string({
        error: "Password is required",
      })
      .min(1, "Password is required"),
  }),
});

export const verify2FASchema = z.object({
  body: z.object({
    code: z
      .string({
        error: "Verification code is required",
      })
      .trim()
      .refine(
        (code) => /^\d{6}$/.test(code) || /^[A-Z0-9]{8}$/.test(code),
        "Code must be either 6 digits (OTP/TOTP) or 8 characters (backup code)"
      ),

    isBackupCode: z.boolean().optional().default(false),
  }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z
        .string({
          error: "Current password is required",
        })
        .min(1, "Current password is required"),
      newPassword: passwordSchema,
      confirmPassword: z
        .string({
          error: "Confirm password is required",
        })
        .min(1, "Confirm password is required"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: "New password must be different from current password",
      path: ["newPassword"],
    }),
});

export const hardResetPasswordSchema = z.object({
  body: z
    .object({
      newPassword: passwordSchema,
      confirmPassword: z
        .string({
          error: "Confirm password is required",
        })
        .min(1, "Confirm password is required"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    })

});

export const auditLogFiltersSchema = z.object({
  query: z.object({
    action: z.enum(ActionType).optional(),
    entityType: z.enum(EntityType).optional(),
    userId: z.cuid2("Invalid user ID format").optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    currentPage: z.coerce.number().int().min(1).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(serverConfig.pagination.defaultLimit),
  }),
});

export const agencyAuditLogFiltersSchema = z.object({
  query: z
    .object({
      action: z.enum(ActionType).optional(),
      entityType: z.enum(EntityType).optional(),
      userId: z.cuid2("Invalid user ID format").optional(),
      startDate: z.iso.datetime().optional(),
      endDate: z.iso.datetime().optional(),
      currentPage: z.coerce.number().int().min(1).default(1),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(serverConfig.pagination.defaultLimit),
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
      }
    ),
});

/**
 * Reset password token verification (admin-initiated)
 */
export const verifyResetTokenSchema = z.object({
  query: z.object({
    token: z
      .string({
        error: "Reset token is required",
      })
      .min(1, "Reset token cannot be empty")
      .max(256, "Invalid token format"),

    userId: z
      .cuid2("Invalid user ID format"),
  }),
});

/**
 * Complete password reset (admin-initiated)
 */
export const completePasswordResetSchema = z.object({
  body: z
    .object({
      userId: z.cuid2("Invalid user ID format"),

      token: z
        .string({
          error: "Reset token is required",
        })
        .min(1, "Reset token cannot be empty")
        .max(256, "Invalid token format"),

      newPassword: passwordSchema,

      confirmPassword: z
        .string({
          error: "Password confirmation is required",
        })
        .min(1, "Password confirmation cannot be empty"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});