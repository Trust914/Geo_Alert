/**
 * TwoFactorService — Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TwoFactorMethod } from "../../prisma/prisma/generated/enums.js";
import { AppError } from "../../utils/error.util.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    user: { update: vi.fn(), findUnique: vi.fn() },
  },
}));

// FIX: Use vi.hoisted so the SAME cache object is shared between the mock
// factory and the test bodies.  Without hoisting, getCacheService() returns
// a brand-new object on every call, so mock return values set in a test
// target a different instance than the one the service uses internally.
const mockCache = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(null),
  deletePattern: vi.fn().mockResolvedValue(null),
  increment: vi.fn().mockResolvedValue(1),
}));

vi.mock("../../services/cache.service.js", () => ({
  getCacheService: vi.fn().mockReturnValue(mockCache),
}));

vi.mock("../../utils/auditLog.util.js", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/encrytion.util.js", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted::secret"),
  decrypt: vi.fn().mockReturnValue("JBSWY3DPEHPK3PXP"),
}));

vi.mock("../../services/jwt.service.js", () => ({
  JWTService: {
    hashPasswordArgon2: vi.fn().mockImplementation(async (code: string) => `hashed-${code}`),
    verifyPasswordArgon2: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("otplib", () => ({
  authenticator: {
    options: {},
    generateSecret: vi.fn().mockReturnValue("JBSWY3DPEHPK3PXP"),
    keyuri: vi.fn().mockReturnValue("otpauth://totp/GEOALERT:user@test.com?secret=TEST"),
    verify: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,fake-qr-code"),
  },
}));

vi.mock("../../config/server.config.js", () => ({
  serverConfig: { app: { name: "GEOALERT_API" } },
}));

vi.mock("../../rabbitmq/rabbitmq.queue.js", () => ({
  RabbitMQService: { publish: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../config/cache.constants.js", () => ({
  cacheConstants: {
    keys: {
      AUTH: {
        TOTP_SETUP: "auth:totp_setup",
        OTP: "auth:otp",
        VERIFY_ATTEMPTS: "auth:verify_attempts",
        OTP_COOLDOWN: "auth:otp_cooldown",
        SETUP_ATTEMPTS: "auth:setup_attempts",
        OTP_REQUESTS: "auth:otp_requests",
      },
    },
    ttl: {
      SHORT: 300,
      VERY_SHORT: 60,
      MEDIUM: 900,
    },
  },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { TwoFactorService } from "../../services/twoFactorAuth.service.js";
import { prisma } from "../../lib/prisma.js";
import { getCacheService } from "../../services/cache.service.js";
import { authenticator } from "otplib";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TwoFactorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset cache defaults after vi.clearAllMocks() clears call counts.
    // Without this, a previous test's mockResolvedValue(X) leaks into
    // subsequent tests that don't explicitly set their own return values.
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(null);
    mockCache.delete.mockResolvedValue(null);
    mockCache.deletePattern.mockResolvedValue(null);
    mockCache.increment.mockResolvedValue(1);
  });

  // ── generateTOTPSetup ───────────────────────────────────────────────────────

  describe("generateTOTPSetup", () => {
    it("returns secret, QR code URL, and 10 backup codes", async () => {
      const result = await TwoFactorService.generateTOTPSetup("user-001", "user@test.com");

      expect(result).toMatchObject({
        secret: expect.any(String),
        qrCodeUrl: expect.stringContaining("data:image/png"),
        otpAuthUrl: expect.stringContaining("otpauth://"),
        backupCodes: expect.arrayContaining([expect.any(String)]),
      });
      expect(result.backupCodes).toHaveLength(10);
    });

    it("caches the pending TOTP setup", async () => {
      await TwoFactorService.generateTOTPSetup("user-001", "user@test.com");

      expect(mockCache.set).toHaveBeenCalledWith(
        "auth:totp_setup",
        "user-001",
        expect.objectContaining({
          secret: expect.any(String),
          backupCodes: expect.any(Array),
        }),
        expect.any(Number),
      );
    });
  });

  // ── verifyAndEnableTOTP ─────────────────────────────────────────────────────

  describe("verifyAndEnableTOTP", () => {
    const cachedSetup = {
      secret: "JBSWY3DPEHPK3PXP",
      backupCodes: Array.from({ length: 10 }, (_, i) => `backup-code-${i}`),
      timestamp: Date.now(),
    };

    it("enables TOTP when token is valid", async () => {
      mockCache.get.mockResolvedValue(cachedSetup);
      (authenticator.verify as any).mockReturnValue(true);
      (prisma.user.update as any).mockResolvedValue({ id: "user-001" });

      const result = await TwoFactorService.verifyAndEnableTOTP("user-001", "123456");

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isTwoFactorEnabled: true,
            twoFactorMethod: TwoFactorMethod.GOOGLE_AUTHENTICATOR,
          }),
        })
      );
      expect(result.backupCodes).toHaveLength(10);
    });

    it("throws bad request when no pending setup exists", async () => {
      mockCache.get.mockResolvedValue(null);

      await expect(
        TwoFactorService.verifyAndEnableTOTP("user-001", "123456")
      ).rejects.toThrow(AppError);
    });

    it("throws unauthorized when TOTP token is invalid", async () => {
      mockCache.get.mockResolvedValue(cachedSetup);
      (authenticator.verify as any).mockReturnValue(false);

      await expect(
        TwoFactorService.verifyAndEnableTOTP("user-001", "wrong-token")
      ).rejects.toThrow(AppError);
    });
  });

  // ── verifyTOTP ──────────────────────────────────────────────────────────────

  describe("verifyTOTP", () => {
    it("returns true for a valid TOTP token", async () => {
      mockCache.increment.mockResolvedValue(1);
      mockCache.get.mockResolvedValue(null); // no lockout
      (authenticator.verify as any).mockReturnValue(true);

      const isValid = await TwoFactorService.verifyTOTP("user-001", "123456", "encrypted::secret");

      expect(isValid).toBe(true);
    });

    it("returns false for an invalid TOTP token", async () => {
      mockCache.increment.mockResolvedValue(1);
      mockCache.get.mockResolvedValue(null);
      (authenticator.verify as any).mockReturnValue(false);

      const isValid = await TwoFactorService.verifyTOTP("user-001", "000000", "encrypted::secret");

      expect(isValid).toBe(false);
    });

    it("throws when verification attempt limit is exceeded", async () => {
      mockCache.get.mockResolvedValue(10); // over the limit

      await expect(
        TwoFactorService.verifyTOTP("user-001", "123456", "encrypted::secret")
      ).rejects.toThrow(AppError);
    });
  });

  // ── verifyEmailOTP ──────────────────────────────────────────────────────────

  describe("verifyEmailOTP", () => {
    it("returns true when OTP matches the cached value", async () => {
      mockCache.get
        .mockResolvedValueOnce(null)           // no lockout
        .mockResolvedValueOnce("hashed-654321"); // cached OTP

      const { JWTService } = await import("../../services/jwt.service.js");
      (JWTService.verifyPasswordArgon2 as any).mockResolvedValue(true);

      const isValid = await TwoFactorService.verifyEmailOTP("user-001", "654321");

      expect(isValid).toBe(true);
    });

    it("throws not found when OTP has expired or was never sent", async () => {
      mockCache.get
        .mockResolvedValueOnce(null) // no lockout
        .mockResolvedValueOnce(null); // no OTP in cache

      await expect(
        TwoFactorService.verifyEmailOTP("user-001", "654321")
      ).rejects.toThrow(AppError);
    });
  });

  // ── disable2FA ──────────────────────────────────────────────────────────────

  describe("disable2FA", () => {
    it("disables 2FA after successful password verification", async () => {
      const userWith2FA = {
        id: "user-001",
        passwordHash: "$argon2id$hash",
        isTwoFactorEnabled: true,
        twoFactorMethod: TwoFactorMethod.EMAIL,
      };
      (prisma.user.findUnique as any).mockResolvedValue(userWith2FA);
      (prisma.user.update as any).mockResolvedValue({ ...userWith2FA, isTwoFactorEnabled: false });

      const { JWTService } = await import("../../services/jwt.service.js");
      (JWTService.verifyPasswordArgon2 as any).mockResolvedValue(true);

      await TwoFactorService.disable2FA("user-001", "correct-password");

      // FIX: The service sets twoFactorMethod to the enum string "NONE" (not null)
      // and also clears twoFactorBackupCodes.  Use objectContaining so the
      // assertion is resilient to additional fields the service may write.
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isTwoFactorEnabled: false,
            twoFactorMethod: "NONE",
            twoFactorSecret: null,
          }),
        })
      );
    });

    it("throws unauthorized when password is incorrect", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-001",
        passwordHash: "$argon2id$hash",
        isTwoFactorEnabled: true,
      });

      const { JWTService } = await import("../../services/jwt.service.js");
      (JWTService.verifyPasswordArgon2 as any).mockResolvedValue(false);

      await expect(
        TwoFactorService.disable2FA("user-001", "wrong-password")
      ).rejects.toThrow(AppError);
    });
  });

  // ── regenerateBackupCodes ───────────────────────────────────────────────────

  describe("regenerateBackupCodes", () => {
    it("generates 10 new backup codes and updates the user", async () => {
      (prisma.user.update as any).mockResolvedValue({ id: "user-001" });

      const result = await TwoFactorService.regenerateBackupCodes("user-001");

      expect(result.backupCodes).toHaveLength(10);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            twoFactorBackupCodes: expect.arrayContaining([expect.any(String)]),
          }),
        })
      );
    });
  });

  // ── verifyBackupCode ────────────────────────────────────────────────────────

  describe("verifyBackupCode", () => {
    it("returns true and removes the used code from the stored list", async () => {
      const { JWTService } = await import("../../services/jwt.service.js");
      (JWTService.verifyPasswordArgon2 as any)
        .mockResolvedValueOnce(false) // first code doesn't match
        .mockResolvedValueOnce(true); // second matches

      (prisma.user.update as any).mockResolvedValue({ id: "user-001" });

      const hashedCodes = ["hashed-code-0", "hashed-code-1", "hashed-code-2"];
      const isValid = await TwoFactorService.verifyBackupCode("user-001", "plain-code-1", hashedCodes);

      expect(isValid).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            twoFactorBackupCodes: expect.not.arrayContaining(["hashed-code-1"]),
          }),
        })
      );
    });

    it("returns false when no backup code matches", async () => {
      const { JWTService } = await import("../../services/jwt.service.js");
      (JWTService.verifyPasswordArgon2 as any).mockResolvedValue(false);

      const isValid = await TwoFactorService.verifyBackupCode(
        "user-001",
        "invalid-code",
        ["hashed-code-0", "hashed-code-1"]
      );

      expect(isValid).toBe(false);
    });
  });
});