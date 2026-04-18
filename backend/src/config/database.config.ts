import { checkIfDefined, chooseEnvValue, getEnvVariable, getSecret } from "../utils/env.utils.js";

// ── Non-sensitive config — plain env vars ────────────────────
const PG_DB_USER = checkIfDefined(getEnvVariable("PG_DB_USER"), "PG_DB_USER");
const PG_DB_DOCKER_HOST = checkIfDefined(getEnvVariable("PG_DB_DOCKER_HOST"), "PG_DB_DOCKER_HOST");
const PG_DB_DEV_HOST = checkIfDefined(getEnvVariable("PG_DB_DEV_HOST"), "PG_DB_DEV_HOST");
const PG_DB_HOST = chooseEnvValue(PG_DB_DEV_HOST, PG_DB_DOCKER_HOST);
const PG_DB_PORT = checkIfDefined(getEnvVariable("PG_DB_PORT"), "PG_DB_PORT");
const PG_DB_NAME = checkIfDefined(getEnvVariable("PG_DB_NAME"), "PG_DB_NAME");

// ── Sensitive secrets ─────────────────────────────────────────
// dev:          reads from .env  (throws if missing)
// staging|prod: reads from /run/secrets/postgres_password  (throws if missing or empty)
const PG_DB_PASSWORD = getSecret("postgres_password", "PG_DB_PASSWORD");

export const databaseConfig = {
  connectionString: `postgresql://${PG_DB_USER}:${PG_DB_PASSWORD}@${PG_DB_HOST}:${PG_DB_PORT}/${PG_DB_NAME}?schema=public`,
  user: PG_DB_USER,
  host: PG_DB_HOST,
  port: PG_DB_PORT,
  database: PG_DB_NAME,
};
