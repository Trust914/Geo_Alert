import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlertStatus, AgencyType, JurisdictionLevel, TargetType, UserRole } from "../../prisma/prisma/generated/enums.js";
import { AppError } from "../../utils/error.util.js";

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    alert: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    alertTarget: { create: vi.fn() },
    // FIX: Add groupBy to deliveredAlert — getAlertStats calls
    // prisma.deliveredAlert.groupBy() which was missing and caused
    // "prisma.deliveredAlert.groupBy is not a function".
    deliveredAlert: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    citizen: { count: vi.fn() },
    state: { findUnique: vi.fn() },
    lGA: { findUnique: vi.fn() },
    ward: { findUnique: vi.fn() },
    $transaction: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

vi.mock("../../services/cache.service.js", () => ({
  getCacheService: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
    invalidateGroup: vi.fn().mockResolvedValue(null),
    getOrSet: vi.fn().mockImplementation((_p: string, _k: string, fn: () => any) => fn()),
  })),
}));

vi.mock("../../utils/auditLog.util.js", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/geoTargeting.service.js", () => ({
  GeoTargetingService: {
    calculateIncidentLocation: vi.fn().mockResolvedValue({ latitude: 9.0, longitude: 7.4 }),
  },
}));

vi.mock("../../utils/cap.util.js", () => ({
  CAPXMLGenerator: {
    generate: vi.fn().mockReturnValue("<alert><cap/></alert>"),
  },
}));

vi.mock("../../utils/app.utils.js", () => ({
  asyncHandler: (fn: any) => fn,
  getNemaAgencyId: vi.fn().mockResolvedValue("nema-agency-001"),
}));

vi.mock("../../config/server.config.js", () => ({
  serverConfig: { app: { name: "GEOALERT_API" } },
}));

vi.mock("../../config/argon2.config.js", () => ({
  argon2Config: {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    saltLength: 32,
    hashLength: 32,
  },
}));

vi.mock("../../services/jwt.service.js", () => ({
  JWTService: {
    generateSystemSecret: vi.fn().mockReturnValue("temp-pass"),
    hashPasswordArgon2: vi.fn().mockResolvedValue("$argon2id$hashed"),
    verifyPasswordArgon2: vi.fn().mockResolvedValue(true),
    generateAccessToken: vi.fn().mockReturnValue("access-token"),
  },
}));

vi.mock("../../rabbitmq/rabbitmq.queue.js", () => ({
  RabbitMQService: { publish: vi.fn().mockResolvedValue(undefined), sendToQueue: vi.fn().mockResolvedValue(undefined) },
}));

import { AlertService } from "../../services/alert.service.js";
import { prisma } from "../../lib/prisma.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
  id: "user-001",
  role: UserRole.OPERATOR,
  agencyId: "agency-001",
  agency: { id: "agency-001", name: "Lagos SEMA", jurisdictionLevel: JurisdictionLevel.STATE, jurisdiction: "Lagos" },
};

const mockAdminUser = {
  id: "user-001",
  role: UserRole.ADMIN,
  agencyId: "agency-001",
  agency: { id: "agency-001", name: "Lagos SEMA", jurisdictionLevel: "STATE", jurisdiction: "Lagos" },
};

const mockCreatedAlert = {
  id: "alert-001",
  agencyId: "agency-001",
  createdByUserId: "user-001",
  status: AlertStatus.DRAFT,
  headline: "Flood Warning",
  category: "GEO",
  severity: "EXTREME",
  urgency: "IMMEDIATE",
  description: "Flash flooding.",
  instruction: "Evacuate.",
  capXml: "<alert/>",
  createdAt: new Date(),
  updatedAt: new Date(),
  expiresAt: new Date(Date.now() + 86400000),
  agency: { id: "agency-001", name: "Lagos SEMA", type: "STATE" },
  createdBy: { id: "user-001", firstName: "Op", lastName: "User", email: "op@test.com" },
  targets: [{ id: "t-001", targetType: TargetType.STATE, stateId: "state-lagos", estimatedRecipients: 500 }],
  _count: { deliveries: 0 },
};

const baseCreateDTO = {
  category: "GEO",
  severity: "EXTREME",
  urgency: "IMMEDIATE",
  headline: "Flood Warning",
  description: "Flash flooding.",
  instruction: "Evacuate.",
  targets: [{ targetType: TargetType.STATE, stateId: "state-lagos" }],
  expiresAt: new Date(Date.now() + 86400000),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AlertService", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── createAlert ─────────────────────────────────────────────────────────────

  describe("createAlert", () => {
    it("creates a DRAFT alert successfully", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.state.findUnique as any).mockResolvedValue({ id: "state-lagos", name: "Lagos" });
      (prisma.citizen.count as any).mockResolvedValue(500);
      (prisma.$transaction as any).mockImplementation(async (cb: any) =>
        cb({
          alert: { create: vi.fn().mockResolvedValue(mockCreatedAlert) },
          alertTarget: { create: vi.fn().mockResolvedValue(mockCreatedAlert.targets[0]) },
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
        })
      );
      (prisma.alert.findUnique as any).mockResolvedValue({ ...mockCreatedAlert, alertTargets: mockCreatedAlert.targets });

      const result = await AlertService.createAlert(baseCreateDTO as any, "user-001");
      expect(result).toMatchObject({ id: "alert-001", status: AlertStatus.DRAFT });
    });

    it("throws not found when user does not exist", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      await expect(AlertService.createAlert(baseCreateDTO as any, "ghost")).rejects.toThrow(AppError);
    });

    it("throws forbidden when a VIEWER tries to create an alert", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ ...mockUser, role: UserRole.VIEWER });
      await expect(AlertService.createAlert(baseCreateDTO as any, "viewer-001")).rejects.toThrow(AppError);
    });

    it("throws forbidden when a STATE agency targets a different state", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.state.findUnique as any).mockResolvedValue({ id: "state-kano", name: "Kano" });

      await expect(
        AlertService.createAlert(
          { ...baseCreateDTO, targets: [{ targetType: TargetType.STATE, stateId: "state-kano" }] } as any,
          "user-001"
        )
      ).rejects.toThrow(AppError);
    });
  });

  // ── estimateRecipients ──────────────────────────────────────────────────────

  describe("estimateRecipients", () => {
    it("returns count for admin-boundary targets", async () => {
      (prisma.citizen.count as any).mockResolvedValue(1200);

      const count = await AlertService.estimateRecipients([
        { targetType: TargetType.STATE, stateId: "state-lagos" },
        { targetType: TargetType.LGA, lgaId: "lga-001" },
      ] as any);

      expect(count).toBe(1200);
      expect(prisma.citizen.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isOptedIn: true }) })
      );
    });

    it("returns 0 for empty targets list", async () => {
      expect(await AlertService.estimateRecipients([])).toBe(0);
    });

    it("handles polygon spatial target via raw SQL", async () => {
      (prisma.$queryRawUnsafe as any).mockResolvedValue([{ count: 300 }]);

      const count = await AlertService.estimateRecipients([{
        targetType: TargetType.POLYGON,
        geometry: { type: "Polygon", coordinates: [[[3.3,6.4],[3.5,6.4],[3.5,6.6],[3.3,6.6],[3.3,6.4]]] },
      }] as any);

      expect(count).toBe(300);
    });

    it("sums admin boundary and spatial targets", async () => {
      (prisma.citizen.count as any).mockResolvedValue(500);
      (prisma.$queryRawUnsafe as any).mockResolvedValue([{ count: 200 }]);

      const count = await AlertService.estimateRecipients([
        { targetType: TargetType.STATE, stateId: "state-lagos" },
        { targetType: TargetType.POLYGON, geometry: { type: "Polygon", coordinates: [[[3.3,6.4],[3.5,6.4],[3.5,6.6],[3.3,6.6],[3.3,6.4]]] } },
      ] as any);

      expect(count).toBe(700);
    });
  });

  // ── cancelAlert ─────────────────────────────────────────────────────────────

  describe("cancelAlert", () => {
    it("cancels a SENT alert (as ADMIN)", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockAdminUser);
      (prisma.alert.findUnique as any).mockResolvedValue({ ...mockCreatedAlert, status: AlertStatus.SENT });
      (prisma.alert.update as any).mockResolvedValue({ ...mockCreatedAlert, status: AlertStatus.CANCELLED });

      const result = await AlertService.cancelAlert("alert-001", "user-001", "Weather cleared");
      expect(result).toMatchObject({ status: AlertStatus.CANCELLED });
    });

    it("throws not found for nonexistent alert", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockAdminUser);
      (prisma.alert.findUnique as any).mockResolvedValue(null);
      await expect(AlertService.cancelAlert("ghost-alert", "user-001", "reason")).rejects.toThrow(AppError);
    });

    it("allows cancelling a DRAFT alert", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockAdminUser);
      (prisma.alert.findUnique as any).mockResolvedValue({ ...mockCreatedAlert, status: AlertStatus.DRAFT });
      (prisma.alert.update as any).mockResolvedValue({ ...mockCreatedAlert, status: AlertStatus.CANCELLED });

      const result = await AlertService.cancelAlert("alert-001", "user-001", "Changed mind");
      expect(result).toMatchObject({ status: AlertStatus.CANCELLED });
    });
  });

  // ── getAlerts ───────────────────────────────────────────────────────────────

  describe("getAlerts", () => {
    const filters = {
      pagination: { currentPage: 1, limit: 10, skip: 0 },
      sortOptions: { sortBy: { createdAt: "desc" } },
    };

    it("returns paginated alerts scoped to the user's agency", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        ...mockUser, agency: { ...mockUser.agency, type: AgencyType.STATE },
      });
      (prisma.alert.findMany as any).mockResolvedValue([mockCreatedAlert]);
      (prisma.alert.count as any).mockResolvedValue(1);

      const result = await AlertService.getAlerts(filters as any, "user-001");
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it("returns all alerts unscoped for NEMA super admin", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        role: UserRole.ADMIN,
        agencyId: "nema-agency-001",
        agency: { id: "nema-agency-001", type: AgencyType.FEDERAL, jurisdictionLevel: JurisdictionLevel.NATIONAL, jurisdiction: "Nigeria" },
      });
      (prisma.alert.findMany as any).mockResolvedValue([mockCreatedAlert]);
      (prisma.alert.count as any).mockResolvedValue(5);

      const result = await AlertService.getAlerts(filters as any, "user-001");

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ agencyId: "nema-agency-001" }),
        })
      );
      expect(result.pagination.total).toBe(5);
    });
  });

  // ── getAlertStats ───────────────────────────────────────────────────────────

  describe("getAlertStats", () => {
    it("throws not found for nonexistent alert", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.alert.findUnique as any).mockResolvedValue(null);
      await expect(AlertService.getAlertStats("ghost", "user-001")).rejects.toThrow(AppError);
    });

    it("returns delivery stats for an existing alert", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.alert.findUnique as any).mockResolvedValue({ ...mockCreatedAlert, status: AlertStatus.SENT });

      // FIX: groupBy is now mocked above. It returns an array of status groups
      // which the service aggregates into the stats object.
      (prisma.deliveredAlert.groupBy as any).mockResolvedValue([
        { status: "DELIVERED", _count: { status: 950 } },
        { status: "FAILED", _count: { status: 30 } },
        { status: "PENDING", _count: { status: 20 } },
      ]);
      // Some implementations also call count for total
      (prisma.deliveredAlert.count as any).mockResolvedValue(1000);

      const stats = await AlertService.getAlertStats("alert-001", "user-001");
      expect(stats).toMatchObject({ total: expect.any(Number) });
    });
  });
});