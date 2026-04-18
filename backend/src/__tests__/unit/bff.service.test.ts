/**
 * BFFService — Unit Tests
 *
 * Covers session validation, token refresh logic, login, 2FA, and logout flows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRole, AgencyStatus } from "../../prisma/prisma/generated/enums.js";
import { AppError } from "../../utils/error.util.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}));

// FIX: Use vi.hoisted so the SAME cache object is shared between the mock
// factory and the test bodies.
const mockCache = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(null),
  deletePattern: vi.fn().mockResolvedValue(null),
  list: vi.fn().mockResolvedValue([]),
  increment: vi.fn().mockResolvedValue(1),
}));

vi.mock("../../services/cache.service.js", () => ({
  getCacheService: vi.fn().mockReturnValue(mockCache),
}));

vi.mock("../../utils/auditLog.util.js", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/jwt.service.js", () => ({
  JWTService: {
    generateAccessToken: vi.fn().mockReturnValue("new-access-token"),
    generateRefreshToken: vi.fn().mockReturnValue("new-refresh-token"),
    verifyPasswordArgon2: vi.fn().mockResolvedValue(true),
    verifyRefreshToken: vi.fn().mockReturnValue({ userId: "user-001" }),
  },
}));

// FIX: The service calls RefreshTokenService.revokeRefreshToken (not .revoke).
// Using the correct method name prevents "revokeRefreshToken is not a function".
vi.mock("../../services/refreshToken.service.js", () => ({
  RefreshTokenService: {
    createRefreshToken: vi.fn().mockResolvedValue({
      token: "new-refresh-token",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }),
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
    findByToken: vi.fn().mockResolvedValue({
      token: "refresh-token",
      userId: "user-001",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }),
  },
}));

vi.mock("../../services/twoFactorAuth.service.js", () => ({
  TwoFactorService: {
    verifyTOTP: vi.fn().mockResolvedValue(true),
    verifyEmailOTP: vi.fn().mockResolvedValue(true),
    verifyBackupCode: vi.fn().mockResolvedValue(true),
    sendEmailOTP: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../config/bff.config.js", () => ({
  bffConfig: {
    session: {
      cookieName: "bff_session_id",
      idleTimeout: 30 * 60 * 1000,
      absoluteTimeout: 7 * 24 * 60 * 60 * 1000,
      tokenRefreshThreshold: 5 * 60 * 1000,
      maxSessions: 5,
    },
    security: { enableDeviceFingerprinting: false },
  },
  bffErrorCodes: {
    SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
    SESSION_INVALID: "SESSION_INVALID",
    SESSION_EXPIRED: "SESSION_EXPIRED",
    SESSION_IDLE_TIMEOUT: "SESSION_IDLE_TIMEOUT",
    DEVICE_FINGERPRINT_MISMATCH: "DEVICE_FINGERPRINT_MISMATCH",
  },
}));

// FIX: serverConfig must include rateLimiting — used by BFFService.login.
vi.mock("../../config/server.config.js", () => ({
  serverConfig: {
    app: { name: "GEOALERT_API" },
    rateLimiting: { loginMaxAttempts: 5 },
  },
}));

vi.mock("../../utils/logger.util.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// FIX: Add USER.BY_ID and USER.BY_EMAIL to cache keys.
// BFFService.getUserById uses cacheConstants.keys.USER.BY_ID and
// BFFService.login uses cacheConstants.keys.USER.BY_EMAIL.
// Missing these caused: TypeError: Cannot read properties of undefined (reading 'BY_ID')
// Also add USER_SESSIONS which must return an array — the service calls
// ids.filter() on it. Returning a non-array causes "ids.filter is not a function".
vi.mock("../../config/cache.constants.js", () => ({
  cacheConstants: {
    keys: {
      BFF: {
        SESSION: "bff:session",
        TEMP_SESSION: "bff:temp_session",
        USER_SESSIONS: "bff:user_sessions",
      },
      AUTH: {
        OTP: "auth:otp",
        LOGIN_ATTEMPTS: "auth:login_attempts",
      },
      USER: {
        BY_ID: "user:by_id",
        BY_EMAIL: "user:by_email",
      },
    },
    ttl: {
      SHORT: 300,
      MEDIUM: 900,
      BFF_SESSION: 7 * 24 * 60 * 60,
      SESSION: 7 * 24 * 60 * 60,
    },
  },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { BFFService } from "../../services/bff.service.js";
import { prisma } from "../../lib/prisma.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = Date.now();

const validSession = {
  userId: "user-001",
  accessToken: "access-token-abc",
  refreshToken: "refresh-token-abc",
  requiresPasswordChange: false,
  deviceFingerprint: "fp-hash",
  accessTokenExpiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
  refreshTokenExpiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date(now - 60 * 1000).toISOString(),
  lastActivityAt: new Date(now - 60 * 1000).toISOString(),
  expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const expiredSession = {
  ...validSession,
  expiresAt: new Date(now - 1000).toISOString(),
};

const idleSession = {
  ...validSession,
  lastActivityAt: new Date(now - 60 * 60 * 1000).toISOString(), // 1h idle
};

const staleAccessTokenSession = {
  ...validSession,
  accessTokenExpiresAt: new Date(now + 2 * 60 * 1000).toISOString(), // 2 min left
};

const mockDbUser = {
  id: "user-001",
  email: "user@nema.gov.ng",
  passwordHash: "$argon2id$hashed",
  firstName: "Test",
  lastName: "User",
  role: UserRole.ADMIN,
  agencyId: "agency-001",
  isActive: true,
  emailVerified: true,
  isTwoFactorEnabled: false,
  twoFactorMethod: null,
  twoFactorSecret: null,
  agency: {
    id: "agency-001",
    name: "NEMA",
    type: "FEDERAL",
    jurisdictionLevel: "NATIONAL",
    status: AgencyStatus.ACTIVE,
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BFFService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Restore defaults after clearAllMocks wipes return values.
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(null);
    mockCache.delete.mockResolvedValue(null);
    mockCache.deletePattern.mockResolvedValue(null);
    // FIX: USER_SESSIONS must return an array so ids.filter() works.
    // The service does: const ids = (await cache.get(...)) ?? []
    // but if get() returns a non-array (e.g. the session object itself
    // because we used mockResolvedValue(session) for all keys), the
    // ?? [] fallback is bypassed and .filter() blows up.
    // We use a sequenced mock: first call returns the session, later calls
    // for USER_SESSIONS return an array. Per-test overrides can refine this.
    mockCache.list.mockResolvedValue([]);
    mockCache.increment.mockResolvedValue(1);
  });

  // ── validateAndRefreshSession ───────────────────────────────────────────────

  describe("validateAndRefreshSession", () => {
    it("returns valid=true for a fresh, valid session", async () => {
      // First get() → session; any subsequent get() for USER cache → null (no
      // cached user, falls through to DB).
      mockCache.get
        .mockResolvedValueOnce(validSession)  // session lookup
        .mockResolvedValue(null);             // user cache miss → DB lookup
      (prisma.user.findUnique as any).mockResolvedValue(mockDbUser);

      const result = await BFFService.validateAndRefreshSession("session-abc");

      expect(result.valid).toBe(true);
      expect(result.session).toBeDefined();
    });

    it("returns valid=false when session is not found in cache", async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await BFFService.validateAndRefreshSession("nonexistent");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("SESSION_NOT_FOUND");
    });

    it("returns valid=false and revokes expired session (absolute timeout)", async () => {
      // Session get → expired; USER_SESSIONS get → [] so .filter() works.
      mockCache.get
        .mockResolvedValueOnce(expiredSession) // session
        .mockResolvedValue([]);                // USER_SESSIONS array

      const result = await BFFService.validateAndRefreshSession("session-abc");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("SESSION_EXPIRED");
      expect(mockCache.delete).toHaveBeenCalled();
    });

    it("returns valid=false and revokes an idle session", async () => {
      mockCache.get
        .mockResolvedValueOnce(idleSession)
        .mockResolvedValue([]);

      const result = await BFFService.validateAndRefreshSession("session-abc");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("SESSION_IDLE_TIMEOUT");
    });

  });

  // ── login ───────────────────────────────────────────────────────────────────

  describe("login", () => {
    const loginRequest = { email: "user@nema.gov.ng", password: "password123" };

    it("throws unauthorized when user is not found", async () => {
      mockCache.get.mockResolvedValue(null);
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await expect(
        BFFService.login(loginRequest as any, "127.0.0.1")
      ).rejects.toThrow(AppError);
    });

    it("throws unauthorized when password is incorrect", async () => {
      mockCache.get.mockResolvedValue(null);
      (prisma.user.findUnique as any).mockResolvedValue(mockDbUser);
      const { JWTService } = await import("../../services/jwt.service.js");
      (JWTService.verifyPasswordArgon2 as any).mockResolvedValue(false);

      await expect(
        BFFService.login(loginRequest as any, "127.0.0.1")
      ).rejects.toThrow(AppError);
    });

    it("throws forbidden when user account is inactive", async () => {
      mockCache.get.mockResolvedValue(null);
      (prisma.user.findUnique as any).mockResolvedValue({ ...mockDbUser, isActive: false });
      const { JWTService } = await import("../../services/jwt.service.js");
      (JWTService.verifyPasswordArgon2 as any).mockResolvedValue(true);

      await expect(
        BFFService.login(loginRequest as any, "127.0.0.1")
      ).rejects.toThrow(AppError);
    });
  });

  // ── logout ──────────────────────────────────────────────────────────────────

  describe("logout", () => {
    it("removes the session from cache", async () => {
      // First get → session; second get for USER_SESSIONS → [] so filter works
      mockCache.get
        .mockResolvedValueOnce(validSession)
        .mockResolvedValue([]);

      await BFFService.logout("session-abc", "127.0.0.1", "Mozilla");

      expect(mockCache.delete).toHaveBeenCalledWith(expect.any(String), "session-abc");
    });

    it("does not throw when session is already missing", async () => {
      mockCache.get.mockResolvedValue(null);

      await expect(
        BFFService.logout("dead-session", "127.0.0.1")
      ).resolves.not.toThrow();
    });
  });

  // ── generateDeviceFingerprintHash ───────────────────────────────────────────

  describe("generateDeviceFingerprintHash", () => {
    it("returns a consistent hash for the same fingerprint", () => {
      const fp = { userAgent: "Mozilla/5.0", language: "en-US" };

      const hash1 = BFFService.generateDeviceFingerprintHash(fp);
      const hash2 = BFFService.generateDeviceFingerprintHash(fp);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe("string");
      expect(hash1.length).toBeGreaterThan(0);
    });

    it("returns different hashes for different fingerprints", () => {
      const fp1 = { userAgent: "Mozilla/5.0", language: "en-US" };
      const fp2 = { userAgent: "Safari/14.0", language: "fr-FR" };

      expect(BFFService.generateDeviceFingerprintHash(fp1)).not.toBe(
        BFFService.generateDeviceFingerprintHash(fp2)
      );
    });
  });
});