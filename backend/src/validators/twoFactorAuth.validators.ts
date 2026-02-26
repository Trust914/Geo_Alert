import { z } from "zod";

export const setupTOTPSchema = z.object({
  body: z.object({}), // No body needed for setup
});

export const verifyTOTPSchema = z.object({
  body: z.object({
    token: z
      .string()
      .length(6, "Verification code must be 6 digits")
      .regex(/^\d{6}$/, "Verification code must contain only digits"),
  }),
});

export const verifyEmailSetupSchema = z.object({
  body: z.object({
    code: z.string().min(6, "Invalid verification code"),
  }),
});

export const disable2FASchema = z.object({
  body: z.object({
    password: z.string().min(1, "Password required to disable 2FA"),
  }),
});
