/**
 * BFF Validators
 * Request validation schemas for BFF endpoints
 */

import { z } from "zod";

/**
 * Token Exchange Schema
 */
export const tokenExchangeSchema = z.object({
  body: z.discriminatedUnion("grantType", [
    // Password grant (initial login)
    z.object({
      grantType: z.literal("password"),
      email: z.email("Invalid email format").toLowerCase().trim(),
      password: z.string().min(1, "Password is required"),
      deviceFingerprint: z.string().optional(),
      platform: z.string().optional(),
      version: z.string().optional(),
    }),

    // Refresh token grant
    z.object({
      grantType: z.literal("refresh_token"),
      refreshToken: z.string().min(1, "Refresh token is required"),
    }),

    // Pre-auth grant (after 2FA)
    z.object({
      grantType: z.literal("pre_auth"),
      preAuthToken: z.string().min(1, "Pre-auth token is required"),
      twoFactorCode: z
        .string()
        .trim()
        .refine((code) => /^\d{6}$/.test(code) || /^[A-Z0-9]{8}$/.test(code), "Code must be either 6 digits (OTP/TOTP) or 8 characters (backup code)"),
      deviceFingerprint: z.string().optional(),
    }),
  ]),
});

/**
 * Token Refresh Schema
 */
export const tokenRefreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(), // Can come from cookie
    sessionId: z.string().optional(),
  }),
});

/**
 * Token Revocation Schema
 */
export const tokenRevocationSchema = z.object({
  body: z.object({
    tokenType: z.enum(["access", "refresh", "all"]).optional().default("all"),
    everywhere: z.boolean().optional().default(false),
  }),
});

/**
 * Session Extension Schema
 */
export const sessionExtensionSchema = z.object({
  body: z.object({
    extendBy: z
      .number()
      .int()
      .min(60 * 1000) // Minimum 1 minute
      .max(24 * 60 * 60 * 1000) // Maximum 24 hours
      .optional(),
  }),
});

/**
 * Device Fingerprint Schema
 */
export const deviceFingerprintSchema = z.object({
  userAgent: z.string(),
  platform: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  screenResolution: z.string().optional(),
  colorDepth: z.number().optional(),
});
