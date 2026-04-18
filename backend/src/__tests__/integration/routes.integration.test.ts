/**
 * Integration Tests — Agency, Alert, User Routes
 *
 * Uses the REAL database connection exactly as the app does in development.
 * Env vars are loaded by vitest.config.ts from envs/.env.development before
 * this file is evaluated, so database.config.ts receives real values and
 * Prisma connects normally.
 *
 * Run with:
 *   NODE_ENV=development npm run test
 *
 * Tests are automatically SKIPPED (not failed) when PG_DB_PASSWORD is absent
 * so the unit-test suite stays green in environments that have no DB.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// ─── Guard: skip when DB password is not available ───────────────────────────
// database.config.ts calls getSecret("postgres_password", "PG_DB_PASSWORD")
// which returns undefined when neither the Docker secret file nor the env var
// exists. node-postgres then throws "SASL: client password must be a string".
// We detect this early so tests skip cleanly instead of crashing.
//
// NOTE: Do NOT mock database.config.js here. The whole point of integration
// tests is to exercise the real connection stack. The vitest.config.ts already
// loads envs/.env.development via dotenv before any test file is evaluated.
const DB_AVAILABLE =
  typeof process.env.PG_DB_PASSWORD === "string" &&
  process.env.PG_DB_PASSWORD.length > 0;

import request from "supertest";
import type { Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { prisma } from "../../lib/prisma.js";
import { errorHandlerMiddleware } from "../../middlewares/error.middleware.js";
import { notFoundMiddleware } from "../../middlewares/additional.middleware.js";
import { initializeCacheService } from "../../services/cache.service.js";

// Route imports
import bffRoutes from "../../routes/bff.routes.js";
import agencyRoutes from "../../routes/agency.routes.js";
import userRoutes from "../../routes/user.routes.js";
import alertRoutes from "../../routes/alert.routes.js";

// ─── Build a minimal test app ─────────────────────────────────────────────────

function buildTestApp(): Express {
  initializeCacheService({} as any);

  const app = express();
  app.set("trust proxy", "loopback");
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  const api = "/api/v1";
  app.use(`${api}/bff`, bffRoutes);
  app.use(`${api}/agency`, agencyRoutes);
  app.use(`${api}/user`, userRoutes);
  app.use(`${api}/alert`, alertRoutes);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}

// ─── State shared across test blocks ─────────────────────────────────────────

let app: Express;
let superAdminCookie: string;
let agencyAdminCookie: string;
let createdAgencyId: string;
let createdAlertId: string;
let createdUserId: string;

// ─── Helper: login and extract the session cookie ────────────────────────────
// Returns an empty string (not a valid cookie) when login fails — callers
// that need auth must gate on AUTH_AVAILABLE.
async function login(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post("/api/v1/bff/login")
    .send({ email, password });

  if (res.status !== 200) {
    console.warn(
      `⚠️  Login failed for ${email} (status ${res.status}) — ` +
      `authenticated tests will be skipped. ` +
      `Set SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD / AGENCY_ADMIN_EMAIL / ` +
      `AGENCY_ADMIN_PASSWORD env vars to match your seeded DB.`
    );
    return "";
  }

  const setCookie = res.headers["set-cookie"];
  return Array.isArray(setCookie) ? (setCookie[0] as string) : (setCookie as string);
}

// ─── Suite setup ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!DB_AVAILABLE) return;

  await prisma.$connect();
  app = buildTestApp();

  superAdminCookie = await login(
    process.env.SUPER_ADMIN_EMAIL ?? "super@nema.gov.ng",
    process.env.SUPER_ADMIN_PASSWORD ?? "Password@123"
  );

  agencyAdminCookie = await login(
    process.env.AGENCY_ADMIN_EMAIL ?? "admin@lagos.gov.ng",
    process.env.AGENCY_ADMIN_PASSWORD ?? "Password@123"
  );
});

// ─── Auth availability guard ──────────────────────────────────────────────────
// True only when DB is up AND both login calls returned real session cookies.
// Tests that send authenticated requests are skipped when this is false so
// a wrong password in the env never causes a suite-level crash.
const AUTH_AVAILABLE = () => DB_AVAILABLE && !!superAdminCookie && !!agencyAdminCookie;

afterAll(async () => {
  if (!DB_AVAILABLE) return;

  try {
    if (createdAlertId) {
      await prisma.alert.delete({ where: { id: createdAlertId } }).catch(() => {});
    }
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
    if (createdAgencyId) {
      await prisma.agency
        .update({ where: { id: createdAgencyId }, data: { status: "INACTIVE" } })
        .catch(() => {});
    }
  } finally {
    await prisma.$disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BFF AUTH
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/v1/bff/login", () => {
  it.skipIf(!DB_AVAILABLE)("returns 400 when body is empty", async () => {
    const res = await request(app).post("/api/v1/bff/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it.skipIf(!DB_AVAILABLE)("returns 401 for wrong credentials", async () => {
    const res = await request(app)
      .post("/api/v1/bff/login")
      .send({ email: "nobody@fake.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it.skipIf(!AUTH_AVAILABLE())("returns 200 and sets a session cookie for valid credentials", async () => {
    const res = await request(app)
      .post("/api/v1/bff/login")
      .send({
        email: process.env.SUPER_ADMIN_EMAIL ?? "super@nema.gov.ng",
        password: process.env.SUPER_ADMIN_PASSWORD ?? "Password@123",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email: expect.any(String) });
    expect(res.headers["set-cookie"]).toBeDefined();
  });
});

describe("GET /api/v1/bff/me", () => {
  it.skipIf(!DB_AVAILABLE)("returns 401 without a session cookie", async () => {
    const res = await request(app).get("/api/v1/bff/me");
    expect(res.status).toBe(401);
  });

  it.skipIf(!AUTH_AVAILABLE())("returns 200 with the authenticated user's profile", async () => {
    const res = await request(app)
      .get("/api/v1/bff/me")
      .set("Cookie", superAdminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      role: expect.any(String),
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AGENCY ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

describe("Agency Routes", () => {
  describe("GET /api/v1/agency", () => {
    it.skipIf(!DB_AVAILABLE)("returns 401 without authentication", async () => {
      const res = await request(app).get("/api/v1/agency");
      expect(res.status).toBe(401);
    });

    it.skipIf(!AUTH_AVAILABLE())("returns 403 for agency admin (super admin only route)", async () => {
      const res = await request(app)
        .get("/api/v1/agency")
        .set("Cookie", agencyAdminCookie);
      expect(res.status).toBe(403);
    });

    it.skipIf(!AUTH_AVAILABLE())("returns paginated agencies for super admin", async () => {
      const res = await request(app)
        .get("/api/v1/agency")
        .set("Cookie", superAdminCookie)
        .query({ page: 1, limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toMatchObject({
        currentPage: expect.any(Number),
        total: expect.any(Number),
      });
    });

    it.skipIf(!AUTH_AVAILABLE())("filters agencies by status=ACTIVE", async () => {
      const res = await request(app)
        .get("/api/v1/agency")
        .set("Cookie", superAdminCookie)
        .query({ status: "ACTIVE" });

      expect(res.status).toBe(200);
      res.body.data.forEach((a: any) => expect(a.status).toBe("ACTIVE"));
    });
  });

  describe("GET /api/v1/agency/stats", () => {
    it.skipIf(!AUTH_AVAILABLE())("returns aggregate stats for super admin", async () => {
      const res = await request(app)
        .get("/api/v1/agency/stats")
        .set("Cookie", superAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        total: expect.any(Number),
        active: expect.any(Number),
      });
    });

    it.skipIf(!AUTH_AVAILABLE())("returns 403 for agency admin", async () => {
      const res = await request(app)
        .get("/api/v1/agency/stats")
        .set("Cookie", agencyAdminCookie);
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/v1/agency (create)", () => {
    it.skipIf(!AUTH_AVAILABLE())("returns 403 when called by an agency admin", async () => {
      const res = await request(app)
        .post("/api/v1/agency")
        .set("Cookie", agencyAdminCookie)
        .send({
          name: "Should Not Be Created",
          type: "STATE",
          jurisdictionLevel: "STATE",
          jurisdiction: "Oyo",
          contactEmail: "x@oyo.gov.ng",
          contactPhone: "+234801111111",
          adminEmail: "admin@oyo.gov.ng",
          adminFirstName: "Jane",
          adminLastName: "Doe",
        });
      expect(res.status).toBe(403);
    });

    it.skipIf(!AUTH_AVAILABLE())("returns 400 for missing required fields", async () => {
      const res = await request(app)
        .post("/api/v1/agency")
        .set("Cookie", superAdminCookie)
        .send({ name: "Incomplete Agency" });
      expect(res.status).toBe(400);
    });

    it.skipIf(!AUTH_AVAILABLE())("creates an agency and returns 201", async () => {
      const unique = Date.now();
      const res = await request(app)
        .post("/api/v1/agency")
        .set("Cookie", superAdminCookie)
        .send({
          name: `Integration Test Agency ${unique}`,
          type: "STATE",
          jurisdictionLevel: "STATE",
          jurisdiction: "Rivers",
          contactEmail: `contact+${unique}@rivers.gov.ng`,
          contactPhone: "+234802222222",
          adminEmail: `admin+${unique}@rivers.gov.ng`,
          adminFirstName: "Rivers",
          adminLastName: "Admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ type: "STATE", status: "ACTIVE" });
      createdAgencyId = res.body.data.id;
    });

    it.skipIf(!AUTH_AVAILABLE())("returns 409 when agency name already exists", async () => {
      if (!createdAgencyId) return;
      const agency = await prisma.agency.findUnique({ where: { id: createdAgencyId } });
      if (!agency) return;

      const unique = Date.now();
      const res = await request(app)
        .post("/api/v1/agency")
        .set("Cookie", superAdminCookie)
        .send({
          name: agency.name,
          type: "STATE",
          jurisdictionLevel: "STATE",
          jurisdiction: "Rivers",
          contactEmail: `dup+${unique}@rivers.gov.ng`,
          contactPhone: "+234802222222",
          adminEmail: `dup+${unique}@rivers.gov.ng`,
          adminFirstName: "Dup",
          adminLastName: "Test",
        });

      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/v1/agency/:id", () => {
    it.skipIf(!AUTH_AVAILABLE())("returns agency details", async () => {
      if (!createdAgencyId) return;
      const res = await request(app)
        .get(`/api/v1/agency/${createdAgencyId}`)
        .set("Cookie", superAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdAgencyId);
    });

    it.skipIf(!AUTH_AVAILABLE())("returns 404 for a nonexistent ID", async () => {
      const res = await request(app)
        .get("/api/v1/agency/00000000-0000-0000-0000-000000000000")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

describe("Alert Routes", () => {
  let stateId: string;

  beforeAll(async () => {
    if (!DB_AVAILABLE) return;
    const state = await prisma.state.findFirst();
    if (state) stateId = state.id;
  });

  const alertBody = () => ({
    category: "GEO",
    severity: "EXTREME",
    urgency: "IMMEDIATE",
    headline: `Integration Test Alert ${Date.now()}`,
    description: "Integration test flood simulation.",
    instruction: "Evacuate low-lying areas immediately.",
    targets: [{ targetType: "STATE", stateId }],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  describe("POST /api/v1/alert/estimate-recipients", () => {
    it.skipIf(!AUTH_AVAILABLE())("returns an estimated count for valid targets", async () => {
      if (!stateId) return;
      const res = await request(app)
        .post("/api/v1/alert/estimate-recipients")
        .set("Cookie", superAdminCookie)
        .send({ targets: [{ targetType: "STATE", stateId }] });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ estimatedRecipients: expect.any(Number) });
    });

    it.skipIf(!AUTH_AVAILABLE())("returns 400 when targets is not an array", async () => {
      const res = await request(app)
        .post("/api/v1/alert/estimate-recipients")
        .set("Cookie", superAdminCookie)
        .send({ targets: "invalid" });

      expect(res.status).toBe(400);
    });

    it.skipIf(!DB_AVAILABLE)("returns 401 without authentication", async () => {
      const res = await request(app)
        .post("/api/v1/alert/estimate-recipients")
        .send({ targets: [] });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/alert (create DRAFT)", () => {
    it.skipIf(!DB_AVAILABLE)("returns 401 without authentication", async () => {
      const res = await request(app).post("/api/v1/alert").send(alertBody());
      expect(res.status).toBe(401);
    });

    it.skipIf(!AUTH_AVAILABLE())("returns 400 when targets are missing", async () => {
      const body = alertBody();
      (body as any).targets = undefined;
      const res = await request(app)
        .post("/api/v1/alert")
        .set("Cookie", superAdminCookie)
        .send(body);
      expect(res.status).toBe(400);
    });

    it.skipIf(!AUTH_AVAILABLE())("creates a DRAFT alert and returns 201", async () => {
      if (!stateId) return;
      const res = await request(app)
        .post("/api/v1/alert")
        .set("Cookie", superAdminCookie)
        .send(alertBody());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ status: "DRAFT" });
      createdAlertId = res.body.data.id;
    });
  });

  describe("GET /api/v1/alert", () => {
    it.skipIf(!AUTH_AVAILABLE())("returns paginated alerts", async () => {
      const res = await request(app)
        .get("/api/v1/alert")
        .set("Cookie", superAdminCookie)
        .query({ page: 1, limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
    });

    it.skipIf(!AUTH_AVAILABLE())("filters by status=DRAFT", async () => {
      const res = await request(app)
        .get("/api/v1/alert")
        .set("Cookie", superAdminCookie)
        .query({ status: "DRAFT" });

      expect(res.status).toBe(200);
      res.body.data.forEach((a: any) => expect(a.status).toBe("DRAFT"));
    });
  });

  describe("GET /api/v1/alert/:alertId", () => {
    it.skipIf(!AUTH_AVAILABLE())("returns alert details by ID", async () => {
      if (!createdAlertId) return;
      const res = await request(app)
        .get(`/api/v1/alert/${createdAlertId}`)
        .set("Cookie", superAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdAlertId);
    });

    it.skipIf(!AUTH_AVAILABLE())("returns 404 for a nonexistent alert", async () => {
      const res = await request(app)
        .get("/api/v1/alert/00000000-0000-0000-0000-000000000000")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/alert/:alertId/preview", () => {
    it.skipIf(!AUTH_AVAILABLE())("returns preview data for a DRAFT alert", async () => {
      if (!createdAlertId) return;
      const res = await request(app)
        .get(`/api/v1/alert/${createdAlertId}/preview`)
        .set("Cookie", superAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe("POST /api/v1/alert/:alertId/cancel", () => {
    it.skipIf(!AUTH_AVAILABLE())("returns 400 when reason is missing", async () => {
      if (!createdAlertId) return;
      const res = await request(app)
        .post(`/api/v1/alert/${createdAlertId}/cancel`)
        .set("Cookie", superAdminCookie)
        .send({});
      expect(res.status).toBe(400);
    });

    it.skipIf(!DB_AVAILABLE)("returns 401 without a session", async () => {
      const res = await request(app)
        .post(`/api/v1/alert/some-id/cancel`)
        .send({ reason: "test" });
      expect(res.status).toBe(401);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

describe("User Routes", () => {
  let agencyAdminAgencyId: string;
  const uniqueEmail = `testuser+${Date.now()}@integration.test`;

  beforeAll(async () => {
    if (!DB_AVAILABLE) return;
    const email = process.env.AGENCY_ADMIN_EMAIL ?? "admin@lagos.gov.ng";
    const user = await prisma.user.findUnique({
      where: { email },
      select: { agencyId: true },
    });
    if (user) agencyAdminAgencyId = user.agencyId;
  });

  describe("POST /api/v1/user/create", () => {
    it.skipIf(!DB_AVAILABLE)("returns 401 without a session", async () => {
      const res = await request(app)
        .post("/api/v1/user/create")
        .send({ email: uniqueEmail, firstName: "A", lastName: "B", role: "OPERATOR" });
      expect(res.status).toBe(401);
    });

    it.skipIf(!AUTH_AVAILABLE())("creates a user and returns 201", async () => {
      const res = await request(app)
        .post("/api/v1/user/create")
        .set("Cookie", agencyAdminCookie)
        .send({
          email: uniqueEmail,
          firstName: "Integration",
          lastName: "User",
          role: "OPERATOR",
          agencyId: agencyAdminAgencyId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ email: uniqueEmail, role: "OPERATOR" });
      createdUserId = res.body.data.id;
    });

    it.skipIf(!AUTH_AVAILABLE())("returns 409 for a duplicate email", async () => {
      if (!createdUserId) return;
      const res = await request(app)
        .post("/api/v1/user/create")
        .set("Cookie", agencyAdminCookie)
        .send({
          email: uniqueEmail,
          firstName: "Dup",
          lastName: "User",
          role: "OPERATOR",
        });
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/v1/user/:id", () => {
    it.skipIf(!AUTH_AVAILABLE())("returns the user by ID", async () => {
      if (!createdUserId) return;
      const res = await request(app)
        .get(`/api/v1/user/${createdUserId}`)
        .set("Cookie", agencyAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdUserId);
    });

    it.skipIf(!AUTH_AVAILABLE())("returns 404 for a nonexistent user", async () => {
      const res = await request(app)
        .get("/api/v1/user/00000000-0000-0000-0000-000000000000")
        .set("Cookie", agencyAdminCookie);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/user/:id/reactivate", () => {
    it.skipIf(!AUTH_AVAILABLE())("reactivates a user", async () => {
      if (!createdUserId) return;
      const res = await request(app)
        .post(`/api/v1/user/${createdUserId}/reactivate`)
        .set("Cookie", agencyAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /api/v1/user/:id/reset-password", () => {
    it.skipIf(!AUTH_AVAILABLE())("triggers password reset (200 or 428 depending on 2FA)", async () => {
      if (!createdUserId) return;
      const res = await request(app)
        .post(`/api/v1/user/${createdUserId}/reset-password`)
        .set("Cookie", agencyAdminCookie);

      expect([200, 428]).toContain(res.status);
    });
  });

  describe("GET /api/v1/user/agency/:agencyId", () => {
    it.skipIf(!AUTH_AVAILABLE())("returns users for the agency", async () => {
      if (!agencyAdminAgencyId) return;
      const res = await request(app)
        .get(`/api/v1/user/agency/${agencyAdminAgencyId}`)
        .set("Cookie", agencyAdminCookie)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RBAC — cross-route checks
// ═══════════════════════════════════════════════════════════════════════════════

describe("RBAC enforcement", () => {
  it.skipIf(!AUTH_AVAILABLE())("GET /api/v1/agency is 403 for agency admin", async () => {
    const res = await request(app)
      .get("/api/v1/agency")
      .set("Cookie", agencyAdminCookie);
    expect(res.status).toBe(403);
  });

  it.skipIf(!AUTH_AVAILABLE())("GET /api/v1/agency/stats is 403 for agency admin", async () => {
    const res = await request(app)
      .get("/api/v1/agency/stats")
      .set("Cookie", agencyAdminCookie);
    expect(res.status).toBe(403);
  });

  it.skipIf(!AUTH_AVAILABLE())("POST /api/v1/agency is 403 for agency admin", async () => {
    const res = await request(app)
      .post("/api/v1/agency")
      .set("Cookie", agencyAdminCookie)
      .send({});
    expect(res.status).toBe(403);
  });
});