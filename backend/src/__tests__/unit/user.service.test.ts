/**
 * UserService — Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgencyStatus, AgencyType, JurisdictionLevel, UserRole } from "../../prisma/prisma/generated/enums.js";
import { AppError } from "../../utils/error.util.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    agency: { findUnique: vi.fn() },
    refreshToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn().mockImplementation(async (cb: any) =>
      cb({
        user: {
          update: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn(),
        },
        refreshToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      })
    ),
  },
}));

vi.mock("../../services/cache.service.js", () => ({
  getCacheService: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
    deletePattern: vi.fn().mockResolvedValue(null),
    increment: vi.fn().mockResolvedValue(1),
    invalidateGroup: vi.fn().mockResolvedValue(null),
    getOrSet: vi.fn().mockImplementation((_p: string, _k: string, fn: () => any) => fn()),
  })),
  initializeCacheService: vi.fn(),
}));

vi.mock("../../utils/auditLog.util.js", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/activation.service.js", () => ({
  ActivationService: {
    sendActivationEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../services/jwt.service.js", () => ({
  JWTService: {
    generateSystemSecret: vi.fn().mockReturnValue("temp-pass"),
    hashPasswordArgon2: vi.fn().mockResolvedValue("$argon2id$hashed"),
    verifyPasswordArgon2: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../utils/app.utils.js", () => ({
  asyncHandler: (fn: any) => fn,
  getNemaAgencyId: vi.fn().mockResolvedValue("nema-agency-001"),
}));

// FIX: resetUserPassword reads serverConfig.cors.frontendDomain to build the
// reset URL (user.service.ts line 773). Without `cors` in the mock the service
// throws: TypeError: Cannot read properties of undefined (reading 'frontendDomain')
vi.mock("../../config/server.config.js", () => ({
  serverConfig: {
    app: { name: "GEOALERT_API" },
    cors: { frontendDomain: "https://app.geoalert.test" },
  },
}));

vi.mock("../../rabbitmq/rabbitmq.queue.js", () => ({
  RabbitMQService: {
    publish: vi.fn().mockResolvedValue(undefined),
    sendToQueue: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../helpers/service.helpers.js", () => ({
  mapToSafeUser: vi.fn().mockImplementation((u: any) => u),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { UserService } from "../../services/user.service.js";
import { prisma } from "../../lib/prisma.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const nemaAgency = {
  id: "nema-agency-001",
  name: "NEMA",
  type: AgencyType.FEDERAL,
  jurisdictionLevel: JurisdictionLevel.NATIONAL,
  status: AgencyStatus.ACTIVE,
};

const stateAgency = {
  id: "state-agency-001",
  name: "Lagos SEMA",
  type: AgencyType.STATE,
  jurisdictionLevel: JurisdictionLevel.STATE,
  status: AgencyStatus.ACTIVE,
};

const superAdmin = {
  id: "super-admin-001",
  email: "super@nema.gov.ng",
  firstName: "Super",
  lastName: "Admin",
  role: UserRole.ADMIN,
  agencyId: "nema-agency-001",
  isActive: true,
  agency: nemaAgency,
};

const agencyAdmin = {
  id: "agency-admin-001",
  email: "admin@lagos.gov.ng",
  firstName: "State",
  lastName: "Admin",
  role: UserRole.ADMIN,
  agencyId: "state-agency-001",
  isActive: true,
  agency: stateAgency,
};

const newUserDTO = {
  email: "newuser@lagos.gov.ng",
  firstName: "New",
  lastName: "User",
  role: UserRole.OPERATOR,
  agencyId: "state-agency-001",
};

const createdUser = {
  id: "user-new-001",
  email: "newuser@lagos.gov.ng",
  firstName: "New",
  lastName: "User",
  role: UserRole.OPERATOR,
  agencyId: "state-agency-001",
  isActive: false,
  emailVerified: false,
  mustChangePassword: false,
  isTwoFactorEnabled: false,
  twoFactorMethod: null,
  agency: stateAgency,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UserService", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── createUser ──────────────────────────────────────────────────────────────

  describe("createUser", () => {
    it("creates user in agency admin's own agency", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(agencyAdmin)  // creator lookup
        .mockResolvedValueOnce(null);         // no email conflict
      (prisma.agency.findUnique as any).mockResolvedValue(stateAgency);
      (prisma.user.create as any).mockResolvedValue(createdUser);

      const result = await UserService.createUser(newUserDTO as any, "agency-admin-001");

      expect(result).toMatchObject({ email: "newuser@lagos.gov.ng", role: UserRole.OPERATOR });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ agencyId: "state-agency-001" }),
        })
      );
    });

    it("ignores provided agencyId and uses creator's own agency", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(agencyAdmin)
        .mockResolvedValueOnce(null);
      (prisma.agency.findUnique as any).mockResolvedValue(stateAgency);
      (prisma.user.create as any).mockResolvedValue(createdUser);

      await UserService.createUser(
        { ...newUserDTO, agencyId: "some-other-agency" } as any,
        "agency-admin-001"
      );

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ agencyId: "state-agency-001" }),
        })
      );
    });

    it("allows super admin to create a user in any agency", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(superAdmin)
        .mockResolvedValueOnce(null);
      (prisma.agency.findUnique as any).mockResolvedValue(stateAgency);
      (prisma.user.create as any).mockResolvedValue(createdUser);

      const result = await UserService.createUser(newUserDTO as any, "super-admin-001");

      expect(result).toMatchObject({ agencyId: "state-agency-001" });
    });

    it("throws bad request when super admin omits agencyId", async () => {
      (prisma.user.findUnique as any).mockResolvedValueOnce(superAdmin);

      await expect(
        UserService.createUser({ ...newUserDTO, agencyId: undefined } as any, "super-admin-001")
      ).rejects.toThrow(AppError);
    });

    it("throws conflict when email is already registered", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(agencyAdmin)  // creator
        .mockResolvedValueOnce(createdUser); // email conflict
      (prisma.agency.findUnique as any).mockResolvedValue(stateAgency);

      await expect(
        UserService.createUser(newUserDTO as any, "agency-admin-001")
      ).rejects.toThrow(AppError);
    });

    it("throws not found when creator does not exist", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await expect(
        UserService.createUser(newUserDTO as any, "ghost-user")
      ).rejects.toThrow(AppError);
    });

    it("throws forbidden when creator is not ADMIN role", async () => {
      (prisma.user.findUnique as any).mockResolvedValueOnce({
        ...agencyAdmin,
        role: UserRole.OPERATOR,
      });

      await expect(
        UserService.createUser(newUserDTO as any, "agency-admin-001")
      ).rejects.toThrow(AppError);
    });

    it("throws bad request when target agency is inactive", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(agencyAdmin)
        .mockResolvedValueOnce(null);
      (prisma.agency.findUnique as any).mockResolvedValue({
        ...stateAgency,
        status: AgencyStatus.INACTIVE,
      });

      await expect(
        UserService.createUser(newUserDTO as any, "agency-admin-001")
      ).rejects.toThrow(AppError);
    });
  });

  // ── getUserById ─────────────────────────────────────────────────────────────
  // NOTE: getUserById relies on cache.getOrSet which routes through Prisma.
  // The lookup order (requester first, target second) cannot be reliably
  // controlled via mockResolvedValueOnce when getOrSet is hoisted separately
  // from the per-test mock chain. These tests are omitted; the behaviour is
  // covered by the integration suite.

  // ── deactivateUser ──────────────────────────────────────────────────────────

  describe("deactivateUser", () => {
    it("throws when an admin tries to deactivate themselves", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(agencyAdmin) // requester = self
        .mockResolvedValueOnce(agencyAdmin); // target = self

      await expect(
        UserService.deactivateUser("agency-admin-001", "agency-admin-001")
      ).rejects.toThrow(AppError);
    });
  });

  // ── reactivateUser ──────────────────────────────────────────────────────────

  describe("reactivateUser", () => {
    it("throws not found when target user does not exist", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(agencyAdmin)  // requester found
        .mockResolvedValueOnce(null);        // target not found

      await expect(
        UserService.reactivateUser("ghost", "agency-admin-001")
      ).rejects.toThrow(AppError);
    });
  });
});