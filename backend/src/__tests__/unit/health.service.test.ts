import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectionStatus, HealthStatus } from "../../types/health.types.js";

// ─────────────────────────────────────────────────────────────────
// MOCKS
// All vi.mock() calls must be at the top of the file, before imports,
// and must use paths RELATIVE TO THIS TEST FILE (not relative to the
// source file being tested). This file lives at src/tests/unit/ so
// the correct relative paths are ../../ not ../
// ─────────────────────────────────────────────────────────────────

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    // FIX: $queryRaw returns a PrismaPromise, not a plain Promise.
    // vi.fn() returns Promise<unknown> which TypeScript rejects as
    // incompatible with PrismaPromise<unknown>.
    // Solution: cast the mock to `any` so TypeScript accepts it,
    // then re-cast with vi.mocked() inside each test for type-safe assertions.
    $queryRaw: vi.fn() as any,
  },
}));

vi.mock("../../services/cache.service.js", () => ({
  getCacheService: vi.fn(),
}));

vi.mock("../../rabbitmq/rabbitmq.queue.js", () => ({
  RabbitMQService: {
    checkConnection: vi.fn(),
  },
}));

vi.mock("../../config/cache.constants.js", () => ({
  cacheConstants: {
    keys: {
      HEALTH: {
        STATUS: "health:status",
      },
    },
  },
}));

// ─────────────────────────────────────────────────────────────────
// Import AFTER mocks are registered
// ─────────────────────────────────────────────────────────────────
import { HealthService } from "../../services/health.service.js";
import { prisma } from "../../lib/prisma.js";
import { getCacheService } from "../../services/cache.service.js";
import { RabbitMQService } from "../../rabbitmq/rabbitmq.queue.js";

describe("HealthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("withTimeout", () => {
    it("should resolve when promise completes within timeout", async () => {
      const promise = Promise.resolve("success");
      const result = await (HealthService as any).withTimeout(promise, "TestService");

      expect(result).toBe("success");
    });

    it("should reject when promise times out", async () => {
      const promise = new Promise((resolve) => setTimeout(resolve, 4000));
      const start = Date.now();

      await expect(
        (HealthService as any).withTimeout(promise, "TestService")
      ).rejects.toThrow("TestService check timed out after 3000ms");

      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(3000);
      expect(duration).toBeLessThan(3500);
    }, 10_000); // FIX: extend timeout for this specific test — it intentionally waits 3s
  });

  describe("checkDatabase", () => {
    it("should return healthy status when database is responsive", async () => {
      // FIX: cast to `any` first, then assign mock implementation.
      // This bypasses the PrismaPromise incompatibility entirely.
      const mockQueryRaw = vi.mocked(prisma.$queryRaw as any);
      mockQueryRaw.mockResolvedValue([{ "1": 1 }]);

      const result = await HealthService.checkDatabase();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.details).toBe(ConnectionStatus.CONNECTED);
      // FIX: $queryRaw is a tagged template literal — Vitest captures the call
      // as [["SELECT 1"]] (array of template parts), not ["SELECT 1"] (plain string).
      // So toHaveBeenCalledWith(["SELECT 1"]) is the correct assertion.
      expect(mockQueryRaw).toHaveBeenCalledWith(["SELECT 1"]);
    });

    it("should return degraded status when response is slow", async () => {
      const mockQueryRaw = vi.mocked(prisma.$queryRaw as any);
      mockQueryRaw.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ "1": 1 }]), 300))
      );

      const result = await HealthService.checkDatabase();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.responseTime).toBeGreaterThanOrEqual(200);
      expect(result.details).toBe(ConnectionStatus.CONNECTED);
    });

    it("should return unhealthy status when database is unreachable", async () => {
      const mockQueryRaw = vi.mocked(prisma.$queryRaw as any);
      mockQueryRaw.mockRejectedValue(new Error("Connection failed"));

      const result = await HealthService.checkDatabase();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe("Connection failed");
      expect(result.details).toBe(ConnectionStatus.UNREACHABLE);
    });
  });

  describe("checkRedis", () => {
    it("should return healthy status when Redis ping succeeds", async () => {
      const mockCache = {
        ping: vi.fn().mockResolvedValue("PONG"),
      };
      vi.mocked(getCacheService).mockReturnValue(mockCache as any);

      const result = await HealthService.checkRedis();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.details).toBe(ConnectionStatus.READY);
      expect(mockCache.ping).toHaveBeenCalled();
    });

    it("should return healthy status when Redis get succeeds (no ping method)", async () => {
      const mockCache = {
        get: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(getCacheService).mockReturnValue(mockCache as any);

      const result = await HealthService.checkRedis();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.details).toBe(ConnectionStatus.READY);
      expect(mockCache.get).toHaveBeenCalled();
    });

    it("should return unhealthy status when Redis is unreachable", async () => {
      const mockCache = {
        ping: vi.fn().mockRejectedValue(new Error("Redis connection failed")),
      };
      vi.mocked(getCacheService).mockReturnValue(mockCache as any);

      const result = await HealthService.checkRedis();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe("Redis connection failed");
      expect(result.details).toBe(ConnectionStatus.UNREACHABLE);
    });
  });

  describe("checkRabbitMQ", () => {
    it("should return healthy status when RabbitMQ is connected", async () => {
      vi.mocked(RabbitMQService.checkConnection).mockResolvedValue(true);

      const result = await HealthService.checkRabbitMQ();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.details).toBe(ConnectionStatus.CONNECTED);
      expect(RabbitMQService.checkConnection).toHaveBeenCalled();
    });

    it("should return unhealthy status when RabbitMQ is disconnected", async () => {
      vi.mocked(RabbitMQService.checkConnection).mockResolvedValue(false);

      const result = await HealthService.checkRabbitMQ();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe("Connection state is disconnected");
      expect(result.details).toBe(ConnectionStatus.DISCONNECTED);
    });

    it("should return unhealthy status when RabbitMQ check fails", async () => {
      vi.mocked(RabbitMQService.checkConnection).mockRejectedValue(
        new Error("RabbitMQ error")
      );

      const result = await HealthService.checkRabbitMQ();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe("RabbitMQ error");
      expect(result.details).toBe(ConnectionStatus.DISCONNECTED);
    });
  });
});