import jwt from "jsonwebtoken";
import { checkIfDefined, chooseEnvValue, getEnvVariable, getSecret } from "../utils/env.utils.js";

// ── Non-sensitive config — plain env vars ────────────────────
const API_NAME = checkIfDefined(getEnvVariable("API_NAME"), "API_NAME");
const APP_VERSION = checkIfDefined(getEnvVariable("APP_VERSION"), "APP_VERSION");
const PORT = checkIfDefined(getEnvVariable("PORT"), "PORT");
const APP_ENV = checkIfDefined(getEnvVariable("APP_ENV"), "APP_ENV");
const IS_DEV_ENV = APP_ENV === "development";
const IS_STAGING_ENV = APP_ENV === "staging";
const IS_PROD_ENV = APP_ENV === "production";
const HEALTH_MIN_RESPONSE_TIME = Number(checkIfDefined(getEnvVariable("HEALTH_MIN_RESPONSE_TIME"), "HEALTH_MIN_RESPONSE_TIME"));
const PAGINATION_DEFAULT_LIMIT = Number(checkIfDefined(getEnvVariable("PAGINATION_DEFAULT_LIMIT"), "PAGINATION_DEFAULT_LIMIT"));
const DEFAULT_SORT_BY = checkIfDefined(getEnvVariable("DEFAULT_SORT_BY"), "DEFAULT_SORT_BY");
const DEFAULT_SORT_ORDER = checkIfDefined(getEnvVariable("DEFAULT_SORT_ORDER"), "DEFAULT_SORT_ORDER");
const ALLOWED_SORT_FIELDS = ["createdAt", "updatedAt"];
const JWT_2FA_PENDING_EXPIRY = checkIfDefined(getEnvVariable("JWT_2FA_PENDING_EXPIRY"), "JWT_2FA_PENDING_EXPIRY");
const JWT_REFRESH_TOKEN_EXPIRY = checkIfDefined(getEnvVariable("JWT_REFRESH_TOKEN_EXPIRY"), "JWT_REFRESH_TOKEN_EXPIRY");
const JWT_ACCESS_TOKEN_EXPIRY = checkIfDefined(getEnvVariable("JWT_ACCESS_TOKEN_EXPIRY"), "JWT_ACCESS_TOKEN_EXPIRY");
const VERIFY_CODE_EXPIRY_MINS = Number(checkIfDefined(getEnvVariable("VERIFY_CODE_EXPIRY_MINS"), "VERIFY_CODE_EXPIRY_MINS"));
const REFRESH_TOKEN_EXPIRY_DAYS = Number(checkIfDefined(getEnvVariable("REFRESH_TOKEN_EXPIRY_DAYS"), "REFRESH_TOKEN_EXPIRY_DAYS"));
const LOCALHOST_DEV = checkIfDefined(getEnvVariable("LOCALHOST_DEV"), "LOCALHOST_DEV");
const LOCALHOST_PROD = checkIfDefined(getEnvVariable("LOCALHOST_PROD"), "LOCALHOST_PROD");
const LOCALHOST = chooseEnvValue(LOCALHOST_DEV, LOCALHOST_PROD);

const FRONT_END_DOMAIN_DEV = checkIfDefined(getEnvVariable("FRONT_END_DOMAIN_DEV"), "FRONT_END_DOMAIN_DEV");
const FRONT_END_DOMAIN_STAGING = checkIfDefined(getEnvVariable("FRONT_END_DOMAIN_STAGING"), "FRONT_END_DOMAIN_STAGING");
const FRONT_END_DOMAIN_PROD = checkIfDefined(getEnvVariable("FRONT_END_DOMAIN_PROD"), "FRONT_END_DOMAIN_PROD");
// const FRONT_END_DOMAIN = chooseEnvValue(FRONT_END_DOMAIN_DEV, FRONT_END_DOMAIN_STAGING, FRONT_END_DOMAIN_PROD);
const CORS_ALLOWED_URLS = [`http://${LOCALHOST}:${PORT}`, FRONT_END_DOMAIN_DEV, FRONT_END_DOMAIN_STAGING, FRONT_END_DOMAIN_PROD];

const ENDPOINT_LIMIT = Number(getEnvVariable("ENDPOINT_LIMIT"));
const ENDPOINT_LIMIT_TIME = Number(getEnvVariable("ENDPOINT_LIMIT_TIME"));
const RATELIMITER_REDIS_MAX_POINTS = Number(getEnvVariable("RATELIMITER_REDIS_MAX_POINTS"));
const RATELIMITER_REDIS_DURATION = Number(getEnvVariable("RATELIMITER_REDIS_DURATION"));
const RATELIMITER_REDIS_BLOCK_DURATION = Number(getEnvVariable("RATELIMITER_REDIS_BLOCK_DURATION"));
const SEED_BATCH_SIZE = Number(checkIfDefined(getEnvVariable("SEED_BATCH_SIZE"), "SEED_BATCH_SIZE"));
const SEED_STATE_FILE_PATH = checkIfDefined(getEnvVariable("SEED_STATE_FILE_PATH"), "SEED_STATE_FILE_PATH");
const SEED_LGA_FILE_PATH = checkIfDefined(getEnvVariable("SEED_LGA_FILE_PATH"), "SEED_LGA_FILE_PATH");
const SEED_WARD_FILE_PATH = checkIfDefined(getEnvVariable("SEED_WARD_FILE_PATH"), "SEED_WARD_FILE_PATH");
const SEED_POPULATION_FILE_PATH = checkIfDefined(getEnvVariable("SEED_POPULATION_FILE_PATH"), "SEED_POPULATION_FILE_PATH");
const SEED_CONSOLIDATED_POPULATION_FILE_PATH = checkIfDefined(getEnvVariable("SEED_CONSOLIDATED_POPULATION_FILE_PATH"), "SEED_CONSOLIDATED_POPULATION_FILE_PATH");
const PASSWORD_MIN_LENGTH = Number(checkIfDefined(getEnvVariable("PASSWORD_MIN_LENGTH"), "PASSWORD_MIN_LENGTH"));
const NEMA_CONTACT_EMAIL = checkIfDefined(getEnvVariable("NEMA_CONTACT_EMAIL"), "NEMA_CONTACT_EMAIL");
const NEMA_CONTACT_NUMBER = checkIfDefined(getEnvVariable("NEMA_CONTACT_NUMBER"), "NEMA_CONTACT_NUMBER");
const LOGIN_MAX_ATTEMPTS = Number(checkIfDefined(getEnvVariable("LOGIN_MAX_ATTEMPTS"), "LOGIN_MAX_ATTEMPTS"));
const MAX_LOG_FILE = Number(checkIfDefined(getEnvVariable("MAX_LOG_FILE"), "MAX_LOG_FILE"));
const MAX_LOG_FILE_SIZE = Number(checkIfDefined(getEnvVariable("MAX_LOG_FILE_SIZE"), "MAX_LOG_FILE_SIZE"));
const MAX_BATCH_LOG_FILE = Number(checkIfDefined(getEnvVariable("MAX_BATCH_LOG_FILE"), "MAX_BATCH_LOG_FILE"));
const MAX_BATCH_LOG_SIZE = Number(checkIfDefined(getEnvVariable("MAX_BATCH_LOG_SIZE"), "MAX_BATCH_LOG_SIZE"));
const DELIVERY_ALERT_MAX_RETRY = Number(checkIfDefined(getEnvVariable("DELIVERY_ALERT_MAX_RETRY"), "DELIVERY_ALERT_MAX_RETRY"));
const IV_LENGTH = Number(checkIfDefined(getEnvVariable("IV_LENGTH"), "IV_LENGTH"));
const CYPHER_ALGORITHM = checkIfDefined(getEnvVariable("CYPHER_ALGORITHM"), "CYPHER_ALGORITHM");
const DEFAULT_PASSWORD_LENGTH = Number(checkIfDefined(getEnvVariable("DEFAULT_PASSWORD_LENGTH"), "DEFAULT_PASSWORD_LENGTH"));
const SYSTEM_SECRET_BYTES_LENGTH = Number(checkIfDefined(getEnvVariable("SYSTEM_SECRET_BYTES_LENGTH"), "SYSTEM_SECRET_BYTES_LENGTH"));
const SALT_ROUNDS = Number(checkIfDefined(getEnvVariable("SALT_ROUNDS"), "SALT_ROUNDS"));

// ── Sensitive secrets ─────────────────────────────────────────
// dev:              reads from .env (throws if missing)
// staging|prod:     reads from /run/secrets/<name> (throws if missing or empty)
const JWT_ACCESS_TOKEN_SECRET: jwt.Secret = getSecret("jwt_access_token_secret", "JWT_ACCESS_TOKEN_SECRET");
const JWT_REFRESH_TOKEN_SECRET: jwt.Secret = getSecret("jwt_refresh_token_secret", "JWT_REFRESH_TOKEN_SECRET");
const JWT_2FA_TOKEN_SECRET: jwt.Secret = getSecret("jwt_2fa_token_secret", "JWT_2FA_TOKEN_SECRET");
const JWT_VERIFY_TOKEN_SECRET: jwt.Secret = getSecret("jwt_verify_token_secret", "JWT_VERIFY_TOKEN_SECRET");
const TWO_FACTOR_ENCRYPTION_KEY = getSecret("two_factor_encryption_key", "TWO_FACTOR_ENCRYPTION_KEY");

export const serverConfig = {
  app: {
    name: API_NAME,
    version: APP_VERSION,
    port: PORT,
    environment: APP_ENV,
    isDev: IS_DEV_ENV,
    isStaging: IS_STAGING_ENV,
    isProd: IS_PROD_ENV,
  },

  cors: {
    allowedUrls: CORS_ALLOWED_URLS,
    frontendDomainDev: FRONT_END_DOMAIN_DEV,
    frontendDomainStaging: FRONT_END_DOMAIN_STAGING,
    frontendDomainProd: FRONT_END_DOMAIN_PROD,
    localhost: LOCALHOST,
  },

  pagination: {
    defaultLimit: PAGINATION_DEFAULT_LIMIT,
    defaultSortBy: DEFAULT_SORT_BY,
    defaultSortOrder: DEFAULT_SORT_ORDER,
    allowedSortFields: ALLOWED_SORT_FIELDS,
  },

  jwt: {
    accessTokenSecret: JWT_ACCESS_TOKEN_SECRET,
    refreshTokenSecret: JWT_REFRESH_TOKEN_SECRET,
    twoFactorTokenSecret: JWT_2FA_TOKEN_SECRET,
    verifyTokenSecret: JWT_VERIFY_TOKEN_SECRET,
    accessTokenExpiry: JWT_ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiry: JWT_REFRESH_TOKEN_EXPIRY,
    twoFactorPendingExpiry: JWT_2FA_PENDING_EXPIRY,
    verifyCodeExpiryMins: VERIFY_CODE_EXPIRY_MINS,
    refreshTokenExpiryDays: REFRESH_TOKEN_EXPIRY_DAYS,
  },

  rateLimiting: {
    endpointLimit: ENDPOINT_LIMIT,
    endpointLimitTime: ENDPOINT_LIMIT_TIME,
    redisMaxPoints: RATELIMITER_REDIS_MAX_POINTS,
    redisDuration: RATELIMITER_REDIS_DURATION,
    redisBlockDuration: RATELIMITER_REDIS_BLOCK_DURATION,
    loginMaxAttempts: LOGIN_MAX_ATTEMPTS,
  },

  seeding: {
    batchSize: SEED_BATCH_SIZE,
    stateFilePath: SEED_STATE_FILE_PATH,
    lgaFilePath: SEED_LGA_FILE_PATH,
    wardFilePath: SEED_WARD_FILE_PATH,
    populationFilePath: SEED_POPULATION_FILE_PATH,
    consolidatedPopulationFilePath: SEED_CONSOLIDATED_POPULATION_FILE_PATH,
  },

  security: {
    passwordMinLength: PASSWORD_MIN_LENGTH,
    saltRounds: SALT_ROUNDS,
    defaultPasswordLength: DEFAULT_PASSWORD_LENGTH,
    systemSecretBytesLength: SYSTEM_SECRET_BYTES_LENGTH,
  },

  encryption: {
    twoFactorKey: TWO_FACTOR_ENCRYPTION_KEY,
    ivLength: IV_LENGTH,
    cipherAlgorithm: CYPHER_ALGORITHM,
  },

  monitoring: {
    healthMinResponseTime: HEALTH_MIN_RESPONSE_TIME,
    maxLogFile: MAX_LOG_FILE,
    maxLogFileSize: MAX_LOG_FILE_SIZE,
    maxBatchLogFile: MAX_BATCH_LOG_FILE,
    maxBatchLogSize: MAX_BATCH_LOG_SIZE,
  },

  contacts: {
    nemaEmail: NEMA_CONTACT_EMAIL,
    nemaNumber: NEMA_CONTACT_NUMBER,
  },

  delivery: {
    maxRetry: DELIVERY_ALERT_MAX_RETRY,
  },
};