import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgencyStatus, AgencyType, JurisdictionLevel, UserRole } from "../../prisma/prisma/generated/enums.js";
import { AppError } from "../../utils/error.util.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    agency: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    user: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../services/cache.service.js", () => ({
  getCacheService: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
    deletePattern: vi.fn().mockResolvedValue(null),
    getOrSet: vi.fn().mockImplementation((_p: string, _k: string, fn: () => any) => fn()),
  })),
}));

vi.mock("../../utils/auditLog.util.js", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/activation.service.js", () => ({
  ActivationService: { sendActivationEmail: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../services/jwt.service.js", () => ({
  JWTService: {
    generateSystemSecret: vi.fn().mockReturnValue("temp-pass"),
    hashPasswordArgon2: vi.fn().mockResolvedValue("$argon2id$hashed"),
  },
}));

vi.mock("../../config/server.config.js", () => ({
  serverConfig: { app: { name: "GEOALERT_API" } },
}));

vi.mock("../../rabbitmq/rabbitmq.queue.js", () => ({
  RabbitMQService: { publish: vi.fn() },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { AgencyService } from "../../services/agency.service.js";
import { prisma } from "../../lib/prisma.js";

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
  createdById: "user-super-001",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockAdminUser = {
  id: "user-admin-001",
  email: "admin@nema.gov.ng",
  firstName: "John",
  lastName: "Doe",
  role: UserRole.ADMIN,
  agencyId: "agency-001",
  isActive: true,
  mustChangePassword: false,
  emailVerified: false,
};

const mockCreator = {
  id: "user-super-001",
  email: "super@nema.gov.ng",
  firstName: "Super",
  lastName: "Admin",
};

const mockCreateDTO = {
  name: "NEMA HQ",
  type: AgencyType.FEDERAL as string,
  jurisdiction: "Nigeria",
  jurisdictionLevel: JurisdictionLevel.NATIONAL,
  contactEmail: "nema@gov.ng",
  contactPhone: "+234800000000",
  adminEmail: "admin@nema.gov.ng",
  adminFirstName: "John",
  adminLastName: "Doe",
  createdById: "user-super-001",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AgencyService", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── createAgency ────────────────────────────────────────────────────────────

  describe("createAgency", () => {
    it("creates agency and admin user successfully", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue(null);
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(null)       // no existing user with adminEmail
        .mockResolvedValueOnce(mockCreator); // creator lookup
      (prisma.$transaction as any).mockImplementation(async (cb: any) =>
        cb({
          agency: { create: vi.fn().mockResolvedValue(mockAgency) },
          user: { create: vi.fn().mockResolvedValue(mockAdminUser) },
        })
      );

      const result = await AgencyService.createAgency(mockCreateDTO as any);

      expect(result).toMatchObject({ name: "NEMA HQ", type: AgencyType.FEDERAL });
      expect(result.admin).toMatchObject({ email: "admin@nema.gov.ng" });
    });

    it("throws conflict when agency name already exists", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue(mockAgency);

      await expect(AgencyService.createAgency(mockCreateDTO as any)).rejects.toThrow(AppError);
    });

    it("throws conflict when adminEmail already exists", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue(null);
      (prisma.user.findUnique as any).mockResolvedValueOnce(mockAdminUser);

      await expect(AgencyService.createAgency(mockCreateDTO as any)).rejects.toThrow(AppError);
    });

    it("throws bad request for invalid type/jurisdiction combination (FEDERAL + LGA)", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue(null);
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCreator);

      await expect(
        AgencyService.createAgency({ ...mockCreateDTO, jurisdictionLevel: JurisdictionLevel.LGA } as any)
      ).rejects.toThrow(/Invalid combination/i);
    });

    it("throws not found when creator does not exist", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue(null);
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(null) // no email conflict
        .mockResolvedValueOnce(null); // creator not found

      await expect(AgencyService.createAgency(mockCreateDTO as any)).rejects.toThrow(AppError);
    });
  });

  // ── getAgencyById ───────────────────────────────────────────────────────────

  describe("getAgencyById", () => {
    it("returns agency when found", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue({
        ...mockAgency,
        users: [mockAdminUser],
        _count: { users: 1, alerts: 0 },
      });

      const result = await AgencyService.getAgencyById("agency-001");
      expect(result).toMatchObject({ id: "agency-001" });
    });

    it("throws not found when agency does not exist", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue(null);
      await expect(AgencyService.getAgencyById("nonexistent")).rejects.toThrow(AppError);
    });
  });

  // ── updateAgency ────────────────────────────────────────────────────────────

  describe("updateAgency", () => {
    it("updates agency name successfully", async () => {
      (prisma.agency.findUnique as any)
        .mockResolvedValueOnce(mockAgency)
        .mockResolvedValueOnce(null); // no name conflict
      (prisma.agency.update as any).mockResolvedValue({
        ...mockAgency,
        name: "NEMA Updated",
        users: [mockAdminUser],
        _count: { users: 1, alerts: 0 },
      });

      const result = await AgencyService.updateAgency("agency-001", { name: "NEMA Updated" } as any, "user-001");
      expect(result.name).toBe("NEMA Updated");
    });

    it("throws not found when agency does not exist", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue(null);
      await expect(
        AgencyService.updateAgency("nonexistent", { name: "X" } as any, "user-001")
      ).rejects.toThrow(AppError);
    });

    it("throws conflict when new name is taken by another agency", async () => {
      (prisma.agency.findUnique as any)
        .mockResolvedValueOnce(mockAgency)
        .mockResolvedValueOnce({ id: "other-agency" }); // name conflict

      await expect(
        AgencyService.updateAgency("agency-001", { name: "Other" } as any, "user-001")
      ).rejects.toThrow(AppError);
    });
  });

  // ── deleteAgency ────────────────────────────────────────────────────────────

  describe("deleteAgency", () => {
    it("soft-deletes agency that has no alerts", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue({
        ...mockAgency,
        _count: { alerts: 0, users: 2 },
      });
      (prisma.agency.update as any).mockResolvedValue({
        ...mockAgency,
        status: AgencyStatus.INACTIVE,
        users: [],
        _count: { users: 2, alerts: 0 },
      });

      const result = await AgencyService.deleteAgency("agency-001", "user-001");
      expect(result.status).toBe(AgencyStatus.INACTIVE);
    });

    it("throws bad request when agency has alerts", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue({
        ...mockAgency,
        _count: { alerts: 3, users: 2 },
      });
      await expect(AgencyService.deleteAgency("agency-001", "user-001")).rejects.toThrow(AppError);
    });

    it("throws not found when agency does not exist", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue(null);
      await expect(AgencyService.deleteAgency("nonexistent", "user-001")).rejects.toThrow(AppError);
    });
  });

  // ── reactivateAgency ────────────────────────────────────────────────────────

  describe("reactivateAgency", () => {
    it("reactivates an inactive agency", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue({ ...mockAgency, status: AgencyStatus.INACTIVE });
      (prisma.agency.update as any).mockResolvedValue({ ...mockAgency, status: AgencyStatus.ACTIVE });

      const result = await AgencyService.reactivateAgency("agency-001");
      expect(result.status).toBe(AgencyStatus.ACTIVE);
    });

    it("throws bad request when agency is already active", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue(mockAgency);
      await expect(AgencyService.reactivateAgency("agency-001")).rejects.toThrow(AppError);
    });

    it("throws not found for nonexistent agency", async () => {
      (prisma.agency.findUnique as any).mockResolvedValue(null);
      await expect(AgencyService.reactivateAgency("nonexistent")).rejects.toThrow(AppError);
    });
  });

  // ── getAgencyStats ──────────────────────────────────────────────────────────

  describe("getAgencyStats", () => {
    it("returns correct aggregated stats", async () => {
      (prisma.agency.count as any)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(1);
      (prisma.agency.groupBy as any)
        .mockResolvedValueOnce([{ type: "FEDERAL", _count: 1 }, { type: "STATE", _count: 9 }])
        .mockResolvedValueOnce([{ jurisdictionLevel: "NATIONAL", _count: 1 }]);

      const stats = await AgencyService.getAgencyStats();
      expect(stats.total).toBe(10);
      expect(stats.active).toBe(8);
      expect(stats.inactive).toBe(1); // 10 - 8 - 1
      expect(stats.byType).toHaveProperty("FEDERAL", 1);
    });
  });

  // ── validateJurisdictionLevel ───────────────────────────────────────────────

  describe("validateJurisdictionLevel (via createAgency)", () => {
    const invalid = [
      { type: "FEDERAL", jurisdictionLevel: JurisdictionLevel.STATE },
      { type: "STATE", jurisdictionLevel: JurisdictionLevel.NATIONAL },
      { type: "LOCAL", jurisdictionLevel: JurisdictionLevel.NATIONAL },
    ];

    it.each(invalid)("rejects invalid combination: $type + $jurisdictionLevel", async ({ type, jurisdictionLevel }) => {
      (prisma.agency.findUnique as any).mockResolvedValue(null);
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCreator);

      await expect(
        AgencyService.createAgency({ ...mockCreateDTO, type, jurisdictionLevel } as any)
      ).rejects.toThrow(/Invalid combination/i);
    });
  });
});