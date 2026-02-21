import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.util.js";
import { execSync } from "child_process";

async function main() {
  const arg = process.argv[2] || "all";

  logger.info(`🚀 Starting Seed Process: Target = ${arg}`);

  try {
    if (arg === "all" || arg === "geo") {
      logger.info("📊 Step 1: Processing PGeospatial Data (States/LGAs/Wards)...");
      // We import the logic or execute the script
      execSync("npx tsx --env-file=.env ./src/seed/geoSpatial.ts all", { stdio: "inherit" });
    }

    if (arg === "all" || arg === "population") {
      logger.info("🗺️ Step 2: Processing Population Data...");
      // This calls  goeSpatial.ts logic
      execSync("npx tsx --env-file=.env ./src/seed/population.ts", { stdio: "inherit" });
    }

    logger.info("✅ Seeding sequence finished successfully.");
  } catch (error) {
    logger.error("❌ Seeding failed:", { error });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
