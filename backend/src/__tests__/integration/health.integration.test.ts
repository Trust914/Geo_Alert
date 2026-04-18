import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// Mock the health service
vi.mock("../../services/health.service.js", () => ({
  HealthService: {
    checkDatabase: vi.fn(),
    checkRedis: vi.fn(),
    checkRabbitMQ: vi.fn(),
  },
}));

// Mock the server config
vi.mock("../../config/server.config.js", () => ({
  serverConfig: {
    app: {
      environment: "test",
      version: "1.0.0",
    },
  },
}));

// FIX: HealthController uses `asyncHandler` as a static class initializer:
//   static getHealthStatus = asyncHandler(async (req, res) => { ... });
// That line runs at module-evaluation time (when the class is defined).
// If asyncHandler is undefined, the class instantiation crashes before any
// test runs.  We must include it in the mock so the class initialises cleanly.
vi.mock("../../utils/app.utils.js", () => ({
  asyncHandler: (fn: any) => fn,
  formatBytes: vi.fn((bytes) => `${bytes} bytes`),
  formatCpuTime: vi.fn(() => ({ userProcessTime: "10ms", osSystemTime: "5ms" })),
  formatUptime: vi.fn(() => "1 day"),
}));

import { HealthService } from "../../services/health.service.js";
import { HealthStatus, ConnectionStatus } from "../../types/health.types.js";
import { HealthController } from "../../controllers/health.controller.js";

const mockHealthService = vi.mocked(HealthService);

// Create test app
const app = express();
app.use(express.json());
app.get("/api/v1/health", HealthController.getHealthStatus);

describe("Health API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockHealthService.checkDatabase.mockResolvedValue({
      status: HealthStatus.HEALTHY,
      responseTime: 10,
      details: ConnectionStatus.CONNECTED,
    });

    mockHealthService.checkRedis.mockResolvedValue({
      status: HealthStatus.HEALTHY,
      responseTime: 5,
      details: ConnectionStatus.READY,
    });

    mockHealthService.checkRabbitMQ.mockResolvedValue({
      status: HealthStatus.HEALTHY,
      responseTime: 8,
      details: ConnectionStatus.CONNECTED,
    });
  });

  describe("GET /api/v1/health", () => {
    it("should return healthy status when all services are healthy", async () => {
      const response = await request(app).get("/api/v1/health").expect(200);

      expect(response.body.status).toBe(HealthStatus.HEALTHY);
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body.uptime).toBe("1 day");
      expect(response.body.environment).toBe("test");
      expect(response.body.version).toBe("1.0.0");

      // Check services
      expect(response.body.services.api.status).toBe(HealthStatus.HEALTHY);
      expect(response.body.services.database.status).toBe(HealthStatus.HEALTHY);
      expect(response.body.services.redis.status).toBe(HealthStatus.HEALTHY);
      expect(response.body.services.rabbitmq.status).toBe(HealthStatus.HEALTHY);

      // Check system info
      expect(response.body.system.memory.physicalTotal).toMatch(/\d+ bytes/);
      expect(response.body.system.cpu.userProcessTime).toMatch(/\d+ms/);
    });

    it("should return degraded status when some services are degraded", async () => {
      mockHealthService.checkDatabase.mockResolvedValue({
        status: HealthStatus.DEGRADED,
        responseTime: 300,
        details: ConnectionStatus.CONNECTED,
      });

      const response = await request(app).get("/api/v1/health").expect(200);

      expect(response.body.status).toBe(HealthStatus.DEGRADED);
    });

    it("should return unhealthy status when some services are unhealthy", async () => {
      mockHealthService.checkDatabase.mockResolvedValue({
        status: HealthStatus.UNHEALTHY,
        responseTime: 100,
        error: "Database connection failed",
        details: ConnectionStatus.UNREACHABLE,
      });

      const response = await request(app).get("/api/v1/health").expect(503); // SERVICE_UNAVAILABLE

      expect(response.body.status).toBe(HealthStatus.UNHEALTHY);
      expect(response.body.services.database.error).toBe("Database connection failed");
    });

    it("should return correct content type", async () => {
      const response = await request(app).get("/api/v1/health").expect(200);

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });
  });
});