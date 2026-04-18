/**
 * GeoAlert — Test Citizen Seeder
 * ─────────────────────────────────────────────────────────────────
 * Seeds deterministic citizens whose locations are known exactly so
 * the geo-targeting tests can make hard assertions like:
 *   "exactly 500 citizens are inside this polygon"
 *
 * Strategy
 * ────────
 * We pick ONE real LGA from your DB, read its boundary from PostGIS,
 * then seed citizens in three groups:
 *
 *   GROUP A — INSIDE the LGA bbox, is_opted_in = true   ← FK & spatial targeting
 *   GROUP B — INSIDE the LGA bbox, is_opted_in = false  ← must be excluded (opted-out filter)
 *   GROUP C — OUTSIDE the LGA bbox, is_opted_in = true  ← excluded only by spatial queries;
 *                                                           included by FK queries (same lga_id)
 *                                                           — this is intentional by design
 *
 * All citizens use phone numbers starting with +234TEST so they are
 * trivially identifiable and can be cleaned up precisely.
 *
 * Spatial Precision citizens (+234PREC prefix) are managed by the
 * test file itself and are NOT seeded here.
 */

import { createId } from "@paralleldrive/cuid2";
import { prisma } from "../lib/prisma";


// ── CONFIG ────────────────────────────────────────────────────────
export const SEED_CONFIG = {
  PHONE_PREFIX: "+234TEST",          // unique prefix — easy to delete
  GROUP_A_COUNT: 500,                // inside LGA bbox, opted-in   ← targeted
  GROUP_B_COUNT: 100,                // inside LGA bbox, opted-out  ← excluded
  GROUP_C_COUNT: 200,                // outside LGA bbox, opted-in  ← excluded by spatial only
  RADIUS_CENTER_OFFSET_DEG: 0.05,   // how far the radius center is from LGA centroid
  RADIUS_METERS: 5000,              // 5 km radius for radius tests
  TARGET_LGA_NAME: null as string | null, // set to e.g. "Ikeja" to force a specific LGA
} as const;

// ── TYPES ─────────────────────────────────────────────────────────
export interface SeedResult {
  lgaId: string;
  lgaName: string;
  stateId: string;
  stateName: string;
  wardId: string | null;
  wardName: string | null;
  centroid: { lat: number; lng: number };
  counts: {
    insideOptedIn: number;   // GROUP A — should always be queued (FK & spatial)
    insideOptedOut: number;  // GROUP B — must never be queued (opted-out filter)
    outsideOptedIn: number;  // GROUP C — excluded by spatial queries only
  };
  radiusCenter: { lat: number; lng: number };
  radiusMeters: number;
  // Polygon covering the inner 50% of the LGA bbox — used in polygon tests
  testPolygon: {
    wkt: string;
    citizensInside: number;       // how many GROUP A citizens fall inside it
    bounds: {                     // polygon bounding coordinates
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };
  };
}

// ── HELPERS ───────────────────────────────────────────────────────

function makePhone(index: number): string {
  return `${SEED_CONFIG.PHONE_PREFIX}${String(index).padStart(6, "0")}`;
}

/** Generate N random points inside a bounding box */
function randomPointsInBbox(
  minLat: number, maxLat: number,
  minLng: number, maxLng: number,
  count: number,
): Array<{ lat: number; lng: number }> {
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({
      lat: minLat + Math.random() * (maxLat - minLat),
      lng: minLng + Math.random() * (maxLng - minLng),
    });
  }
  return points;
}

/** Generate N random points OUTSIDE a bbox but still inside Nigeria */
function randomPointsOutsideBbox(
  minLat: number, maxLat: number,
  minLng: number, maxLng: number,
  count: number,
): Array<{ lat: number; lng: number }> {
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  const points = [];
  for (let i = 0; i < count; i++) {
    const direction = i % 4;
    let lat: number, lng: number;
    switch (direction) {
      case 0: // north of bbox
        lat = Math.min(13.9, maxLat + latSpan * (0.5 + Math.random()));
        lng = minLng + Math.random() * lngSpan;
        break;
      case 1: // south of bbox
        lat = Math.max(4.2, minLat - latSpan * (0.5 + Math.random()));
        lng = minLng + Math.random() * lngSpan;
        break;
      case 2: // east of bbox
        lat = minLat + Math.random() * latSpan;
        lng = Math.min(14.7, maxLng + lngSpan * (0.5 + Math.random()));
        break;
      default: // west of bbox
        lat = minLat + Math.random() * latSpan;
        lng = Math.max(2.7, minLng - lngSpan * (0.5 + Math.random()));
        break;
    }
    points.push({ lat, lng });
  }
  return points;
}

// ── INSERT BATCH ─────────────────────────────────────────────────

async function insertCitizens(
  citizens: Array<{
    phone: string;
    lat: number;
    lng: number;
    isOptedIn: boolean;
    stateId: string;
    lgaId: string;
    wardId: string | null;
  }>,
): Promise<number> {
  let inserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < citizens.length; i += CHUNK) {
    const chunk = citizens.slice(i, i + CHUNK);
    await prisma.$transaction(async (tx) => {
      for (const c of chunk) {
        try {
          await tx.$executeRawUnsafe(
            `INSERT INTO citizens (
              id, phone_number, first_name, last_name,
              state_id, lga_id, ward_id,
              location,
              is_opted_in, preferred_language,
              registered_at, updated_at
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7,
              ST_SetSRID(ST_MakePoint($8, $9), 4326),
              $10, $11,
              NOW(), NOW()
            )
            ON CONFLICT (phone_number) DO NOTHING`,
            createId(),
            c.phone,
            "TestUser",
            "GeoSeed",
            c.stateId,
            c.lgaId,
            c.wardId,
            c.lng, // ST_MakePoint(lng, lat)
            c.lat,
            c.isOptedIn,
            "ENGLISH",
          );
          inserted++;
        } catch {
          // skip duplicate phone collisions silently
        }
      }
    });
  }
  return inserted;
}

// ── MAIN SEED FUNCTION ────────────────────────────────────────────

export async function seedGeoTestCitizens(): Promise<SeedResult> {
  console.log("\n🌱 GeoAlert — Seeding geo-test citizens...");

  // ── Step 1: pick an LGA with a real boundary ───────────────────
  const lgaQuery = SEED_CONFIG.TARGET_LGA_NAME
    ? `AND l.name = '${SEED_CONFIG.TARGET_LGA_NAME}'`
    : "";

  const lgas = await prisma.$queryRawUnsafe<
    Array<{
      lga_id: string;
      lga_name: string;
      state_id: string;
      state_name: string;
      min_lat: number;
      max_lat: number;
      min_lng: number;
      max_lng: number;
      centroid_lat: number;
      centroid_lng: number;
    }>
  >(`
    SELECT
      l.id           AS lga_id,
      l.name         AS lga_name,
      s.id           AS state_id,
      s.name         AS state_name,
      ST_YMin(l.boundary::geometry) AS min_lat,
      ST_YMax(l.boundary::geometry) AS max_lat,
      ST_XMin(l.boundary::geometry) AS min_lng,
      ST_XMax(l.boundary::geometry) AS max_lng,
      ST_Y(l.centroid::geometry)    AS centroid_lat,
      ST_X(l.centroid::geometry)    AS centroid_lng
    FROM lgas l
    JOIN states s ON s.id = l.state_id
    WHERE l.boundary IS NOT NULL AND l.centroid IS NOT NULL
    ${lgaQuery}
    ORDER BY l.name
    LIMIT 1
  `);

  if (lgas.length === 0) {
    throw new Error("No LGAs with boundaries found. Run: npm run seed.geo first.");
  }

  const lga = lgas[0]!;
  console.log(`   📍 LGA: ${lga.lga_name} (${lga.state_name})`);
  console.log(`   📦 Bbox: lat [${lga.min_lat.toFixed(4)}, ${lga.max_lat.toFixed(4)}] lng [${lga.min_lng.toFixed(4)}, ${lga.max_lng.toFixed(4)}]`);

  // ── Step 2: pick first ward in this LGA ───────────────────────
  const ward = await prisma.ward.findFirst({
    where: { lgaId: lga.lga_id },
    select: { id: true, name: true },
  });

  // ── Step 3: generate coordinates ──────────────────────────────
  const insidePoints = randomPointsInBbox(
    lga.min_lat, lga.max_lat,
    lga.min_lng, lga.max_lng,
    SEED_CONFIG.GROUP_A_COUNT + SEED_CONFIG.GROUP_B_COUNT,
  );

  const outsidePoints = randomPointsOutsideBbox(
    lga.min_lat, lga.max_lat,
    lga.min_lng, lga.max_lng,
    SEED_CONFIG.GROUP_C_COUNT,
  );

  // ── Step 4: build citizen rows ─────────────────────────────────
  let phoneIdx = 0;

  const groupA = insidePoints.slice(0, SEED_CONFIG.GROUP_A_COUNT).map((p) => ({
    phone: makePhone(phoneIdx++),
    lat: p.lat,
    lng: p.lng,
    isOptedIn: true,
    stateId: lga.state_id,
    lgaId: lga.lga_id,
    wardId: ward?.id ?? null,
  }));

  const groupB = insidePoints.slice(SEED_CONFIG.GROUP_A_COUNT).map((p) => ({
    phone: makePhone(phoneIdx++),
    lat: p.lat,
    lng: p.lng,
    isOptedIn: false,
    stateId: lga.state_id,
    lgaId: lga.lga_id,
    wardId: ward?.id ?? null,
  }));

  // NOTE: GROUP C shares lga_id/state_id FK with GROUP A intentionally.
  // Their LOCATION coordinates are outside the LGA bbox.
  // FK-based queries (LGA/STATE/WARD targeting) will INCLUDE them.
  // Spatial queries (POLYGON/RADIUS) will EXCLUDE them based on location.
  // This models the real-world scenario of a citizen registered in an LGA
  // but currently located outside it.
  const groupC = outsidePoints.map((p) => ({
    phone: makePhone(phoneIdx++),
    lat: p.lat,
    lng: p.lng,
    isOptedIn: true,
    stateId: lga.state_id,
    lgaId: lga.lga_id,
    wardId: null,
  }));

  // ── Step 5: insert ─────────────────────────────────────────────
  const countA = await insertCitizens(groupA);
  const countB = await insertCitizens(groupB);
  const countC = await insertCitizens(groupC);

  console.log(`   ✅ Inserted GROUP A (inside bbox, opted-in)   : ${countA}`);
  console.log(`   ✅ Inserted GROUP B (inside bbox, opted-out)  : ${countB}`);
  console.log(`   ✅ Inserted GROUP C (outside bbox, opted-in)  : ${countC}`);

  // ── Step 6: build test polygon (inner 50% of bbox) ────────────
  const midLat = (lga.min_lat + lga.max_lat) / 2;
  const midLng = (lga.min_lng + lga.max_lng) / 2;
  const latQ   = (lga.max_lat - lga.min_lat) / 4; // quarter of bbox height
  const lngQ   = (lga.max_lng - lga.min_lng) / 4; // quarter of bbox width

  const polyMinLat = midLat - latQ;
  const polyMaxLat = midLat + latQ;
  const polyMinLng = midLng - lngQ;
  const polyMaxLng = midLng + lngQ;

  const testPolygonWKT =
    `POLYGON((${polyMinLng} ${polyMinLat}, ${polyMaxLng} ${polyMinLat}, ` +
    `${polyMaxLng} ${polyMaxLat}, ${polyMinLng} ${polyMaxLat}, ` +
    `${polyMinLng} ${polyMinLat}))`;

  // Count how many GROUP A citizens actually fall inside the polygon
  const polyCountResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `
    SELECT COUNT(*)::bigint AS count
    FROM citizens
    WHERE phone_number LIKE $1
      AND is_opted_in = true
      AND ST_Within(location, ST_GeomFromText($2, 4326))
  `,
    `${SEED_CONFIG.PHONE_PREFIX}%`,
    testPolygonWKT,
  );

  const citizensInsidePoly = Number(polyCountResult[0]?.count ?? 0);

  // ── Step 7: radius center ─────────────────────────────────────
  const radiusCenter = {
    lat: lga.centroid_lat + SEED_CONFIG.RADIUS_CENTER_OFFSET_DEG,
    lng: lga.centroid_lng + SEED_CONFIG.RADIUS_CENTER_OFFSET_DEG,
  };

  const result: SeedResult = {
    lgaId:     lga.lga_id,
    lgaName:   lga.lga_name,
    stateId:   lga.state_id,
    stateName: lga.state_name,
    wardId:    ward?.id ?? null,
    wardName:  ward?.name ?? null,
    centroid:  { lat: lga.centroid_lat, lng: lga.centroid_lng },
    counts: {
      insideOptedIn:  countA,
      insideOptedOut: countB,
      outsideOptedIn: countC,
    },
    radiusCenter,
    radiusMeters: SEED_CONFIG.RADIUS_METERS,
    testPolygon: {
      wkt:            testPolygonWKT,
      citizensInside: citizensInsidePoly,
      bounds: {
        minLat: polyMinLat,
        maxLat: polyMaxLat,
        minLng: polyMinLng,
        maxLng: polyMaxLng,
      },
    },
  };

  console.log(`\n   📊 Test polygon citizens (inside inner 50%): ${citizensInsidePoly}`);
  console.log(`   📊 Radius center: ${radiusCenter.lat.toFixed(4)}, ${radiusCenter.lng.toFixed(4)}`);
  console.log("\n✅ Seeding complete.\n");

  return result;
}

// ── CLEANUP ───────────────────────────────────────────────────────

export async function cleanupGeoTestCitizens(): Promise<number> {
  const result = await prisma.citizen.deleteMany({
    where: { phoneNumber: { startsWith: SEED_CONFIG.PHONE_PREFIX } },
  });
  return result.count;
}

// ── STANDALONE RUN ────────────────────────────────────────────────

if (process.argv[1]?.includes("seed_geo_test_citizens")) {
  seedGeoTestCitizens()
    .then((result) => {
      console.log("Seed result:", JSON.stringify(result, null, 2));
    })
    .catch((e) => {
      console.error("❌ Seeder failed:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}