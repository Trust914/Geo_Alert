import { createId } from "@paralleldrive/cuid2";
// import { PrismaClient } from "@prisma/client";
import { createReadStream } from "fs";
import parser from "stream-json";
import pick from "stream-json/filters/Pick";
import StreamArray from "stream-json/streamers/StreamArray.js";
import type {
  GeoFeature,
  ProcessedBatchItem,
} from "../../src/types/seed.types.js";
import {
  escapeSqlString,
  getStateCode,
  makeKey,
} from "../../src/utils/seed.utils.js";
import { prisma } from "../lib/prisma.js";
import { JurisdictionLevel } from "../types/enums.js";

// const prisma = new PrismaClient();

async function getStateLookupMap(): Promise<Map<string, string>> {
  const states = await prisma.state.findMany({
    select: { name: true, id: true },
  });

  const map = new Map<string, string>();
  for (const state of states) {
    map.set(makeKey(state.name), state.id);
  }
  return map;
}

async function getLgaLookupMap(): Promise<Map<string, string>> {
  const lgas = await prisma.lGA.findMany({
    select: {
      id: true,
      name: true,
      state: { select: { name: true } },
    },
  });
  const map = new Map<string, string>();
  for (const lga of lgas) {
    const key = makeKey(lga.state.name, lga.name);
    map.set(key, lga.id);
  }
  return map;
}

// --- Database Operations ---

const getGeomSql = (geomJson: string, forceMulti: boolean) => {
  if (geomJson === "NULL") {
    return "NULL, NULL, NULL";
  }

  const safeJson = geomJson.replace(/'/g, "''");
  const geomFragment = `ST_SetSRID(ST_GeomFromGeoJSON('${safeJson}'), 4326)`;
  const boundaryFunc = forceMulti ? `ST_Multi(${geomFragment})` : geomFragment;

  return `
    ${boundaryFunc},
    ST_PointOnSurface(${geomFragment}),
    ST_Area(${geomFragment}::geography) / 1000000
  `;
};

async function executeSafeBatch(
  table: "states" | "lgas" | "wards",
  batch: ProcessedBatchItem[],
  sqlGenerator: (items: ProcessedBatchItem[]) => string
) {
  if (batch.length === 0) return;

  try {
    await prisma.$executeRawUnsafe(sqlGenerator(batch));
  } catch (batchError) {
    console.warn(
      `\n⚠️ Batch failed for ${table}. Retrying items one-by-one...`
    );
    for (const item of batch) {
      try {
        await prisma.$executeRawUnsafe(sqlGenerator([item]));
      } catch (singleError: any) {
        console.error(
          `❌ Failed to insert ${item.name}: ${
            singleError.message.split("\n")[0]
          }`
        );
      }
    }
  }
}

const generateStateSql = (items: ProcessedBatchItem[]) => {
  const values = items
    .map((item) => {
      const escapedName = escapeSqlString(item.name);
      return `('${item.id}', '${escapedName}', '${
        item.codeOrParentId
      }', ${getGeomSql(item.geometry, false)}, NOW(), NOW())`;
    })
    .join(",");

  return `
    INSERT INTO "states" (id, name, state_code, boundary, centroid, area_km2, created_at, updated_at)
    VALUES ${values}
    ON CONFLICT (state_code) DO UPDATE
    SET name = EXCLUDED.name, boundary = EXCLUDED.boundary, centroid = EXCLUDED.centroid, area_km2 = EXCLUDED.area_km2, updated_at = NOW()
  `;
};

const generateLgaSql = (items: ProcessedBatchItem[]) => {
  const values = items
    .map((item) => {
      const escapedName = escapeSqlString(item.name);
      return `('${item.id}', '${escapedName}', '${
        item.codeOrParentId
      }', ${getGeomSql(item.geometry, false)}, NOW(), NOW())`;
    })
    .join(",");

  return `
    INSERT INTO "lgas" (id, name, state_id, boundary, centroid, area_km2, created_at, updated_at)
    VALUES ${values}
    ON CONFLICT (state_id, name) DO UPDATE
    SET boundary = EXCLUDED.boundary, centroid = EXCLUDED.centroid, area_km2 = EXCLUDED.area_km2, updated_at = NOW()
  `;
};

const generateWardSql = (items: ProcessedBatchItem[]) => {
  const values = items
    .map((item) => {
      const escapedName = escapeSqlString(item.name);
      return `('${item.id}', '${escapedName}', '${
        item.codeOrParentId
      }', ${getGeomSql(item.geometry, true)}, NOW(), NOW())`;
    })
    .join(",");

  return `
    INSERT INTO "wards" (id, name, lga_id, boundary, centroid, area_km2, created_at, updated_at)
    VALUES ${values}
    ON CONFLICT (lga_id, name) DO UPDATE
    SET boundary = EXCLUDED.boundary, centroid = EXCLUDED.centroid, area_km2 = EXCLUDED.area_km2, updated_at = NOW()
  `;
};

// --- Stream Processing ---

async function* batchGenerator(source: AsyncIterable<any>, batchSize: number) {
  let batch: any[] = [];
  for await (const chunk of source) {
    batch.push(chunk);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) yield batch;
}

async function processGeoFile(
  filePath: string,
  level: JurisdictionLevel,
  batchSize: number
) {
  console.log(`\n🚀 Processing ${level}s from ${filePath}...`);
  const startTime = Date.now();
  let count = 0;

  // 1. Context Setup
  let stateMap: Map<string, string> | null = null;
  let lgaMap: Map<string, string> | null = null;

  if (level === JurisdictionLevel.LGA) {
    console.log("   Loading state map for fast lookup...");
    stateMap = await getStateLookupMap();
  } else if (level === JurisdictionLevel.WARD) {
    console.log("   Loading LGA map (composite keys)...");
    lgaMap = await getLgaLookupMap();
  }

  // 2. Stream Setup
  const fileStream = createReadStream(filePath);
  const jsonStream = fileStream
    .pipe(parser())
    .pipe(new pick({ filter: "features" }))
    .pipe(new StreamArray());

  // 3. Batch Processing Loop
  for await (const rawBatch of batchGenerator(jsonStream, batchSize)) {
    const processedBatch: ProcessedBatchItem[] = [];

    for (const item of rawBatch) {
      const feature = item.value as GeoFeature;
      const props = feature.properties;

      let geometry = "NULL"; // Default to SQL NULL string

      if (
        feature.geometry &&
        feature.geometry.coordinates &&
        feature.geometry.coordinates.length > 0
      ) {
        geometry = JSON.stringify(feature.geometry);
      } else {
        // Log warnings for missing geometry
        console.warn(
          `Item ${props.wardname || props.admin2Name} has no geometry.`
        );
      }

      try {
        const id = createId();

        if (level === JurisdictionLevel.STATE) {
          const name = props.admin1Name;
          if (!name) continue;
          try {
            const code = getStateCode(name);
            processedBatch.push({ id, name, codeOrParentId: code, geometry });
          } catch (e) {
            console.warn(`Skipping State ${name}: Code not found`);
          }
        } else if (level === JurisdictionLevel.LGA) {
          const name = props.admin2Name;
          const parentName = props.admin1Name;
          if (!name || !parentName) continue;

          const stateId = stateMap?.get(makeKey(parentName));
          if (!stateId) {
            console.warn(`State not found: ${parentName}`);
            continue;
          }
          processedBatch.push({ id, name, codeOrParentId: stateId, geometry });
        } else if (level === JurisdictionLevel.WARD) {
          const name = props.wardname;
          const lgaName = props.lganame;
          const stateName = props.statename;

          if (!name || !lgaName || !stateName) continue;

          const lgaId = lgaMap?.get(makeKey(stateName, lgaName));

          if (!lgaId) {
            console.warn(`LGA not found: ${lgaName} (${stateName})`);
            continue;
          }

          processedBatch.push({ id, name, codeOrParentId: lgaId, geometry });
        }
      } catch (err: any) {
        console.error(`Error processing index ${item.key}: ${err.message}`);
      }
    }

    // 4. Bulk Insert
    if (processedBatch.length > 0) {
      if (level === JurisdictionLevel.STATE) {
        await executeSafeBatch("states", processedBatch, generateStateSql);
      } else if (level === JurisdictionLevel.LGA) {
        await executeSafeBatch("lgas", processedBatch, generateLgaSql);
      } else if (level === JurisdictionLevel.WARD) {
        await executeSafeBatch("wards", processedBatch, generateWardSql);
      }

      count += processedBatch.length;
      process.stdout.write(`\r   Processed ${count} records...`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Finished ${level}s. Total: ${count}. Time: ${duration}s`);
}

// --- Main CLI ---

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const files = args.slice(1);

  try {
    if (command === "state") {
      const file = files[0];
      if (!file) throw new Error("Missing file path for state");
      await processGeoFile(file, JurisdictionLevel.STATE, 50);
    } else if (command === "lga") {
      const file = files[0];
      if (!file) throw new Error("Missing file path for lga");
      await processGeoFile(file, JurisdictionLevel.LGA, 100);
    } else if (command === "ward") {
      const file = files[0];
      if (!file) throw new Error("Missing file path for ward");
      await processGeoFile(file, JurisdictionLevel.WARD, 100);
    } else if (command === "all") {
      const [stateFile, lgaFile, wardFile] = files;
      if (!stateFile || !lgaFile || !wardFile) {
        throw new Error("Usage: ... all <state-file> <lga-file> <ward-file>");
      }
      await processGeoFile(stateFile, JurisdictionLevel.STATE, 50);
      await processGeoFile(lgaFile, JurisdictionLevel.LGA, 100);
      await processGeoFile(wardFile, JurisdictionLevel.WARD, 100);
    } else {
      console.log(`Usage: npx tsx seed-geo.ts <command> <files...>`);
    }
  } catch (err) {
    console.error("\n❌ Fatal Error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
