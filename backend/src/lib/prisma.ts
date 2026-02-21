import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../prisma/prisma/generated/client.js";
import { databaseConfig } from "../config/database.config.js";

const connectionString = databaseConfig.connectionString;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
