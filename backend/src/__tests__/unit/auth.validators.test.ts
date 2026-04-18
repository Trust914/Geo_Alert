import { describe, it, expect, vi } from "vitest";

// FIX: auth.validators.ts imports serverConfig which calls checkIfDefined() at
// module-evaluation time. The mock must include ALL properties the validators
// file actually reads, including `pagination.defaultLimit` (line 85 of
// auth.validators.ts) which was previously missing and caused:
//   TypeError: Cannot read properties of undefined (reading 'defaultLimit')
vi.mock("../../config/server.config.js", () => ({
  serverConfig: {
    app: {
      name: "GeoAlert",
      environment: "test",
      version: "1.0.0",
    },
    pagination: {
      defaultLimit: 20,
      maxLimit: 100,
    },
  },
}));

import {
  changePasswordSchema,
  hardResetPasswordSchema,
  loginSchema,
  verify2FASchema,
} from "../../validators/auth.validators.js";

describe("Auth Validators", () => {
  describe("loginSchema", () => {
    it("should validate valid login data", () => {
      const validData = {
        body: {
          email: "test@example.com",
          password: "password123",
        },
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.email).toBe("test@example.com");
        expect(result.data.body.password).toBe("password123");
      }
    });

    it("should convert email to lowercase and trim", () => {
      const data = {
        body: {
          email: "TEST@EXAMPLE.COM",
          password: "password123",
        },
      };

      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.email).toBe("test@example.com");
      }
    });

    it("should reject invalid email", () => {
      const invalidData = {
        body: {
          email: "invalid-email",
          password: "password123",
        },
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(["body", "email"]);
      }
    });

    it("should reject missing password", () => {
      const invalidData = {
        body: {
          email: "test@example.com",
        },
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(["body", "password"]);
      }
    });

    it("should reject empty password", () => {
      const invalidData = {
        body: {
          email: "test@example.com",
          password: "",
        },
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(["body", "password"]);
      }
    });
  });

  describe("verify2FASchema", () => {
    it("should validate valid 6-digit OTP code", () => {
      const validData = {
        body: {
          code: "123456",
        },
      };

      const result = verify2FASchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.code).toBe("123456");
        expect(result.data.body.isBackupCode).toBe(false);
      }
    });

    it("should validate valid 8-character backup code", () => {
      const validData = {
        body: {
          code: "ABC12345",
        },
      };

      const result = verify2FASchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.code).toBe("ABC12345");
      }
    });

    it("should trim whitespace from code", () => {
      const data = {
        body: {
          code: "  123456  ",
        },
      };

      const result = verify2FASchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.code).toBe("123456");
      }
    });

    it("should accept isBackupCode flag", () => {
      const data = {
        body: {
          code: "123456",
          isBackupCode: true,
        },
      };

      const result = verify2FASchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.isBackupCode).toBe(true);
      }
    });

    it("should reject invalid code format", () => {
      const invalidData = {
        body: {
          code: "12345", // Too short
        },
      };

      const result = verify2FASchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Code must be either 6 digits");
      }
    });

    it("should reject missing code", () => {
      const invalidData = {
        body: {},
      };

      const result = verify2FASchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(["body", "code"]);
      }
    });
  });

  describe("changePasswordSchema", () => {
    it("should validate valid password change data", () => {
      const validData = {
        body: {
          currentPassword: "oldpassword123",
          newPassword: "Newpassword123!",
          confirmPassword: "Newpassword123!",
        },
      };

      const result = changePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject when passwords do not match", () => {
      const invalidData = {
        body: {
          currentPassword: "oldpassword123",
          newPassword: "Newpassword123!",
          confirmPassword: "Differentpassword123!",
        },
      };

      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Passwords do not match");
        expect(result.error.issues[0]?.path).toEqual(["body", "confirmPassword"]);
      }
    });

    it("should reject when new password is same as current", () => {
      const invalidData = {
        body: {
          currentPassword: "Samepassword123!",
          newPassword: "Samepassword123!",
          confirmPassword: "Samepassword123!",
        },
      };

      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "New password must be different from current password"
        );
        expect(result.error.issues[0]?.path).toEqual(["body", "newPassword"]);
      }
    });
  });

  describe("hardResetPasswordSchema", () => {
    it("should validate valid password reset data", () => {
      const validData = {
        body: {
          newPassword: "Newpassword123!",
          confirmPassword: "Newpassword123!",
        },
      };

      const result = hardResetPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject when passwords do not match", () => {
      const invalidData = {
        body: {
          newPassword: "Newpassword123!",
          confirmPassword: "Differentpassword123!",
        },
      };

      const result = hardResetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Passwords do not match");
      }
    });
  });
});