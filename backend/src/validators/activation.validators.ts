import { z } from "zod";

/**
 * Password strength validation schema
 * Enforces: min 8 chars, at least 3 of: uppercase, lowercase, numbers, special chars
 */
export const passwordSchema = z
  .string({
    error: "Password is required",
  })
  .min(8, "Password must be at least 8 characters long")
  .refine(
    (password) => {
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

      const criteriaMet = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

      return criteriaMet >= 3;
    },
    {
      message: "Password must contain at least 3 of: uppercase, lowercase, numbers, special characters",
    },
  );

/**
 * Verify activation token (GET request from email link)
 */
export const verifyTokenSchema = z.object({
  query: z.object({
    token: z
      .string({
        error: "Activation token is required",
      })
      .min(1, "Activation token cannot be empty"),

    userId: z
      //   .string({
      //     error: "User ID is required",
      //   })
      .cuid2("Invalid user ID format"),
  }),
});

/**
 * Complete activation (POST request with password)
 */
export const completePasswordChangeSchema = z.object({
  body: z
    .object({
      userId: z
        // .string({
        //   error: "User ID is required",
        // })
        .cuid2("Invalid user ID format"),

      token: z
        .string({
          error: "Activation token is required",
        })
        .min(1, "Activation token cannot be empty"),

      password: passwordSchema,

      confirmPassword: z
        .string({
          error: "Password confirmation is required",
        })
        .min(1, "Password confirmation cannot be empty"),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

/**
 * Resend activation email
 */
export const resendActivationEmailSchema = z.object({
  body: z.object({
    userId: z
      // .string({
      //   error: "User ID is required",
      // })
      .cuid2("Invalid user ID format"),
  }),
});
