/**
 * BFF Middleware & Roles Middleware — Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { TwoFactorMethod, UserRole } from "../../prisma/prisma/generated/enums.js";
import { AppError } from "../../utils/error.util.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// NOTE: All vi.mock() paths must match the import paths used by the SOURCE
// files (i.e. what bff.middleware.ts itself imports), NOT the test file's path.

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("../../services/bff.service.js", () => ({
  BFFService: {
    validateAndRefreshSession: vi.fn(),
    generateDeviceFingerprintHash: vi.fn().mockReturnValue("fp-hash-abc"),
  },
}));

vi.mock("../../services/twoFactorAuth.service.js", () => ({
  TwoFactorService: {
    verifyTOTP: vi.fn(),
    verifyEmailOTP: vi.fn(),
    verifyBackupCode: vi.fn(),
    sendEmailOTP: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../config/bff.config.js", () => ({
  bffConfig: {
    session: {
      cookieName: "bff_session_id",
      idleTimeout: 30 * 60 * 1000,
      tokenRefreshThreshold: 5 * 60 * 1000,
    },
    cookie: { httpOnly: true, secure: false, sameSite: "lax", path: "/", domain: undefined },
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

vi.mock("../../utils/logger.util.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../utils/app.utils.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import {
  bffAuthenticate,
  requireBFFStepUp,
  checkBFFPasswordChangeRequired,
} from "../../middlewares/bff.middleware.js";
import {
  checkRole,
  isAdminOrCoordinator,
  requireAlertWriteAccess,
  canViewSensitiveData,
} from "../../middlewares/roles.middleware.js";
import { BFFService } from "../../services/bff.service.js";
import { TwoFactorService } from "../../services/twoFactorAuth.service.js";
import { prisma } from "../../lib/prisma.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    cookies: {},
    headers: {},
    user: undefined,
    path: "/some/path",
    ip: "127.0.0.1",
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

const activeUser = {
  id: "user-001",
  email: "user@nema.gov.ng",
  role: UserRole.OPERATOR,
  agencyId: "agency-001",
  firstName: "Test",
  lastName: "User",
  isActive: true,
  emailVerified: true,
  isTwoFactorEnabled: false,
  twoFactorMethod: null,
  twoFactorSecret: null,
  twoFactorBackupCodes: [],
  agency: { id: "agency-001", name: "SEMA", type: "STATE", jurisdictionLevel: "STATE", status: "ACTIVE" },
};

const validSession = {
  userId: "user-001",
  accessToken: "access-token-xyz",
  refreshToken: "refresh-token-xyz",
  deviceFingerprint: "fp-hash-abc",
  requiresPasswordChange: false,
  accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
  refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  lastActivityAt: new Date(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
};

// ═══════════════════════════════════════════════════════════════════════════════
// bffAuthenticate
// ═══════════════════════════════════════════════════════════════════════════════

describe("bffAuthenticate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls next() and attaches req.user on a valid session", async () => {
    const req = mockReq({ cookies: { bff_session_id: "session-abc" } });
    const nextFn = vi.fn();

    (BFFService.validateAndRefreshSession as any).mockResolvedValue({ valid: true, session: validSession });
    (prisma.user.findUnique as any).mockResolvedValue(activeUser);

    await bffAuthenticate(req, mockRes(), nextFn);

    expect(nextFn).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ id: "user-001", email: "user@nema.gov.ng" });
  });

  it("throws unauthorized when no session cookie is present", async () => {
    await expect(
      bffAuthenticate(mockReq({ cookies: {} }), mockRes(), vi.fn())
    ).rejects.toThrow(AppError);
  });

  it("throws unauthorized when session is invalid", async () => {
    const req = mockReq({ cookies: { bff_session_id: "bad-session" } });
    (BFFService.validateAndRefreshSession as any).mockResolvedValue({ valid: false, errorMessage: "Expired" });

    await expect(bffAuthenticate(req, mockRes(), vi.fn())).rejects.toThrow(AppError);
  });

  it("throws unauthorized when user is not found in DB", async () => {
    const req = mockReq({ cookies: { bff_session_id: "session-abc" } });
    (BFFService.validateAndRefreshSession as any).mockResolvedValue({ valid: true, session: validSession });
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await expect(bffAuthenticate(req, mockRes(), vi.fn())).rejects.toThrow(AppError);
  });

  it("throws forbidden when user email is not verified", async () => {
    const req = mockReq({ cookies: { bff_session_id: "session-abc" } });
    (BFFService.validateAndRefreshSession as any).mockResolvedValue({ valid: true, session: validSession });
    (prisma.user.findUnique as any).mockResolvedValue({ ...activeUser, emailVerified: false });

    await expect(bffAuthenticate(req, mockRes(), vi.fn())).rejects.toThrow(AppError);
  });

  it("throws forbidden when user account is deactivated", async () => {
    const req = mockReq({ cookies: { bff_session_id: "session-abc" } });
    (BFFService.validateAndRefreshSession as any).mockResolvedValue({ valid: true, session: validSession });
    (prisma.user.findUnique as any).mockResolvedValue({ ...activeUser, isActive: false });

    await expect(bffAuthenticate(req, mockRes(), vi.fn())).rejects.toThrow(AppError);
  });

  it("throws forbidden when user agency is inactive", async () => {
    const req = mockReq({ cookies: { bff_session_id: "session-abc" } });
    (BFFService.validateAndRefreshSession as any).mockResolvedValue({ valid: true, session: validSession });
    (prisma.user.findUnique as any).mockResolvedValue({
      ...activeUser,
      agency: { ...activeUser.agency, status: "INACTIVE" },
    });

    await expect(bffAuthenticate(req, mockRes(), vi.fn())).rejects.toThrow(AppError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// requireBFFStepUp
// ═══════════════════════════════════════════════════════════════════════════════

describe("requireBFFStepUp", () => {
  beforeEach(() => vi.clearAllMocks());

  const bffContext = { sessionId: "session-abc", session: validSession, user: activeUser };

  it("calls next() immediately when user has no 2FA configured", async () => {
    const req = mockReq();
    (req as any).bffContext = bffContext;
    req.user = { ...activeUser, isTwoFactorEnabled: false } as any;
    const nextFn = vi.fn();

    await requireBFFStepUp(req, mockRes(), nextFn);

    expect(nextFn).toHaveBeenCalledWith();
  });

  it("passes 428 error to next() when 2FA is enabled but no code is provided", async () => {
    const req = mockReq({ headers: {} });
    (req as any).bffContext = bffContext;
    req.user = { ...activeUser, isTwoFactorEnabled: true, twoFactorMethod: TwoFactorMethod.EMAIL } as any;
    const nextFn = vi.fn();

    await requireBFFStepUp(req, mockRes(), nextFn);

    const err = (nextFn as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(428);
  });

  it("calls next() after successful TOTP verification", async () => {
    const req = mockReq({ headers: { "x-2fa-code": "123456" } });
    (req as any).bffContext = bffContext;
    req.user = {
      ...activeUser,
      isTwoFactorEnabled: true,
      twoFactorMethod: TwoFactorMethod.GOOGLE_AUTHENTICATOR,
      twoFactorSecret: "encrypted-secret",
    } as any;
    const nextFn = vi.fn();
    (TwoFactorService.verifyTOTP as any).mockResolvedValue(true);

    await requireBFFStepUp(req, mockRes(), nextFn);

    expect(nextFn).toHaveBeenCalledWith();
  });

  it("calls next() after successful Email OTP verification", async () => {
    const req = mockReq({ headers: { "x-2fa-code": "987654" } });
    (req as any).bffContext = bffContext;
    req.user = { ...activeUser, isTwoFactorEnabled: true, twoFactorMethod: TwoFactorMethod.EMAIL } as any;
    const nextFn = vi.fn();
    (TwoFactorService.verifyEmailOTP as any).mockResolvedValue(true);

    await requireBFFStepUp(req, mockRes(), nextFn);

    expect(nextFn).toHaveBeenCalledWith();
  });

  it("routes 8-char code to verifyBackupCode", async () => {
    const req = mockReq({ headers: { "x-2fa-code": "ABCDE123" } });
    (req as any).bffContext = bffContext;
    req.user = {
      ...activeUser,
      isTwoFactorEnabled: true,
      twoFactorMethod: TwoFactorMethod.EMAIL,
      twoFactorBackupCodes: ["hashed-code"],
    } as any;
    const nextFn = vi.fn();
    (TwoFactorService.verifyBackupCode as any).mockResolvedValue(true);

    await requireBFFStepUp(req, mockRes(), nextFn);

    expect(TwoFactorService.verifyBackupCode).toHaveBeenCalledWith("user-001", "ABCDE123", ["hashed-code"]);
    expect(nextFn).toHaveBeenCalledWith();
  });

  it("passes error to next() when code is invalid", async () => {
    const req = mockReq({ headers: { "x-2fa-code": "wrong-code" } });
    (req as any).bffContext = bffContext;
    req.user = { ...activeUser, isTwoFactorEnabled: true, twoFactorMethod: TwoFactorMethod.EMAIL } as any;
    const nextFn = vi.fn();
    (TwoFactorService.verifyEmailOTP as any).mockResolvedValue(false);

    await requireBFFStepUp(req, mockRes(), nextFn);

    expect((nextFn as any).mock.calls[0][0]).toBeInstanceOf(AppError);
  });

  it("passes error to next() when bffContext is missing", async () => {
    const req = mockReq();
    (req as any).bffContext = undefined;
    req.user = activeUser as any;
    const nextFn = vi.fn();

    await requireBFFStepUp(req, mockRes(), nextFn);

    expect((nextFn as any).mock.calls[0][0]).toBeInstanceOf(AppError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// checkBFFPasswordChangeRequired
// ═══════════════════════════════════════════════════════════════════════════════

describe("checkBFFPasswordChangeRequired", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls next() when password change is not required", async () => {
    const req = mockReq({ path: "/me" });
    (req as any).bffContext = { session: { requiresPasswordChange: false } };
    const nextFn = vi.fn();

    await checkBFFPasswordChangeRequired(req, mockRes(), nextFn);

    expect(nextFn).toHaveBeenCalledWith();
  });

  it("allows /auth/change-password when password change is required", async () => {
    const req = mockReq({ path: "/auth/change-password" });
    (req as any).bffContext = { session: { requiresPasswordChange: true } };
    const nextFn = vi.fn();

    await checkBFFPasswordChangeRequired(req, mockRes(), nextFn);

    expect(nextFn).toHaveBeenCalledWith();
  });

  it("allows /auth/logout when password change is required", async () => {
    const req = mockReq({ path: "/auth/logout" });
    (req as any).bffContext = { session: { requiresPasswordChange: true } };
    const nextFn = vi.fn();

    await checkBFFPasswordChangeRequired(req, mockRes(), nextFn);

    expect(nextFn).toHaveBeenCalledWith();
  });

  it("throws forbidden for any other path when password change is required", async () => {
    const req = mockReq({ path: "/alerts" });
    (req as any).bffContext = { session: { requiresPasswordChange: true } };

    await expect(
      checkBFFPasswordChangeRequired(req, mockRes(), vi.fn())
    ).rejects.toThrow(AppError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// checkRole / role helpers
// ═══════════════════════════════════════════════════════════════════════════════

// FIX: The roles middleware (checkRole, isAdminOrCoordinator, etc.) follows
// the Express error-handling convention: on failure it calls next(err) and
// returns undefined — it does NOT return a rejected Promise.
// Using `.rejects.toThrow()` therefore fails with "You must provide a Promise
// to expect() when using .rejects, not 'undefined'".
// The correct assertion is to capture `next` as a vi.fn() and check that it
// was called with an AppError instance.

describe("checkRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls next() when user role is allowed", async () => {
    const req = mockReq();
    req.user = { ...activeUser, role: UserRole.ADMIN } as any;
    const nextFn = vi.fn();

    await checkRole([UserRole.ADMIN, UserRole.COORDINATOR])(req, mockRes(), nextFn);

    expect(nextFn).toHaveBeenCalledWith();
  });

  it("throws forbidden when user role is not allowed", async () => {
    const req = mockReq();
    req.user = { ...activeUser, role: UserRole.VIEWER } as any;
    const next = vi.fn();

    await checkRole([UserRole.ADMIN, UserRole.COORDINATOR])(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });

  it("throws unauthorized when req.user is not set", async () => {
    const req = mockReq();
    req.user = undefined as any;
    const next = vi.fn();

    await checkRole([UserRole.ADMIN])(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

describe("isAdminOrCoordinator", () => {
  it("allows ADMIN", async () => {
    const req = mockReq();
    req.user = { ...activeUser, role: UserRole.ADMIN } as any;
    const nextFn = vi.fn();

    await isAdminOrCoordinator(req, mockRes(), nextFn);
    expect(nextFn).toHaveBeenCalledWith();
  });

  it("allows COORDINATOR", async () => {
    const req = mockReq();
    req.user = { ...activeUser, role: UserRole.COORDINATOR } as any;
    const nextFn = vi.fn();

    await isAdminOrCoordinator(req, mockRes(), nextFn);
    expect(nextFn).toHaveBeenCalledWith();
  });

  it("blocks OPERATOR", async () => {
    const req = mockReq();
    req.user = { ...activeUser, role: UserRole.OPERATOR } as any;
    const next = vi.fn();

    await isAdminOrCoordinator(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

describe("requireAlertWriteAccess", () => {
  const allowedRoles = [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.OPERATOR];

  it.each(allowedRoles)("allows %s to write alerts", async (role) => {
    const req = mockReq();
    req.user = { ...activeUser, role } as any;
    const nextFn = vi.fn();

    await requireAlertWriteAccess(req, mockRes(), nextFn);
    expect(nextFn).toHaveBeenCalledWith();
  });

  it("blocks VIEWER from writing alerts", async () => {
    const req = mockReq();
    req.user = { ...activeUser, role: UserRole.VIEWER } as any;
    const next = vi.fn();

    await requireAlertWriteAccess(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});

describe("canViewSensitiveData", () => {
  it("allows ADMIN", async () => {
    const req = mockReq();
    req.user = { ...activeUser, role: UserRole.ADMIN } as any;
    const nextFn = vi.fn();

    await canViewSensitiveData(req, mockRes(), nextFn);
    expect(nextFn).toHaveBeenCalledWith();
  });

  it("blocks OPERATOR", async () => {
    const req = mockReq();
    req.user = { ...activeUser, role: UserRole.OPERATOR } as any;
    const next = vi.fn();

    await canViewSensitiveData(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});