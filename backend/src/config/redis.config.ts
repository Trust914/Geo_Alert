import type { RedisOptions } from "ioredis";
import { checkIfDefined, chooseEnvValue, getEnvVariable, getSecret } from "../utils/env.utils.js";

// ── Non-sensitive config — plain env vars ────────────────────
const REDIS_DEV_HOST = checkIfDefined(getEnvVariable("REDIS_DEV_HOST"), "REDIS_DEV_HOST");
const REDIS_DOCKER_HOST = checkIfDefined(getEnvVariable("REDIS_DOCKER_HOST"), "REDIS_DOCKER_HOST");
const REDIS_HOST = chooseEnvValue(REDIS_DEV_HOST, REDIS_DOCKER_HOST);

const REDIS_DEV_PORT = Number(checkIfDefined(getEnvVariable("REDIS_DEV_PORT"), "REDIS_DEV_PORT"));
const REDIS_DOCKER_PORT = Number(checkIfDefined(getEnvVariable("REDIS_DOCKER_PORT"), "REDIS_DOCKER_PORT"));
const REDIS_PORT = chooseEnvValue(REDIS_DEV_PORT.toString(), REDIS_DOCKER_PORT.toString());

// ── Sensitive secrets ─────────────────────────────────────────
// dev:          reads from .env  (throws if missing)
// staging|prod: reads from /run/secrets/redis_password  (throws if missing or empty)
const REDIS_PASSWORD = getSecret("redis_password", "REDIS_PASSWORD");

export const redisConfig = {
  connection: {
    port: Number(REDIS_PORT),
    host: REDIS_HOST,
    password: REDIS_PASSWORD,
    db: 0,
    keyPrefix: "geo-alert",
  } as RedisOptions,

  host: REDIS_HOST,
  port: REDIS_PORT,
  hasPassword: !!REDIS_PASSWORD,
};