import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PG_DATABASE_CONNECTION } from "../config/database.config.js";
import { PrismaClient } from "../prisma/prisma/generated/client.js";

const connectionString = PG_DATABASE_CONNECTION;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
