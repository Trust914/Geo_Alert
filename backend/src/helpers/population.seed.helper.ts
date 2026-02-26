import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger.util.js";
import type { StateOutput } from "../types/seed.types.js";

const POPULATION_FILE_PATH = path.resolve(process.cwd(), "src/seed/data/consolidated_population.json");

export class PopulationService {
  private static isInitialized = false;
  private static stateMap = new Map<string, number>();
  private static lgaMap = new Map<string, number>(); // Key: "state:lga"
  private static wardMap = new Map<string, number>(); // Key: "state:lga:ward"

  static initialize() {
    if (this.isInitialized) return;

    try {
      if (!fs.existsSync(POPULATION_FILE_PATH)) {
        logger.warn(`[PopulationService] File missing at ${POPULATION_FILE_PATH}. Populations will be null.`);
        return;
      }

      logger.info("[PopulationService] Loading population data into memory...");

      const raw = fs.readFileSync(POPULATION_FILE_PATH, "utf-8");
      const data: StateOutput[] = JSON.parse(raw);

      for (const s of data) {
        const stateKey = this.normalize(s.state);
        this.stateMap.set(stateKey, s.population);

        for (const l of s.lgas) {
          const lgaKey = `${stateKey}:${this.normalize(l.lga)}`;
          this.lgaMap.set(lgaKey, l.population);

          for (const w of l.wards) {
            const wardKey = `${lgaKey}:${this.normalize(w.ward)}`;
            this.wardMap.set(wardKey, w.population);
          }
        }
      }

      this.isInitialized = true;
      logger.info("[PopulationService]: Population data loaded successfully.");
    } catch (error) {
      logger.error("[PopulationService]: Failed to load population data", { error });
    }
  }

  private static normalize(name: string): string {
    return name
      ? name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]/g, "")
      : ""; // normalize names for loose matching (case-insensitive, ignores symbols)
  }

  static getStatePopulation(name: string): number | null {
    if (!this.isInitialized) this.initialize();
    return this.stateMap.get(this.normalize(name)) || null;
  }

  static getLgaPopulation(stateName: string, lgaName: string): number | null {
    if (!this.isInitialized) this.initialize();
    return this.lgaMap.get(`${this.normalize(stateName)}:${this.normalize(lgaName)}`) || null;
  }

  static getWardPopulation(stateName: string, lgaName: string, wardName: string): number | null {
    if (!this.isInitialized) this.initialize();
    return this.wardMap.get(`${this.normalize(stateName)}:${this.normalize(lgaName)}:${this.normalize(wardName)}`) || null;
  }
}
