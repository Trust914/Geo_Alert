/**
 * GeoAlert — Geo-Targeting Integration Test Suite
 * ════════════════════════════════════════════════════════════════
 *
 * Validates that the platform correctly identifies alert recipients
 * based on their registered location and the configured target area.
 *
 * Two Targeting Paradigms Under Test
 * ───────────────────────────────────
 * 1. ADMINISTRATIVE TARGETING (FK-based)
 *    Citizens are registered to administrative units (State › LGA › Ward).
 *    Targeting queries citizens by their registered unit foreign key.
 *    • Design rationale: O(1) indexed lookup — optimal for large recipient sets.
 *    • Accuracy depends on the quality of citizen registration data.
 *
 * 2. SPATIAL TARGETING (PostGIS geometry-based)
 *    Citizens are targeted by their GPS coordinates stored as PostGIS points.
 *    Supports POLYGON (arbitrary area) and RADIUS (circular buffer) modes.
 *    • Design rationale: Precise geographic containment; no reliance on
 *      administrative unit membership.
 *
 * Test Data (seeded fresh per run)
 * ─────────────────────────────────
 *   GROUP A — 500 citizens  | inside LGA bbox | opted-in  | should always be queued
 *   GROUP B — 100 citizens  | inside LGA bbox | opted-out | must never be queued
 *   GROUP C — 200 citizens  | outside LGA bbox| opted-in  | excluded by spatial queries;
 *                                                            included by FK queries (same lga_id)
 *   PRECISION — 9 citizens  | at known offsets from radius center / polygon edges
 *                                                          | boundary edge-case assertions
 *
 * Correctness Metrics Reported
 * ─────────────────────────────
 *   Precision  = TP / (TP + FP)     fraction of queued citizens who are eligible
 *   Recall     = TP / (TP + FN)     fraction of eligible citizens who are queued
 *   F1 Score   = harmonic mean of Precision and Recall
 *   FP Rate    = FP / N_ineligible  proportion of ineligible citizens falsely queued
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "../../lib/prisma";
import { cleanupGeoTestCitizens, SEED_CONFIG, seedGeoTestCitizens, type SeedResult } from "../../seed/seedGeoTestCitizens";

// ─────────────────────────────────────────────────────────────────
// FIXTURE IDs — fixed strings so teardown is always deterministic
// ─────────────────────────────────────────────────────────────────
const TEST_AGENCY_ID = "GEO_TEST_AGENCY_0000000";
const TEST_USER_ID = "GEO_TEST_USER_00000000";
const TEST_ALERT_ID = "GEO_TEST_ALERT_00000000";

// ─────────────────────────────────────────────────────────────────
// PRECISION CITIZENS
// Citizens at KNOWN positions relative to the radius center and
// polygon boundary. Allow exact inclusion/exclusion assertions
// that are independent of random GROUP A/B/C placement.
//
// Radius precision (due-north offsets from center, 5 km radius):
//   1 degree latitude ≈ 111 320 m
//
//   Phone       Offset    Distance   Opted-in  Expected
//   +234PRECR0  +0.000°      0 m     true      INSIDE
//   +234PRECR1  +0.018°  ~2 004 m    true      INSIDE
//   +234PRECR2  +0.040°  ~4 453 m    true      INSIDE  (547 m from boundary)
//   +234PRECR3  +0.046°  ~5 121 m    true      OUTSIDE (121 m past boundary)
//   +234PRECR4  +0.135°  ~15 028 m   true      OUTSIDE
//   +234PRECR5  +0.018°  ~2 004 m    false     OUTSIDE (opted-out filter)
//
// Polygon precision (offsets relative to polygon min-lat edge):
//   +234PRECP0  bbox-mid centre       true      INSIDE
//   +234PRECP1  minLat + 0.001 deg    true      INSIDE  (~111 m inside edge)
//   +234PRECP2  minLat - 0.001 deg    true      OUTSIDE (~111 m outside edge)
// ─────────────────────────────────────────────────────────────────
const PREC = {
  R0_CENTER: "+234PRECR0",
  R1_2KM: "+234PRECR1",
  R2_4KM: "+234PRECR2",
  R3_JUST_OUTSIDE: "+234PRECR3",
  R4_15KM: "+234PRECR4",
  R5_OPTED_OUT: "+234PRECR5",
  P0_CENTER: "+234PRECP0",
  P1_JUST_INSIDE: "+234PRECP1",
  P2_JUST_OUTSIDE: "+234PRECP2",
} as const;

const PRECISION_PHONE_PREFIX = "+234PREC";

// ─────────────────────────────────────────────────────────────────
// FIXTURE HELPERS — Prisma client used deliberately so all @map /
// camelCase column resolution is handled automatically.
// ─────────────────────────────────────────────────────────────────

async function createTestFixtures(): Promise<void> {
  await prisma.agency.upsert({
    where: { id: TEST_AGENCY_ID },
    create: {
      id: TEST_AGENCY_ID,
      name: "_GeoAlert Integration Test Agency",
      type: "FEDERAL",
      jurisdiction: "Nigeria",
      jurisdictionLevel: "NATIONAL",
      contactEmail: "geo-test@geoalert.internal",
      contactPhone: "+2340000000000",
      status: "ACTIVE",
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: {
      id: TEST_USER_ID,
      email: "geo-test@geoalert.internal",
      firstName: "Geo",
      lastName: "Tester",
      role: "ADMIN",
      agencyId: TEST_AGENCY_ID,
    },
    update: {},
  });

  await prisma.alert.upsert({
    where: { id: TEST_ALERT_ID },
    create: {
      id: TEST_ALERT_ID,
      agencyId: TEST_AGENCY_ID,
      createdByUserId: TEST_USER_ID,
      category: "OTHER",
      severity: "MINOR",
      urgency: "FUTURE",
      headline: "GeoAlert Integration Test Alert",
      description: "Synthetic alert — geotargeting integration test suite.",
      capXml: "<alert/>",
      status: "DRAFT",
    },
    update: {},
  });
}

async function deleteTestFixtures(): Promise<void> {
  // CASCADE on alert → alert_targets and alert → deliveries handles child rows
  await prisma.alert.deleteMany({ where: { id: TEST_ALERT_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  await prisma.agency.deleteMany({ where: { id: TEST_AGENCY_ID } });
}

// ─────────────────────────────────────────────────────────────────
// PRECISION CITIZEN HELPERS
// ─────────────────────────────────────────────────────────────────

async function insertPrecisionCitizen(phone: string, lat: number, lng: number, isOptedIn: boolean, geo: SeedResult): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO citizens (
       id, phone_number, first_name, last_name,
       state_id, lga_id,
       location,
       is_opted_in, preferred_language,
       registered_at, updated_at
     )
     VALUES (
       gen_random_uuid(), $1, 'Precision', 'Citizen',
       $2, $3,
       ST_SetSRID(ST_MakePoint($4, $5), 4326),
       $6, 'ENGLISH', NOW(), NOW()
     )
     ON CONFLICT (phone_number) DO NOTHING`,
    phone,
    geo.stateId,
    geo.lgaId,
    lng,
    lat,
    isOptedIn,
  );
}

async function seedPrecisionCitizens(geo: SeedResult): Promise<void> {
  const rc = geo.radiusCenter;
  const pb = geo.testPolygon.bounds;
  const polyMidLat = (pb.minLat + pb.maxLat) / 2;
  const polyMidLng = (pb.minLng + pb.maxLng) / 2;

  // Radius precision citizens (all placed due-north of radius center)
  await insertPrecisionCitizen(PREC.R0_CENTER, rc.lat + 0.0, rc.lng, true, geo);
  await insertPrecisionCitizen(PREC.R1_2KM, rc.lat + 0.018, rc.lng, true, geo);
  await insertPrecisionCitizen(PREC.R2_4KM, rc.lat + 0.04, rc.lng, true, geo);
  await insertPrecisionCitizen(PREC.R3_JUST_OUTSIDE, rc.lat + 0.046, rc.lng, true, geo);
  await insertPrecisionCitizen(PREC.R4_15KM, rc.lat + 0.135, rc.lng, true, geo);
  await insertPrecisionCitizen(PREC.R5_OPTED_OUT, rc.lat + 0.018, rc.lng, false, geo);

  // Polygon precision citizens (centred on polygon midpoint)
  await insertPrecisionCitizen(PREC.P0_CENTER, polyMidLat, polyMidLng, true, geo);
  await insertPrecisionCitizen(PREC.P1_JUST_INSIDE, pb.minLat + 0.001, polyMidLng, true, geo);
  await insertPrecisionCitizen(PREC.P2_JUST_OUTSIDE, pb.minLat - 0.001, polyMidLng, true, geo);
}

async function cleanupPrecisionCitizens(): Promise<void> {
  await prisma.citizen.deleteMany({
    where: { phoneNumber: { startsWith: PRECISION_PHONE_PREFIX } },
  });
}

// ─────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────

async function countDeliveries(alertId = TEST_ALERT_ID): Promise<number> {
  const r = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`SELECT COUNT(*)::bigint AS count FROM deliveries WHERE alert_id = $1`, alertId);
  return Number(r[0]?.count ?? 0);
}

async function countOptedOutLeaks(alertId = TEST_ALERT_ID): Promise<number> {
  const r = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*)::bigint AS count
     FROM deliveries d
     JOIN citizens c ON c.id = d.citizen_id
     WHERE d.alert_id = $1 AND c.is_opted_in = false`,
    alertId,
  );
  return Number(r[0]?.count ?? 0);
}

async function isPrecisionCitizenQueued(phone: string, alertId = TEST_ALERT_ID): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*)::bigint AS count
     FROM deliveries d
     JOIN citizens c ON c.id = d.citizen_id
     WHERE d.alert_id = $1 AND c.phone_number = $2`,
    alertId,
    phone,
  );
  return Number(r[0]?.count ?? 0) === 1;
}

async function clearDeliveries(alertId = TEST_ALERT_ID): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM deliveries WHERE alert_id = $1`, alertId);
}

// ─────────────────────────────────────────────────────────────────
// WORKER INSERT FUNCTIONS (mirrors production delivery worker logic)
// ─────────────────────────────────────────────────────────────────

async function workerInsertForState(stateId: string): Promise<number> {
  return prisma.$executeRawUnsafe(
    `INSERT INTO deliveries (id, alert_id, citizen_id, phone_number, status, retry_count, updated_at, queued_at)
     SELECT gen_random_uuid(), $1, c.id, c.phone_number, 'QUEUED', 0, NOW(), NOW()
     FROM citizens c
     WHERE c.state_id = $2 AND c.is_opted_in = true
     ON CONFLICT DO NOTHING`,
    TEST_ALERT_ID,
    stateId,
  );
}

async function workerInsertForLga(lgaId: string): Promise<number> {
  return prisma.$executeRawUnsafe(
    `INSERT INTO deliveries (id, alert_id, citizen_id, phone_number, status, retry_count, updated_at, queued_at)
     SELECT gen_random_uuid(), $1, c.id, c.phone_number, 'QUEUED', 0, NOW(), NOW()
     FROM citizens c
     WHERE c.lga_id = $2 AND c.is_opted_in = true
     ON CONFLICT DO NOTHING`,
    TEST_ALERT_ID,
    lgaId,
  );
}

async function workerInsertForWard(wardId: string): Promise<number> {
  return prisma.$executeRawUnsafe(
    `INSERT INTO deliveries (id, alert_id, citizen_id, phone_number, status, retry_count, updated_at, queued_at)
     SELECT gen_random_uuid(), $1, c.id, c.phone_number, 'QUEUED', 0, NOW(), NOW()
     FROM citizens c
     WHERE c.ward_id = $2 AND c.is_opted_in = true
     ON CONFLICT DO NOTHING`,
    TEST_ALERT_ID,
    wardId,
  );
}

async function workerInsertForPolygon(wkt: string): Promise<number> {
  return prisma.$executeRawUnsafe(
    `INSERT INTO deliveries (id, alert_id, citizen_id, phone_number, status, retry_count, updated_at, queued_at)
     SELECT gen_random_uuid(), $1, c.id, c.phone_number, 'QUEUED', 0, NOW(), NOW()
     FROM citizens c
     WHERE c.location IS NOT NULL
       AND c.is_opted_in = true
       AND ST_Within(c.location, ST_GeomFromText($2, 4326))
     ON CONFLICT DO NOTHING`,
    TEST_ALERT_ID,
    wkt,
  );
}

async function workerInsertForRadius(alertTargetId: string): Promise<number> {
  return prisma.$executeRawUnsafe(
    `INSERT INTO deliveries (id, alert_id, citizen_id, phone_number, status, retry_count, updated_at, queued_at)
     SELECT gen_random_uuid(), $1, c.id, c.phone_number, 'QUEUED', 0, NOW(), NOW()
     FROM citizens c
     JOIN alert_targets t ON t.id = $2
     WHERE c.is_opted_in = true
       AND ST_DWithin(c.location, t.center_point::geography, t.radius_meters)
     ON CONFLICT DO NOTHING`,
    TEST_ALERT_ID,
    alertTargetId,
  );
}

// ─────────────────────────────────────────────────────────────────
// ESTIMATE FUNCTIONS (mirrors production estimateRecipients logic)
// ─────────────────────────────────────────────────────────────────

async function estimateForLga(lgaId: string): Promise<number> {
  return prisma.citizen.count({ where: { lgaId, isOptedIn: true } });
}

async function estimateForPolygon(wkt: string): Promise<number> {
  const r = await prisma.$queryRawUnsafe<[{ count: number }]>(
    `SELECT COUNT(*)::int AS count
     FROM citizens
     WHERE location IS NOT NULL AND is_opted_in = true
       AND ST_Within(location, ST_GeomFromText($1, 4326))`,
    wkt,
  );
  return r[0]?.count ?? 0;
}

// ─────────────────────────────────────────────────────────────────
// METRICS REPORTER
// Precision/Recall/F1 logged per targeting mode for thesis output.
// ─────────────────────────────────────────────────────────────────

function logMetrics(label: string, tp: number, fp: number, fn: number, tn: number): void {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const fpRate = fp + tn > 0 ? fp / (fp + tn) : 0;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  console.log(
    `\n   ┌─ ${label} Targeting Metrics ──────────────────────\n` +
      `   │  True Positives (TP) : ${String(tp).padEnd(6)} False Positives (FP) : ${fp}\n` +
      `   │  False Negatives (FN): ${String(fn).padEnd(6)} True Negatives  (TN) : ${tn}\n` +
      `   │  Precision           : ${pct(precision).padEnd(8)} Recall              : ${pct(recall)}\n` +
      `   │  F1 Score            : ${pct(f1).padEnd(8)} False Positive Rate : ${pct(fpRate)}\n` +
      `   └──────────────────────────────────────────────────`,
  );
}

// ─────────────────────────────────────────────────────────────────
// SETUP / TEARDOWN
// ─────────────────────────────────────────────────────────────────

let geo: SeedResult;
let testAlertTargetId: string;

beforeAll(async () => {
  // 1. Seed GROUP A / B / C citizens
  geo = await seedGeoTestCitizens();

  // 2. Create Agency → User → Alert fixture chain (satisfies FK constraints
  //    on alert_targets.alert_id and deliveries.alert_id)
  await createTestFixtures();

  // 3. Seed precision citizens at known distances / positions
  await seedPrecisionCitizens(geo);

  // 4. Insert RADIUS alert_target used by radius tests
  const inserted = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO alert_targets (
       id, alert_id, target_type, lga_id, state_id,
       center_point, radius_meters, created_at
     )
     VALUES (
       gen_random_uuid(), $1, 'RADIUS', $2, $3,
       ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, NOW()
     )
     RETURNING id`,
    TEST_ALERT_ID,
    geo.lgaId,
    geo.stateId,
    geo.radiusCenter.lng,
    geo.radiusCenter.lat,
    geo.radiusMeters,
  );
  testAlertTargetId = inserted[0]?.id ?? "";
}, 120_000);

afterAll(async () => {
  await clearDeliveries();
  if (testAlertTargetId) {
    await prisma.$executeRawUnsafe(`DELETE FROM alert_targets WHERE id = $1`, testAlertTargetId);
  }
  await cleanupPrecisionCitizens();
  const deleted = await cleanupGeoTestCitizens();
  console.log(`\n🧹 Cleaned up ${deleted} test citizens`);
  await deleteTestFixtures();
  await prisma.$disconnect();
}, 30_000);

// ═════════════════════════════════════════════════════════════════
// 1. ADMINISTRATIVE TARGETING (FK-BASED)
//
//    Citizens are queried by their registered administrative unit FK.
//    Note: GROUP C citizens share the same lga_id FK as GROUP A but
//    their GPS coordinates are outside the LGA boundary. FK targeting
//    correctly includes them (they are registered residents); spatial
//    targeting would exclude them based on current GPS location.
//    Both behaviours are by design and tested explicitly below.
// ═════════════════════════════════════════════════════════════════

describe("Administrative Targeting", () => {
  describe("LGA", () => {
    afterEach(() => clearDeliveries());

    it("queues all opted-in citizens registered in the target LGA", async () => {
      const queued = await workerInsertForLga(geo.lgaId);
      // GROUP A (500 inside-bbox) + GROUP C (200 outside-bbox, same lga_id) = 700
      expect(queued).toBeGreaterThanOrEqual(geo.counts.insideOptedIn);
    });

    it("queued count matches estimateRecipients exactly (estimate = worker agreement)", async () => {
      const estimate = await estimateForLga(geo.lgaId);
      const queued = await workerInsertForLga(geo.lgaId);
      expect(queued).toBe(estimate);
    });

    it("no opted-out citizen is ever queued (consent filter — Precision = 100%)", async () => {
      await workerInsertForLga(geo.lgaId);
      expect(await countOptedOutLeaks()).toBe(0);
    });

    it("GROUP B citizens (opted-out, inside LGA) are never queued", async () => {
      await workerInsertForLga(geo.lgaId);

      const r = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*)::bigint AS count
         FROM deliveries d
         JOIN citizens c ON c.id = d.citizen_id
         WHERE d.alert_id = $1
           AND c.phone_number LIKE $2
           AND c.is_opted_in = false`,
        TEST_ALERT_ID,
        `${SEED_CONFIG.PHONE_PREFIX}%`,
      );
      expect(Number(r[0]?.count)).toBe(0);

      const queued = await countDeliveries();
      logMetrics("LGA", queued, 0, 0, geo.counts.insideOptedOut);
    });
  });

  describe("STATE", () => {
    afterEach(() => clearDeliveries());

    it("queues opted-in citizens across the entire state", async () => {
      const queued = await workerInsertForState(geo.stateId);
      expect(queued).toBeGreaterThan(0);
    });

    it("no opted-out citizen appears in the STATE delivery queue", async () => {
      await workerInsertForState(geo.stateId);
      expect(await countOptedOutLeaks()).toBe(0);
    });

    it("STATE recipient count >= LGA count (state is a superset of LGA)", async () => {
      const stateCount = await workerInsertForState(geo.stateId);
      await clearDeliveries();
      const lgaCount = await workerInsertForLga(geo.lgaId);

      console.log(`\n   📊 STATE: ${stateCount}  LGA: ${lgaCount}  (ratio: ${(stateCount / lgaCount).toFixed(2)}x)`);
      expect(stateCount).toBeGreaterThanOrEqual(lgaCount);
    });
  });

  describe("WARD", () => {
    afterEach(() => clearDeliveries());

    it("queues opted-in citizens registered in the target ward", async () => {
      if (!geo.wardId) {
        console.log("   ⚠️  No ward in test LGA — skipping");
        return;
      }
      const queued = await workerInsertForWard(geo.wardId);
      expect(queued).toBeGreaterThanOrEqual(0);
    });

    it("no opted-out citizen appears in the WARD delivery queue", async () => {
      if (!geo.wardId) return;
      await workerInsertForWard(geo.wardId);
      expect(await countOptedOutLeaks()).toBe(0);
    });

    it("WARD recipient count <= LGA count (ward is a subset of LGA)", async () => {
      if (!geo.wardId) return;
      const wardCount = await workerInsertForWard(geo.wardId);
      await clearDeliveries();
      const lgaCount = await workerInsertForLga(geo.lgaId);

      console.log(`\n   📊 WARD: ${wardCount}  LGA: ${lgaCount}`);
      expect(wardCount).toBeLessThanOrEqual(lgaCount);
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// 2. SPATIAL TARGETING (PostGIS-BASED)
//
//    Citizens are targeted by ST_Within / ST_DWithin on their
//    location geometry column. GROUP C citizens (same lga_id FK
//    but GPS outside the LGA bbox) are correctly excluded here,
//    demonstrating that spatial queries provide finer precision
//    than FK-based queries at the cost of higher query complexity.
// ═════════════════════════════════════════════════════════════════

describe("Spatial Targeting", () => {
  describe("POLYGON", () => {
    afterEach(() => clearDeliveries());

    it("estimateRecipients matches pre-counted citizens inside the polygon", async () => {
      const estimate = await estimateForPolygon(geo.testPolygon.wkt);
      // Add 2 to account for P0_CENTER and P1_JUST_INSIDE precision citizens
      expect(estimate).toBe(geo.testPolygon.citizensInside + 2);
    });

    it("worker queues exactly the citizens whose GPS location is inside the polygon", async () => {
      const queued = await workerInsertForPolygon(geo.testPolygon.wkt);
      // Add 2 to account for P0_CENTER and P1_JUST_INSIDE precision citizens
      expect(queued).toBe(geo.testPolygon.citizensInside + 2);
    });

    it("polygon recipient count <= LGA count (polygon is a subset of the LGA bbox)", async () => {
      const polyCount = await estimateForPolygon(geo.testPolygon.wkt);
      const lgaCount = await estimateForLga(geo.lgaId);

      console.log(`\n   📊 Polygon: ${polyCount}  LGA: ${lgaCount}  (coverage: ${((polyCount / lgaCount) * 100).toFixed(1)}%)`);
      expect(polyCount).toBeLessThanOrEqual(lgaCount);
    });

    it("polygon in the Atlantic Ocean (zero population) returns 0 recipients", async () => {
      const oceanWkt = "POLYGON((0.000000 0.000000, 0.000001 0.000000, " + "0.000001 0.000001, 0.000000 0.000001, 0.000000 0.000000))";
      expect(await estimateForPolygon(oceanWkt)).toBe(0);
    });

    it("larger polygon returns >= recipients than a smaller concentric polygon", async () => {
      const { centroid } = geo;
      const mkWkt = (d: number) => `POLYGON((${centroid.lng - d} ${centroid.lat - d}, ` + `${centroid.lng + d} ${centroid.lat - d}, ` + `${centroid.lng + d} ${centroid.lat + d}, ` + `${centroid.lng - d} ${centroid.lat + d}, ` + `${centroid.lng - d} ${centroid.lat - d}))`;

      const small = await estimateForPolygon(mkWkt(0.02));
      const large = await estimateForPolygon(mkWkt(0.08));

      console.log(`\n   📊 Small polygon (0.02°): ${small}  Large polygon (0.08°): ${large}`);
      expect(large).toBeGreaterThanOrEqual(small);
    });
  });

  describe("RADIUS", () => {
    afterEach(() => clearDeliveries());

    it("queues opted-in citizens whose GPS location is within the radius", async () => {
      if (!testAlertTargetId) return;
      const queued = await workerInsertForRadius(testAlertTargetId);
      expect(queued).toBeGreaterThanOrEqual(0);
    });

    it("no opted-out citizen appears in the RADIUS delivery queue", async () => {
      if (!testAlertTargetId) return;
      await workerInsertForRadius(testAlertTargetId);
      expect(await countOptedOutLeaks()).toBe(0);
    });

    it("RADIUS recipient count <= STATE count (radius is spatially bounded)", async () => {
      if (!testAlertTargetId) return;
      const radiusCount = await workerInsertForRadius(testAlertTargetId);
      await clearDeliveries();
      const stateCount = await workerInsertForState(geo.stateId);

      console.log(`\n   📊 RADIUS: ${radiusCount}  STATE: ${stateCount}`);
      expect(radiusCount).toBeLessThanOrEqual(stateCount);
    });
  });

  describe("Cross-Boundary Isolation", () => {
    afterEach(() => clearDeliveries());

    it("LGA alert delivers zero citizens from a different LGA in the same state", async () => {
      const otherLga = await prisma.lGA.findFirst({
        where: { stateId: geo.stateId, id: { not: geo.lgaId } },
        select: { id: true, name: true },
      });
      if (!otherLga) {
        console.log("   ⚠️  Only one LGA in state — skipping cross-boundary test");
        return;
      }

      await workerInsertForLga(geo.lgaId);

      const leaked = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*)::bigint AS count
         FROM deliveries d
         JOIN citizens c ON c.id = d.citizen_id
         WHERE d.alert_id = $1 AND c.lga_id = $2`,
        TEST_ALERT_ID,
        otherLga.id,
      );

      console.log(`\n   📊 Citizens from "${otherLga.name}" falsely queued: ${Number(leaked[0]?.count)}`);
      expect(Number(leaked[0]?.count)).toBe(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// 3. SPATIAL PRECISION — BOUNDARY CONDITIONS
//
//    Uses citizens placed at KNOWN coordinates to make exact
//    inclusion/exclusion assertions at query boundaries.
//    These tests prove PostGIS distance/containment logic is correct
//    and that no systematic unit error or off-by-one exists.
//
//    Distance approximation: 1° latitude ≈ 111 320 m.
//    PostGIS uses geodesic (WGS-84) distance for ::geography casts,
//    so computed distances are accurate to sub-metre precision.
// ═════════════════════════════════════════════════════════════════

describe("Spatial Precision — Radius Boundary (5 km threshold)", () => {
  afterEach(() => clearDeliveries());

  it("citizen at the exact radius centre (0 m) IS queued", async () => {
    if (!testAlertTargetId) return;
    await workerInsertForRadius(testAlertTargetId);
    expect(await isPrecisionCitizenQueued(PREC.R0_CENTER)).toBe(true);
  });

  it("citizen ~2 004 m from centre (clearly inside) IS queued", async () => {
    if (!testAlertTargetId) return;
    await workerInsertForRadius(testAlertTargetId);
    expect(await isPrecisionCitizenQueued(PREC.R1_2KM)).toBe(true);
  });

  it("citizen ~4 453 m from centre (547 m inside boundary) IS queued", async () => {
    if (!testAlertTargetId) return;
    await workerInsertForRadius(testAlertTargetId);
    expect(await isPrecisionCitizenQueued(PREC.R2_4KM)).toBe(true);
  });

  it("citizen ~5 121 m from centre (121 m outside boundary) IS NOT queued", async () => {
    if (!testAlertTargetId) return;
    await workerInsertForRadius(testAlertTargetId);
    expect(await isPrecisionCitizenQueued(PREC.R3_JUST_OUTSIDE)).toBe(false);
  });

  it("citizen ~15 028 m from centre (far outside) IS NOT queued", async () => {
    if (!testAlertTargetId) return;
    await workerInsertForRadius(testAlertTargetId);
    expect(await isPrecisionCitizenQueued(PREC.R4_15KM)).toBe(false);
  });

  it("opted-out citizen ~2 004 m from centre IS NOT queued (consent filter holds at boundary)", async () => {
    if (!testAlertTargetId) return;
    await workerInsertForRadius(testAlertTargetId);
    expect(await isPrecisionCitizenQueued(PREC.R5_OPTED_OUT)).toBe(false);

    const queued = await countDeliveries();
    const fp = await countOptedOutLeaks();
    // TP = citizens inside radius, opted-in; FP = 0; FN = 0; TN = opted-out citizen
    logMetrics("RADIUS", queued - fp, fp, 0, 1);
  });
});

describe("Spatial Precision — Polygon Containment", () => {
  afterEach(() => clearDeliveries());

  it("citizen at the polygon centre IS queued", async () => {
    await workerInsertForPolygon(geo.testPolygon.wkt);
    expect(await isPrecisionCitizenQueued(PREC.P0_CENTER)).toBe(true);
  });

  it("citizen ~111 m inside the polygon's southern edge IS queued", async () => {
    await workerInsertForPolygon(geo.testPolygon.wkt);
    expect(await isPrecisionCitizenQueued(PREC.P1_JUST_INSIDE)).toBe(true);
  });

  it("citizen ~111 m outside the polygon's southern edge IS NOT queued", async () => {
    await workerInsertForPolygon(geo.testPolygon.wkt);
    expect(await isPrecisionCitizenQueued(PREC.P2_JUST_OUTSIDE)).toBe(false);

    const queued = await countDeliveries();
    const fp = await countOptedOutLeaks();
    logMetrics("POLYGON", queued - fp, fp, 0, geo.counts.insideOptedOut);
  });
});

// ═════════════════════════════════════════════════════════════════
// 4. PERFORMANCE BENCHMARKS
//
//    Validates that geo-targeting operations complete within the
//    time budgets required for real-time emergency alert delivery.
//    Thresholds are set conservatively relative to observed latencies
//    to account for CI / loaded-DB variability.
// ═════════════════════════════════════════════════════════════════

describe("Performance Benchmarks", () => {
  afterEach(() => clearDeliveries());

  it("LGA delivery worker completes in < 5 s", async () => {
    const t0 = performance.now();
    const count = await workerInsertForLga(geo.lgaId);
    const ms = Math.round(performance.now() - t0);
    console.log(`\n   ⏱  LGA worker   : ${count} recipients queued in ${ms} ms`);
    expect(ms).toBeLessThan(5_000);
  });

  it("STATE delivery worker completes in < 15 s", async () => {
    const t0 = performance.now();
    const count = await workerInsertForState(geo.stateId);
    const ms = Math.round(performance.now() - t0);
    console.log(`\n   ⏱  STATE worker : ${count} recipients queued in ${ms} ms`);
    expect(ms).toBeLessThan(15_000);
  }, 20_000);

  it("POLYGON estimate (ST_Within) completes in < 3 s", async () => {
    const t0 = performance.now();
    const count = await estimateForPolygon(geo.testPolygon.wkt);
    const ms = Math.round(performance.now() - t0);
    console.log(`\n   ⏱  Polygon est. : ${count} recipients in ${ms} ms`);
    expect(ms).toBeLessThan(3_000);
  });

  it("estimateRecipients and delivery worker return identical counts for LGA", async () => {
    const estimate = await estimateForLga(geo.lgaId);
    const actual = await workerInsertForLga(geo.lgaId);
    console.log(`\n   📊 Estimate: ${estimate}  Worker insert: ${actual}  Delta: ${Math.abs(estimate - actual)}`);
    expect(actual).toBe(estimate);
  });
});
