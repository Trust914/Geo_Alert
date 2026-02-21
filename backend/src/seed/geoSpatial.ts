import { createId } from "@paralleldrive/cuid2";
import { createReadStream } from "fs";
import * as path from "path";
import parser from "stream-json";
import pick from "stream-json/filters/Pick";
import StreamArray from "stream-json/streamers/StreamArray.js";

import { PopulationService } from "../helpers/population.seed.helper.js";
import type { ProcessedBatchItem } from "../types/seed.types.js";
import { makeKey } from "../utils/seed.utils.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.util.js";
import {
  extractNames,
  validateAndCleanGeometry,
  logValidationWarning,
  type ValidationResult
} from "../helpers/app.seed.helper.js";

import { JurisdictionLevel } from "../prisma/prisma/generated/enums.js";
import { serverConfig } from "../config/server.config.js";

// --- Cache ---
const lookupCache = {
  stateMap: null as Map<string, string> | null,
  lgaMap: null as Map<string, string> | null,
  lastCacheTime: 0,
  cacheTTL: 60000,
};

// --- Statistics ---
const stats = {
  states: { total: 0, inserted: 0, warnings: 0, skipped: 0 },
  lgas: { total: 0, inserted: 0, warnings: 0, skipped: 0 },
  wards: { total: 0, inserted: 0, warnings: 0, skipped: 0 },
};

// --- Skipped Items Tracking ---
interface SkippedItem {
  name: string;
  reason: string;
  level: string;
  additionalInfo: Record<string, any> | undefined;
}

const skippedItems: SkippedItem[] = [];

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

/**
 * Processes validation result and logs warnings
 */
function processValidationResult(
  validation: ValidationResult,
  name: string,
  level: string
): void {
  if (!validation.isValid) {
    // Increment warning count
    if (level === JurisdictionLevel.STATE) {
      stats.states.warnings++;
    } else if (level === JurisdictionLevel.LGA) {
      stats.lgas.warnings++;
    } else {
      stats.wards.warnings++;
    }

    // Log the warning
    logValidationWarning(level, name, validation.warnings, {
      originalGeometryType: validation.geometryType,
      fixedWith: 'MultiPolygon (minimal square at [0,0])'
    });
  }
}

async function insertStatesBatch(items: ProcessedBatchItem[]) {
  PopulationService.initialize();

  if (items.length === 0) return;

  try {
    const operations = items.map((item) => {
      stats.states.total++;

      // Validate and clean geometry using helper
      const validation = validateAndCleanGeometry(item.geometry, item.name, JurisdictionLevel.STATE);
      processValidationResult(validation, item.name, JurisdictionLevel.STATE);

      const population = PopulationService.getStatePopulation(item.name);

      return prisma.$executeRaw`
        INSERT INTO "states" (id, name, state_code, population, boundary, centroid, area_km2, created_at, updated_at)
        VALUES (${item.id}, ${item.name}, ${item.codeOrParentId}, ${population},
          ST_SetSRID(ST_GeomFromGeoJSON(${validation.geometry}), 4326),
          ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON(${validation.geometry}), 4326)),
          ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(${validation.geometry}), 4326)::geography) / 1000000,
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
    stats.states.inserted += items.length;
  } catch (error) {
    logger.error(`Error inserting states batch:`, { error });
    throw error;
  }
}

async function insertLgasBatch(items: ProcessedBatchItem[]) {
  PopulationService.initialize();

  if (items.length === 0) return;

  try {
    const operations = items.map((item) => {
      stats.lgas.total++;

      // Validate and clean geometry using helper
      const validation = validateAndCleanGeometry(item.geometry, item.name, JurisdictionLevel.LGA);
      processValidationResult(validation, item.name, JurisdictionLevel.LGA);

      const { stateName } = extractNames(item.properties, JurisdictionLevel.LGA);
      const population = PopulationService.getLgaPopulation(stateName, item.name);

      return prisma.$executeRaw`
        INSERT INTO "lgas" (id, name, state_id, population, boundary, centroid, area_km2, created_at, updated_at)
        VALUES (${item.id}, ${item.name}, ${item.codeOrParentId}, ${population},
          ST_SetSRID(ST_GeomFromGeoJSON(${validation.geometry}), 4326),
          ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON(${validation.geometry}), 4326)),
          ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(${validation.geometry}), 4326)::geography) / 1000000,
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
    stats.lgas.inserted += items.length;
  } catch (error) {
    logger.error(`Error inserting LGAs batch:`, { error });
    throw error;
  }
}

async function insertWardsBatch(items: ProcessedBatchItem[]) {
  PopulationService.initialize();

  if (items.length === 0) return;

  try {
    const operations = items.map((item) => {
      stats.wards.total++;

      // Validate and clean geometry using helper
      const validation = validateAndCleanGeometry(item.geometry, item.name, JurisdictionLevel.WARD);
      processValidationResult(validation, item.name, JurisdictionLevel.WARD);

      const { stateName, lgaName } = extractNames(item.properties, JurisdictionLevel.WARD);
      const population = PopulationService.getWardPopulation(stateName, lgaName, item.name);

      return prisma.$executeRaw`
        INSERT INTO "wards" (id, name, lga_id, population, boundary, centroid, created_at, updated_at)
        VALUES (${item.id}, ${item.name}, ${item.codeOrParentId}, ${population},
          ST_SetSRID(ST_GeomFromGeoJSON(${validation.geometry}), 4326),
          ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON(${validation.geometry}), 4326)),
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
    stats.wards.inserted += items.length;
  } catch (error) {
    logger.error(`Error inserting wards batch:`, { error });
    throw error;
  }
}

/**
 * Logs a skipped item and tracks it for final report
 */
function logSkippedItem(
  level: string,
  name: string,
  reason: string,
  additionalInfo: Record<string, any> | undefined
): void {
  skippedItems.push({
    name,
    reason,
    level,
    additionalInfo
  });

  logger.warn(`⚠️  SKIPPED ${level} "${name}": ${reason}`, additionalInfo || {});
}

async function processStream(
  filePath: string,
  level: JurisdictionLevel,
  parentMap?: Map<string, string>
) {
  return new Promise<void>((resolve, reject) => {
    let batch: ProcessedBatchItem[] = [];
    let count = 0;
    let lastReportTime = Date.now();
    const REPORT_INTERVAL = 2000;

    const pipeline = createReadStream(filePath)
      .pipe(parser())
      .pipe(new pick({ filter: "features" }))
      .pipe(new StreamArray());

    pipeline.on("data", async (data: any) => {
      const feature = data.value;
      const props = feature.properties;
      const { name, stateName, lgaName } = extractNames(props, level);

      // Track items that would be skipped due to missing name
      if (!name) {
        if (level === JurisdictionLevel.STATE) {
          stats.states.skipped++;
        } else if (level === JurisdictionLevel.LGA) {
          stats.lgas.skipped++;
        } else {
          stats.wards.skipped++;
        }

        logSkippedItem(
          level,
          `<unnamed-${level.toLowerCase()}>`,
          "Missing name in properties",
          { properties: props }
        );
        return;
      }

      let codeOrParentId = "";
      let shouldProcess = true;

      if (level === JurisdictionLevel.STATE) {
        codeOrParentId = props.state_code || props.code || createId();
      } else if (level === JurisdictionLevel.LGA && parentMap) {
        if (stateName && parentMap.has(makeKey(stateName))) {
          codeOrParentId = parentMap.get(makeKey(stateName))!;
        } else {
          shouldProcess = false;
          stats.lgas.skipped++;
          logSkippedItem(
            level,
            name,
            "Parent state not found",
            {
              stateName: stateName || '<missing>',
              availableStates: Array.from(parentMap.keys()).slice(0, 5).join(', ') + '...'
            }
          );
        }
      } else if (level === JurisdictionLevel.WARD && parentMap) {
        const key = makeKey(stateName, lgaName);
        if (stateName && lgaName && parentMap.has(key)) {
          codeOrParentId = parentMap.get(key)!;
        } else {
          shouldProcess = false;
          stats.wards.skipped++;
          logSkippedItem(
            level,
            name,
            "Parent LGA not found",
            {
              stateName: stateName || '<missing>',
              lgaName: lgaName || '<missing>',
              lookupKey: key
            }
          );
        }
      }

      // Still add to database even if parent not found (with logging)
      // This preserves the data while tracking the issue
      if (!shouldProcess) {
        // We've already logged this as skipped, so we return here
        return;
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

      if (batch.length >= serverConfig.seeding.batchSize) {
        pipeline.pause();
        try {
          if (level === JurisdictionLevel.STATE) await insertStatesBatch(batch);
          if (level === JurisdictionLevel.LGA) await insertLgasBatch(batch);
          if (level === JurisdictionLevel.WARD) await insertWardsBatch(batch);

          count += batch.length;

          const now = Date.now();
          if (now - lastReportTime > REPORT_INTERVAL) {
            process.stdout.write(`\r✓ Processed ${count} ${level}s...`);
            lastReportTime = now;
          }

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

      const levelStats = level === JurisdictionLevel.STATE ? stats.states
        : level === JurisdictionLevel.LGA ? stats.lgas
        : stats.wards;

      logger.info(`\n✅ Finished processing ${level}s:`);
      logger.info(`   Total: ${levelStats.total}`);
      logger.info(`   Inserted: ${levelStats.inserted}`);
      logger.info(`   Skipped: ${levelStats.skipped}`);
      if (levelStats.warnings > 0) {
        logger.info(`   Warnings: ${levelStats.warnings} (fixed with default geometry)`);
      }

      resolve();
    });

    pipeline.on("error", (err: Error) => reject(err));
  });
}

/**
 * Prints a detailed report of all skipped items
 */
function printSkippedItemsReport(): void {
  if (skippedItems.length === 0) {
    logger.info("\n✓ No items were skipped during processing");
    return;
  }

  logger.info("\n" + "=".repeat(60));
  logger.info("📋 SKIPPED ITEMS REPORT");
  logger.info("=".repeat(60));

  const groupedByLevel = skippedItems.reduce((acc, item) => {
    if (!acc[item.level]) {
      acc[item.level] = [];
    }
    acc[item.level]?.push(item);
    return acc;
  }, {} as Record<string, SkippedItem[]>);

  for (const [level, items] of Object.entries(groupedByLevel)) {
    logger.info(`\n${level}s (${items.length} skipped):`);
    items.forEach((item, index) => {
      logger.info(`  ${index + 1}. "${item.name}"`);
      logger.info(`     Reason: ${item.reason}`);
      if (item.additionalInfo !== undefined) {
        logger.info(`     Details: ${JSON.stringify(item.additionalInfo, null, 2)}`);
      }
    });
  }

  logger.info("=".repeat(60));
}

async function main() {
  const seedType = process.argv[2] || "all";
  logger.info(`🌱 Starting seed process for: ${seedType}`);

  const files = {
    states: path.resolve(process.cwd(),  serverConfig.seeding.stateFilePath),
    lgas: path.resolve(process.cwd(), serverConfig.seeding.lgaFilePath),
    wards: path.resolve(process.cwd(), serverConfig.seeding.wardFilePath),
  };

  const startTime = Date.now();

  try {
    if (seedType === "all" || seedType === "state") {
      logger.info("\n🏛 Processing States...");
      await processStream(files.states, JurisdictionLevel.STATE);
    }

    if (seedType === "all" || seedType === "lga") {
      logger.info("\n🏛 Processing LGAs...");
      const stateMap = await getStateLookupMap();
      await processStream(files.lgas, JurisdictionLevel.LGA, stateMap);
    }

    if (seedType === "all" || seedType === "ward") {
      logger.info("\n🏛 Processing Wards...");
      const lgas = await prisma.lGA.findMany({
        select: { id: true, name: true, state: { select: { name: true } } },
      });

      const lgaMap = new Map<string, string>();
      for (const lga of lgas) {
        lgaMap.set(makeKey(lga.state.name, lga.name), lga.id);
      }

      await processStream(files.wards, JurisdictionLevel.WARD, lgaMap);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info("\n" + "=".repeat(60));
    logger.info("🎉 SEED COMPLETE!");
    logger.info("=".repeat(60));
    logger.info(`⏱️  Total time: ${totalTime}s`);
    logger.info("\n📊 Final Statistics:");
    logger.info(`   States:  ${stats.states.inserted}/${stats.states.total} inserted, ${stats.states.skipped} skipped, ${stats.states.warnings} warnings`);
    logger.info(`   LGAs:    ${stats.lgas.inserted}/${stats.lgas.total} inserted, ${stats.lgas.skipped} skipped, ${stats.lgas.warnings} warnings`);
    logger.info(`   Wards:   ${stats.wards.inserted}/${stats.wards.total} inserted, ${stats.wards.skipped} skipped, ${stats.wards.warnings} warnings`);
    logger.info("=".repeat(60));

    // Print detailed skipped items report
    printSkippedItemsReport();

  } catch (error) {
    logger.error("❌ Seeding failed:", { error });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();