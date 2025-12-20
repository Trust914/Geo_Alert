import { createId } from "@paralleldrive/cuid2";
import { createReadStream } from "fs";
import * as path from "path";
import parser from "stream-json";
import pick from "stream-json/filters/Pick";
import StreamArray from "stream-json/streamers/StreamArray.js";

import { PopulationService } from "../../src/helpers/population.seed.helper.js"; 
import type { ProcessedBatchItem } from "../../src/types/seed.types.js";
import { makeKey } from "../../src/utils/seed.utils.js";
import { prisma } from "../lib/prisma.js";
import { JurisdictionLevel } from "../types/enums.js";
import { logger } from "../utils/logger.util.js";
import { extractNames, isValidGeoJSON } from "../helpers/app.seed.helper.js";
import { SEED_BATCH_SIZE, SEED_LGA_FILE_PATH, SEED_STATE_FILE_PATH, SEED_WARD_FILE_PATH } from "../config/server.config.js";


// --- Cache object---
const lookupCache = {
  stateMap: null as Map<string, string> | null,
  lgaMap: null as Map<string, string> | null,
  lastCacheTime: 0,
  cacheTTL: 60000, // 1 minute
};

async function getStateLookupMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (lookupCache.stateMap && now - lookupCache.lastCacheTime < lookupCache.cacheTTL) {
    return lookupCache.stateMap;
  }
  const states = await prisma.state.findMany({
    select: { name: true, id: true },
  });
  const map = new Map<string, string>();
  for (const state of states) {
    map.set(makeKey(state.name), state.id);
  }
  lookupCache.stateMap = map;
  lookupCache.lastCacheTime = now;
  return map;
}


async function insertStatesBatch(items: ProcessedBatchItem[]) {
  PopulationService.initialize();

  const validItems = items.filter(item => {
    if (item.geometry === "NULL" || !isValidGeoJSON(item.geometry)) {
      logger.warn(`Skipping state "${item.name}" - invalid geometry`);
      return false;
    }
    return true;
  });

  if (validItems.length === 0) return;

  const operations = validItems.map((item) => {
    const geometryData = item.geometry;
    const population = PopulationService.getStatePopulation(item.name);

    return prisma.$executeRaw`
      INSERT INTO "states" (id, name, state_code, population, boundary, centroid, area_km2, created_at, updated_at)
      VALUES (${item.id}, ${item.name}, ${item.codeOrParentId}, ${population},
        ST_SetSRID(ST_GeomFromGeoJSON(${geometryData}), 4326),
        ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON(${geometryData}), 4326)),
        ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(${geometryData}), 4326)::geography) / 1000000,
        NOW(), NOW()
      )
      ON CONFLICT (name) DO UPDATE
      SET state_code = EXCLUDED.state_code,
          population = EXCLUDED.population,
          boundary = EXCLUDED.boundary,
          centroid = EXCLUDED.centroid,
          area_km2 = EXCLUDED.area_km2,
          updated_at = NOW();
    `;
  });

  await Promise.all(operations);
}

async function insertLgasBatch(items: ProcessedBatchItem[]) {
  PopulationService.initialize();

  const validItems = items.filter(item => {
    if (item.geometry === "NULL" || !isValidGeoJSON(item.geometry)) {
      logger.warn(`Skipping LGA "${item.name}" - invalid geometry`);
      return false;
    }
    return true;
  });

  if (validItems.length === 0) return;

  const operations = validItems.map((item) => {
    const geometryData = item.geometry;
    const { stateName } = extractNames(item.properties, JurisdictionLevel.LGA);
    const population = PopulationService.getLgaPopulation(stateName, item.name);

    return prisma.$executeRaw`
      INSERT INTO "lgas" (id, name, state_id, population, boundary, centroid, area_km2, created_at, updated_at)
      VALUES (${item.id}, ${item.name}, ${item.codeOrParentId}, ${population},
        ST_SetSRID(ST_GeomFromGeoJSON(${geometryData}), 4326),
        ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON(${geometryData}), 4326)),
        ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(${geometryData}), 4326)::geography) / 1000000,
        NOW(), NOW()
      )
      ON CONFLICT (name, state_id) DO UPDATE
      SET population = EXCLUDED.population,
          boundary = EXCLUDED.boundary,
          centroid = EXCLUDED.centroid,
          area_km2 = EXCLUDED.area_km2,
          updated_at = NOW();
    `;
  });

  await Promise.all(operations);
}

async function insertWardsBatch(items: ProcessedBatchItem[]) {
  PopulationService.initialize();

  const validItems = items.filter(item => {
    if (item.geometry === "NULL" || !isValidGeoJSON(item.geometry)) {
      logger.warn(`Skipping ward "${item.name}" - invalid geometry`);
      return false;
    }
    return true;
  });

  if (validItems.length === 0) return;

  const operations = validItems.map((item) => {
    const geometryData = item.geometry;
    const { stateName, lgaName } = extractNames(item.properties, JurisdictionLevel.WARD);
    const population = PopulationService.getWardPopulation(stateName, lgaName, item.name);

    return prisma.$executeRaw`
      INSERT INTO "wards" (id, name, lga_id, population, boundary, centroid, created_at, updated_at)
      VALUES (${item.id}, ${item.name}, ${item.codeOrParentId}, ${population},
        ST_SetSRID(ST_GeomFromGeoJSON(${geometryData}), 4326),
        ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON(${geometryData}), 4326)),
        NOW(), NOW()
      )
      ON CONFLICT (name, lga_id) DO UPDATE
      SET population = EXCLUDED.population,
          boundary = EXCLUDED.boundary,
          centroid = EXCLUDED.centroid,
          updated_at = NOW();
    `;
  });

  await Promise.all(operations);
}


async function processStream(
  filePath: string,
  level: JurisdictionLevel,
  parentMap?: Map<string, string>
) {
  return new Promise<void>((resolve, reject) => {
    let batch: ProcessedBatchItem[] = [];
    let count = 0;

    const pipeline = createReadStream(filePath)
      .pipe(parser())
      .pipe(new pick({ filter: "features" }))
      .pipe(new StreamArray());

    pipeline.on("data", async (data: any) => {
      const feature = data.value;
      const props = feature.properties;
      const { name, stateName, lgaName } = extractNames(props, level);

      if (!name) return;

      let codeOrParentId = "";

      if (level === JurisdictionLevel.STATE) {
        codeOrParentId = props.state_code || props.code || createId();
      } else if (level === JurisdictionLevel.LGA && parentMap) {
        if (stateName && parentMap.has(makeKey(stateName))) {
          codeOrParentId = parentMap.get(makeKey(stateName))!;
        } else {
          return;
        }
      } else if (level === JurisdictionLevel.WARD && parentMap) {
        const key = makeKey(stateName, lgaName);
        if (stateName && lgaName && parentMap.has(key)) {
          codeOrParentId = parentMap.get(key)!;
        } else {
          return;
        }
      }

      const id = createId();
      const geometry = JSON.stringify(feature.geometry);

      batch.push({
        id,
        name,
        codeOrParentId,
        geometry,
        properties: props,
      });

      if (batch.length >= SEED_BATCH_SIZE) {
        pipeline.pause();
        try {
          if (level === JurisdictionLevel.STATE) await insertStatesBatch(batch);
          if (level === JurisdictionLevel.LGA) await insertLgasBatch(batch);
          if (level === JurisdictionLevel.WARD) await insertWardsBatch(batch);

          count += batch.length;
          process.stdout.write(`\rProcessed ${count} ${level}s...`);
          batch = [];
          pipeline.resume();
        } catch (err) {
          pipeline.destroy(err as Error);
        }
      }
    });

    pipeline.on("end", async () => {
      if (batch.length > 0) {
        if (level === JurisdictionLevel.STATE) await insertStatesBatch(batch);
        if (level === JurisdictionLevel.LGA) await insertLgasBatch(batch);
        if (level === JurisdictionLevel.WARD) await insertWardsBatch(batch);
        count += batch.length;
      }
      logger.info(`\nFinished processing ${count} ${level}s.`);
      resolve();
    });

    pipeline.on("error", (err: Error) => reject(err));
  });
}


async function main() {
  const seedType = process.argv[2] || "all";
  logger.info(`Starting seed process for: ${seedType}`);

  const files = {
    states: path.resolve(process.cwd(), SEED_STATE_FILE_PATH),
    lgas: path.resolve(process.cwd(), SEED_LGA_FILE_PATH),
    wards: path.resolve(process.cwd(), SEED_WARD_FILE_PATH),
  };

  try {
    if (seedType === "all" || seedType === "state") {
      await processStream(files.states, JurisdictionLevel.STATE);
    }

    if (seedType === "all" || seedType === "lga") {
      const stateMap = await getStateLookupMap();
      await processStream(files.lgas, JurisdictionLevel.LGA, stateMap);
    }

    if (seedType === "all" || seedType === "ward") {
      const lgas = await prisma.lGA.findMany({
        select: { id: true, name: true, state: { select: { name: true } } },
      });

      const lgaMap = new Map<string, string>();
      for (const lga of lgas) {
        lgaMap.set(makeKey(lga.state.name, lga.name), lga.id);
      }

      await processStream(files.wards, JurisdictionLevel.WARD, lgaMap);
    }
  } catch (error) {
    logger.error("Seeding failed:", { error });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();