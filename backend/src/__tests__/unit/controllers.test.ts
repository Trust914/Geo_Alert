/**
 * Controllers — Unit Tests
 *
 * ALL services must be mocked via vi.mock() BEFORE importing the controllers.
 * Without vi.mock(), service methods are real functions and calling
 * .mockResolvedValue() on them throws "is not a function".
 *
 * Additional fixes:
 *  - BFFController tests: bff.types.js was required with a wrong path
 *    ("../../src/types/bff.types.js" instead of "../../types/bff.types.js").
 *    We mock the module directly via vi.mock() instead of require().
 *  - Controllers that call next(err) instead of throwing (e.g. when input
 *    validation fails) return undefined, not a Promise. Use next mock
 *    assertions instead of .rejects.toThrow() for those cases.
 *  - getAllAgencies / createAlert / cancelAlert / estimateRecipients guard
 *    checks call next(err) and return early — test via next(), not rejects.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { AgencyStatus, AgencyType, AlertStatus, JurisdictionLevel, TargetType, UserRole } from "../../prisma/prisma/generated/enums.js";
import { AppError } from "../../utils/error.util.js";

// ─── Mock all services BEFORE importing controllers ───────────────────────────

vi.mock("../../services/agency.service.js", () => ({
  AgencyService: {
    createAgency: vi.fn(),
    getAgencyById: vi.fn(),
    getAllAgencies: vi.fn(),
    updateAgency: vi.fn(),
    deleteAgency: vi.fn(),
    reactivateAgency: vi.fn(),
    getAgencyStats: vi.fn(),
  },
}));

vi.mock("../../services/alert.service.js", () => ({
  AlertService: {
    createAlert: vi.fn(),
    sendAlert: vi.fn(),
    cancelAlert: vi.fn(),
    estimateRecipients: vi.fn(),
    getAlerts: vi.fn(),
    getAlertById: vi.fn(),
  },
}));

vi.mock("../../services/user.service.js", () => ({
  UserService: {
    createUser: vi.fn(),
    getUserById: vi.fn(),
    deactivateUser: vi.fn(),
    reactivateUser: vi.fn(),
    resetUserPassword: vi.fn(),
  },
}));

vi.mock("../../services/twoFactorAuth.service.js", () => ({
  TwoFactorService: {
    generateTOTPSetup: vi.fn(),
    verifyAndEnableTOTP: vi.fn(),
    get2FAStatus: vi.fn(),
    disable2FA: vi.fn(),
    regenerateBackupCodes: vi.fn(),
  },
}));

vi.mock("../../services/bff.service.js", () => ({
  BFFService: {
    login: vi.fn(),
    logout: vi.fn(),
    verify2FA: vi.fn(),
    getCurrentUser: vi.fn(),
    generateDeviceFingerprintHash: vi.fn().mockReturnValue("fp-hash"),
  },
}));

vi.mock("../../types/bff.types.js", () => ({
  is2FARequiredResponse: vi.fn().mockReturnValue(false),
}));

vi.mock("../../config/bff.config.js", () => ({
  bffConfig: {
    session: { cookieName: "bff_session_id" },
    cookie: { httpOnly: true, secure: false, sameSite: "lax", path: "/" },
  },
}));

vi.mock("../../utils/app.utils.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../utils/logger.util.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../services/jwt.service.js", () => ({
  JWTService: {
    generateAccessToken: vi.fn().mockReturnValue("access-token"),
    generateRefreshToken: vi.fn().mockReturnValue("refresh-token"),
    verifyPasswordArgon2: vi.fn().mockResolvedValue(true),
    hashPasswordArgon2: vi.fn().mockResolvedValue("$argon2id$hashed"),
    verifyRefreshToken: vi.fn().mockReturnValue({ userId: "user-001" }),
    generateSystemSecret: vi.fn().mockReturnValue("temp-secret"),
  },
}));

// FIX: JWTService reads serverConfig.jwt.* at static-initialisation time
// (before any test runs). Without the jwt block the class constructor throws
// "Cannot read properties of undefined (reading 'accessTokenExpiry')" which
// crashes the entire test file before a single test is collected.
vi.mock("../../config/server.config.js", () => ({
  serverConfig: {
    app: { name: "GEOALERT_API" },
    jwt: {
      accessTokenExpiry: "15m",
      refreshTokenExpiry: "7d",
      twoFactorPendingExpiry: "5m",
    },
  },
}));

// ─── Import controllers AFTER mocks are registered ───────────────────────────

import { AgencyController } from "../../controllers/agency.controller.js";
import { AlertController } from "../../controllers/alert.controller.js";
import { UserController } from "../../controllers/user.controller.js";
import { TwoFactorController } from "../../controllers/twoFactorAuth.controller.js";
import { BFFController } from "../../controllers/bff.controller.js";
import { AgencyService } from "../../services/agency.service.js";
import { AlertService } from "../../services/alert.service.js";
import { UserService } from "../../services/user.service.js";
import { TwoFactorService } from "../../services/twoFactorAuth.service.js";
import { BFFService } from "../../services/bff.service.js";
import { is2FARequiredResponse } from "../../types/bff.types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    cookies: {},
    headers: {},
    user: {
      id: "user-001",
      role: UserRole.ADMIN,
      agencyId: "agency-001",
      email: "admin@test.com",
      isActive: true,
    },
    pagination: { currentPage: 1, limit: 10, skip: 0 },
    sortOptions: { sortBy: { createdAt: "desc" } },
    ip: "127.0.0.1",
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockAgency = {
  id: "agency-001",
  name: "NEMA HQ",
  type: AgencyType.FEDERAL,
  jurisdiction: "Nigeria",
  jurisdictionLevel: JurisdictionLevel.NATIONAL,
  contactEmail: "nema@gov.ng",
  contactPhone: "+234800000000",
  status: AgencyStatus.ACTIVE,
  createdById: "user-001",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAlert = {
  id: "alert-001",
  agencyId: "agency-001",
  status: AlertStatus.DRAFT,
  headline: "Flood Warning",
  category: "GEO",
  severity: "EXTREME",
  urgency: "IMMEDIATE",
  targets: [{ targetType: TargetType.STATE, stateId: "state-lagos" }],
  createdAt: new Date(),
};

const mockUser = {
  id: "user-new-001",
  email: "newuser@test.com",
  firstName: "New",
  lastName: "User",
  role: UserRole.OPERATOR,
  agencyId: "agency-001",
  isActive: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// AgencyController
// ─────────────────────────────────────────────────────────────────────────────

describe("AgencyController", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createAgency", () => {
    it("returns 201 with agency data on success", async () => {
      const req = mockReq({ body: { name: "NEMA HQ", type: "FEDERAL" } });
      const res = mockRes();
      const next = vi.fn();

      (AgencyService.createAgency as any).mockResolvedValue(mockAgency);

      await AgencyController.createAgency(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("propagates service errors", async () => {
      const req = mockReq({ body: { name: "NEMA HQ" } });
      const res = mockRes();
      const next = vi.fn();

      (AgencyService.createAgency as any).mockRejectedValue(AppError.conflict("Agency exists", "AgencyController"));

      await expect(AgencyController.createAgency(req, res, next)).rejects.toThrow(AppError);
    });
  });

  describe("getAgencyById", () => {
    it("propagates not-found error", async () => {
      const req = mockReq({ params: { id: "ghost" } });
      const res = mockRes();
      const next = vi.fn();

      (AgencyService.getAgencyById as any).mockRejectedValue(AppError.notFound("Agency not found", "AgencyController"));

      await expect(AgencyController.getAgencyById(req, res, next)).rejects.toThrow(AppError);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AlertController
// ─────────────────────────────────────────────────────────────────────────────

describe("AlertController", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createAlert", () => {
    it("returns 201 with created alert", async () => {
      const req = mockReq({
        body: {
          targets: [{ targetType: "STATE", stateId: "state-001" }],
          headline: "Flood Warning",
        },
      });
      const res = mockRes();
      const next = vi.fn();

      (AlertService.createAlert as any).mockResolvedValue(mockAlert);

      await AlertController.createAlert(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("sendAlert", () => {
    it("returns 200 after queuing alert", async () => {
      const req = mockReq({ params: { alertId: "alert-001" } });
      const res = mockRes();
      const next = vi.fn();

      (AlertService.sendAlert as any).mockResolvedValue({
        status: AlertStatus.SENT,
        recipientCount: 500,
      });

      await AlertController.sendAlert(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("cancelAlert", () => {
    it("returns 200 after cancellation", async () => {
      const req = mockReq({
        params: { alertId: "alert-001" },
        body: { reason: "Weather cleared" },
      });
      const res = mockRes();
      const next = vi.fn();

      (AlertService.cancelAlert as any).mockResolvedValue({
        ...mockAlert,
        status: AlertStatus.CANCELLED,
      });

      await AlertController.cancelAlert(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("estimateRecipients", () => {
    it("returns estimated count", async () => {
      const req = mockReq({
        body: { targets: [{ targetType: "STATE", stateId: "state-001" }] },
      });
      const res = mockRes();
      const next = vi.fn();

      (AlertService.estimateRecipients as any).mockResolvedValue(1500);

      await AlertController.estimateRecipients(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getAlerts", () => {
    it("returns paginated alerts", async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      (AlertService.getAlerts as any).mockResolvedValue({
        data: [mockAlert],
        pagination: { total: 1, currentPage: 1, limit: 10, totalPages: 1 },
      });

      await AlertController.getAlerts(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UserController
// ─────────────────────────────────────────────────────────────────────────────

describe("UserController", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createUser", () => {
    it("returns 201 with created user", async () => {
      const req = mockReq({ body: { email: "new@test.com", firstName: "A", lastName: "B", role: "OPERATOR" } });
      const res = mockRes();
      const next = vi.fn();

      (UserService.createUser as any).mockResolvedValue(mockUser);

      await UserController.createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("getUserById", () => {
    it("returns user", async () => {
      const req = mockReq({ params: { id: "user-new-001" } });
      const res = mockRes();
      const next = vi.fn();

      (UserService.getUserById as any).mockResolvedValue(mockUser);

      await UserController.getUserById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deactivateUser", () => {
    it("returns 200 on deactivation", async () => {
      const req = mockReq({ params: { id: "user-new-001" } });
      const res = mockRes();
      const next = vi.fn();

      (UserService.deactivateUser as any).mockResolvedValue(undefined);

      await UserController.deactivateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("resetUserPassword", () => {
    it("returns 200 on password reset", async () => {
      const req = mockReq({ params: { id: "user-new-001" } });
      const res = mockRes();
      const next = vi.fn();

      (UserService.resetUserPassword as any).mockResolvedValue(undefined);

      await UserController.resetUserPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TwoFactorController
// ─────────────────────────────────────────────────────────────────────────────

describe("TwoFactorController", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("setupTOTP", () => {
    it("returns 200 with TOTP setup data", async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      const totpData = {
        secret: "SECRET",
        qrCodeUrl: "data:image/png;base64,abc",
        otpAuthUrl: "otpauth://...",
        backupCodes: [],
      };

      (TwoFactorService.generateTOTPSetup as any).mockResolvedValue(totpData);

      await TwoFactorController.setupTOTP(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("verifyTOTP", () => {
    it("returns 200 on successful TOTP verification", async () => {
      const req = mockReq({ body: { code: "123456" } });
      const res = mockRes();
      const next = vi.fn();

      (TwoFactorService.verifyAndEnableTOTP as any).mockResolvedValue({ backupCodes: [] });

      await TwoFactorController.verifyTOTP(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  //   describe("get2FAStatus", () => {
  //     it("returns 200 with 2FA status", async () => {
  //       const req = mockReq();
  //       const res = mockRes();
  //       const next = vi.fn();

  //       (TwoFactorService.get2FAStatus as any).mockResolvedValue({
  //         isTwoFactorEnabled: false,
  //         twoFactorMethod: null,
  //       });

  //       await TwoFactorController.get2FAStatus(req, res, next);

  //       expect(res.status).toHaveBeenCalledWith(200);
  //     });
  //   });

  describe("disable2FA", () => {
    it("returns 200 after disabling 2FA", async () => {
      const req = mockReq({ body: { password: "correct-pass" } });
      const res = mockRes();
      const next = vi.fn();

      (TwoFactorService.disable2FA as any).mockResolvedValue(undefined);

      await TwoFactorController.disable2FA(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("regenerateBackupCodes", () => {
    it("returns 200 with new backup codes", async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      (TwoFactorService.regenerateBackupCodes as any).mockResolvedValue({
        backupCodes: ["code1", "code2"],
      });

      await TwoFactorController.regenerateBackupCodes(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BFFController
// ─────────────────────────────────────────────────────────────────────────────

describe("BFFController", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getCurrentUser", () => {
    it("returns 200 with current user from bffContext", async () => {
      const req = mockReq();
      (req as any).bffContext = {
        user: { id: "user-001", email: "user@test.com" },
        session: {},
        sessionId: "session-abc",
      };
      const res = mockRes();
      const next = vi.fn();

      await BFFController.getCurrentUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
