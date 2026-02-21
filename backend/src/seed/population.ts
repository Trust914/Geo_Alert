import * as fs from "fs";
import type { GeoJSON, LGAOutput, StateOutput, WardOutput } from "../types/seed.types.js";
import { logger } from "../utils/logger.util.js";
import { serverConfig } from "../config/server.config.js";

function processData() {
  const startTime = Date.now();

  try {
    logger.info(`[PopulationScript] Reading ${serverConfig.seeding.populationFilePath}...`);

    // Check if file exists before reading
    if (!fs.existsSync(serverConfig.seeding.populationFilePath)) {
      logger.error(`[PopulationScript] Input file not found: ${serverConfig.seeding.populationFilePath}`);
      return;
    }

    const rawData = fs.readFileSync(serverConfig.seeding.populationFilePath, "utf-8");
    const geoJson: GeoJSON = JSON.parse(rawData);

    // Structure: State -> LGA -> Ward -> Total Population
    const aggregation = new Map<string, Map<string, Map<string, number>>>();

    logger.info(`[PopulationScript] Aggregating ${geoJson.features.length} features...`);

    for (const feature of geoJson.features) {
      const p = feature.properties;
      const state = p.state_name;
      const lga = p.lga_name;
      const ward = p.ward_name;

      // We read the pre-calculated total for this row (Total of all Age Groups)
      const rowPopulation = Number(p.pop_total) || 0;

      // Ensure State bucket exists
      if (!aggregation.has(state)) {
        aggregation.set(state, new Map());
      }
      const stateMap = aggregation.get(state)!;

      // Ensure LGA bucket exists
      if (!stateMap.has(lga)) {
        stateMap.set(lga, new Map());
      }
      const lgaMap = stateMap.get(lga)!;

      // Add this row's population (Male or Female) to the Ward's running total
      const currentWardPop = lgaMap.get(ward) || 0;
      lgaMap.set(ward, currentWardPop + rowPopulation);
    }

    logger.info("[PopulationScript] Transforming to final structure...");

    const output: StateOutput[] = [];

    // Loop through aggregated States
    for (const [stateName, lgasMap] of aggregation) {
      const lgaList: LGAOutput[] = [];
      let stateTotalPop = 0;

      // Loop through aggregated LGAs
      for (const [lgaName, wardsMap] of lgasMap) {
        const wardList: WardOutput[] = [];
        let lgaTotalPop = 0;

        // Loop through aggregated Wards
        for (const [wardName, wardPop] of wardsMap) {
          wardList.push({
            ward: wardName,
            population: wardPop,
          });
          lgaTotalPop += wardPop;
        }

        // Sort Wards alphabetically
        wardList.sort((a, b) => a.ward.localeCompare(b.ward));

        lgaList.push({
          lga: lgaName,
          population: lgaTotalPop,
          wards: wardList,
        });

        stateTotalPop += lgaTotalPop;
      }

      // Sort LGAs alphabetically
      lgaList.sort((a, b) => a.lga.localeCompare(b.lga));

      output.push({
        state: stateName,
        population: stateTotalPop,
        lgas: lgaList,
      });
    }

    // Sort States alphabetically
    output.sort((a, b) => a.state.localeCompare(b.state));

    // Write Output
    logger.info(`[PopulationScript] Writing results to ${serverConfig.seeding.consolidatedPopulationFilePath}...`);
    fs.writeFileSync(serverConfig.seeding.consolidatedPopulationFilePath, JSON.stringify(output, null, 2));

    const duration = (Date.now() - startTime) / 1000;
    logger.info(`[PopulationScript] Done! Processed successfully in ${duration.toFixed(2)}s`);
  } catch (error) {
    logger.error("[PopulationScript] Error processing file:", { error });
    logger.error(`[PopulationScript] Ensure '${serverConfig.seeding.populationFilePath}' is in the correct folder.`);
  }
}

processData();
