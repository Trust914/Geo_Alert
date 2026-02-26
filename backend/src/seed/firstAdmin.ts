// firstAdmin.ts - WITH REDIS INITIALIZATION
import readline from "readline";
import Redis from "ioredis";

import { prisma } from "../lib/prisma.js";
import { AgencyStatus, AgencyType, JurisdictionLevel, UserRole } from "../prisma/prisma/generated/enums.js";
import { ActivationService } from "../services/activation.service.js";
import { initializeCacheService } from "../services/cache.service.js";
import { AccountType } from "../types/activation.types.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { redisConfig } from "../config/redis.config.js";
import { serverConfig } from "../config/server.config.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`\x1b[36m? ${question}\x1b[0m `, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function createFirstSuperAdmin() {
  logger.info("Starting GeoAlert System Bootstrap Sequence");

  let redisClient: Redis | null = null;

  try {
    // Initialize Redis client for this script
    logger.info("Connecting to Redis...");
    redisClient = new Redis(redisConfig.connection);

    // Wait for Redis to connect
    await new Promise<void>((resolve, reject) => {
      redisClient!.once("ready", () => {
        logger.info("Redis connected successfully");
        resolve();
      });
      redisClient!.once("error", (err) => {
        logger.error("Redis connection failed", { error: err });
        reject(err);
      });
    });

    // Initialize cache service with Redis client
    initializeCacheService(redisClient);
    logger.info("Cache service initialized");

    // Check for existing NEMA agency
    const existingNema = await prisma.agency.findFirst({
      where: {
        name: "National Emergency Management Agency",
        type: AgencyType.FEDERAL,
        jurisdictionLevel: JurisdictionLevel.NATIONAL,
      },
    });

    if (existingNema) {
      logger.warn("NEMA agency already exists", { agencyId: existingNema.id });
      const proceed = await prompt("NEMA exists. Create another Super Admin? (yes/no): ");
      if (!["yes", "y"].includes(proceed.toLowerCase())) {
        logger.info("Bootstrap cancelled");
        return;
      }
    }

    console.log("\n📝 ENTER SUPER ADMIN DETAILS");

    const firstName = await prompt("First Name: ");
    const lastName = await prompt("Last Name: ");
    const email = (await prompt("Email: ")).toLowerCase();

    if (!firstName || !lastName || !email) {
      throw AppError.badRequest("All fields are required", "Bootstrap");
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw AppError.badRequest("Invalid email format", "Bootstrap");
    }

    logger.info(`Creating Super Admin: ${email}`);

    let createdUserId: string | null = null;

    await prisma.$transaction(async (tx) => {
      // Check for existing user
      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser) {
        throw AppError.conflict(`User ${email} already exists`, "Bootstrap");
      }

      // Create or get NEMA agency
      let nemaAgency = existingNema;
      if (!nemaAgency) {
        logger.info("Creating NEMA Agency...");
        nemaAgency = await tx.agency.create({
          data: {
            name: "National Emergency Management Agency",
            type: AgencyType.FEDERAL,
            jurisdiction: "Nigeria",
            jurisdictionLevel: JurisdictionLevel.NATIONAL,
            contactEmail: serverConfig.contacts.nemaEmail,
            contactPhone: serverConfig.contacts.nemaNumber,
            status: AgencyStatus.ACTIVE,
          },
        });
        logger.info("NEMA Agency created", { agencyId: nemaAgency.id });
      }

      // Create Super Admin with placeholder hash
      const placeholderHash = "$argon2id$v=19$m=65536,t=3,p=4$PLACEHOLDER";

      const superAdmin = await tx.user.create({
        data: {
          email,
          passwordHash: placeholderHash,
          firstName,
          lastName,
          role: UserRole.ADMIN,
          agencyId: nemaAgency.id,
          isActive: false,
          mustChangePassword: false,
          emailVerified: false,
        },
      });

      createdUserId = superAdmin.id;

      logger.info("Super Admin created (pending activation)", {
        userId: superAdmin.id,
      });
    });

    // Send activation email OUTSIDE transaction to get better error info
    if (createdUserId) {
      logger.info("Preparing to send activation email...");

      // Get full user data for email
      const user = await prisma.user.findUnique({
        where: { id: createdUserId },
        include: { agency: true },
      });

      if (!user) {
        throw AppError.internal("User not found after creation", null, "Bootstrap");
      }

      logger.info("Sending activation email...", {
        userId: user.id,
        email: user.email,
      });

      try {
        await ActivationService.sendActivationEmail({
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          accountType: AccountType.AGENCY_ADMIN,
          metadata: {
            agencyName: user.agency.name,
            role: user.role,
            creatorName: "System Bootstrap",
            agencyType: user.agency.type,
            jurisdiction: user.agency.jurisdiction,
          },
        });

        logger.info("Activation email sent successfully");
      } catch (emailError) {
        logger.error("Failed to send activation email", {
          error: emailError,
          message: emailError instanceof Error ? emailError.message : "Unknown error",
          stack: emailError instanceof Error ? emailError.stack : undefined,
        });

        // Don't fail bootstrap if email fails
        console.log("\n⚠️  WARNING: Activation email failed to send");
        console.log("User created successfully but email service error occurred.");
        console.log("You may need to manually trigger activation email.");
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 BOOTSTRAP COMPLETE");
    console.log("=".repeat(60));
    console.log(`✅ Super Admin account created: ${email}`);
    console.log(`📧 Activation email sent to: ${email}`);
    console.log(`🔗 Check email to set password and activate account`);
    console.log("=".repeat(60));
    console.log("\n🔒 SECURITY:");
    console.log("• Account inactive until email verified");
    console.log("• User sets their own secure password");
    console.log("• Single-use activation token (1 hour expiry)");
    console.log("=".repeat(60));
  } catch (error) {
    const appError = error instanceof AppError ? error : AppError.internal("Bootstrap failed", error, "Bootstrap");

    logger.fatal("Bootstrap failed", {
      error: appError,
      message: appError.message,
      stack: appError.stack,
      cause: appError.cause,
    });

    console.error(`\n❌ FATAL: ${appError.message}`);
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    rl.close();

    // Disconnect services
    logger.info("Cleaning up connections...");

    if (redisClient) {
      await redisClient.quit();
      logger.info("Redis disconnected");
    }

    await prisma.$disconnect();
    logger.info("Database disconnected");

    process.exit(0);
  }
}

createFirstSuperAdmin();
