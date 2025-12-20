import {
  checkIfDefined,
  chooseEnvValue,
  getEnvVariable,
} from "../utils/app.utils.js";

// App specific variables
export const APP_NAME = checkIfDefined(getEnvVariable("APP_NAME"), "APP_NAME");
export const PORT = checkIfDefined(getEnvVariable("PORT"), "PORT");
export const NODE_ENV = checkIfDefined(getEnvVariable("NODE_ENV"), "NODE_ENV");
export const IS_DEV_ENV = NODE_ENV === "development";
export const IS_STAGING_ENV = NODE_ENV === "staging";
export const IS_PROD_ENV = NODE_ENV === "production";

export const PAGINATION_DEFAULT_LIMIT = Number(
  checkIfDefined(
    getEnvVariable("PAGINATION_DEFAULT_LIMIT"),
    "PAGINATION_DEFAULT_LIMIT"
  )
);
export const DEFAULT_SORT_BY = checkIfDefined(
  getEnvVariable("DEFAULT_SORT_BY"),
  "DEFAULT_SORT_BY"
);
export const ALLOWED_SORT_FIELDS = ["createdAt", "updatedAt"];
export const CACHE_SECS = Number(
  checkIfDefined(getEnvVariable("CACHE_SECS"), "CACHE_SECS")
);
// logger.debug("config max age", {AUTH_COOKIE_MAX_AGE})

export const JWT_ACCESS_TOKEN_SECRET = checkIfDefined(
  getEnvVariable("JWT_ACCESS_TOKEN_SECRET"),
  "JWT_ACCESS_TOKEN_SECRET"
);
export const JWT_REFRESH_TOKEN_SECRET = checkIfDefined(
  getEnvVariable("JWT_REFRESH_TOKEN_SECRET"),
  "JWT_REFRESH_TOKEN_SECRET"
);
export const JWT_VERIFY_TOKEN_SECRET = checkIfDefined(
  getEnvVariable("JWT_VERIFY_TOKEN_SECRET"),
  "JWT_VERIFY_TOKEN_SECRET"
);
export const JWT_REFRESH_TOKEN_EXPIRY = checkIfDefined(
  getEnvVariable("JWT_REFRESH_TOKEN_EXPIRY"),
  "JWT_REFRESH_TOKEN_EXPIRY"
);
export const JWT_ACCESS_TOKEN_EXPIRY = checkIfDefined(
  getEnvVariable("JWT_ACCESS_TOKEN_EXPIRY"),
  "JWT_ACCESS_TOKEN_EXPIRY"
);
export const VERIFY_CODE_EXPIRY_MINS = Number(
  checkIfDefined(
    getEnvVariable("VERIFY_CODE_EXPIRY_MINS"),
    "VERIFY_CODE_EXPIRY_MINS"
  )
);
export const REFRESH_TOKEN_EXPIRY_DAYS = Number(
  checkIfDefined(
    getEnvVariable("REFRESH_TOKEN_EXPIRY_DAYS"),
    "REFRESH_TOKEN_EXPIRY_DAYS"
  )
);
export const AUTH_COOKIE_MAX_AGE = Number(
  checkIfDefined(getEnvVariable("AUTH_COOKIE_MAX_AGE"), "AUTH_COOKIE_MAX_AGE")
);
const LOCALHOST_DEV = checkIfDefined(
  getEnvVariable("LOCALHOST_DEV"),
  "LOCALHOST_DEV"
);
const LOCALHOST_PROD = checkIfDefined(
  getEnvVariable("LOCALHOST_PROD"),
  "LOCALHOST_PROD"
);
export const LOCALHOST = chooseEnvValue(LOCALHOST_DEV, LOCALHOST_PROD);

// CORS Configuration
export const FRONT_END_DOMAIN = checkIfDefined(
  getEnvVariable("FRONT_END_DOMAIN"),
  "FRONT_END_DOMAIN"
);
export const CORS_ALLOWED_URLS = [
  `http://${LOCALHOST}:${PORT}`,
  FRONT_END_DOMAIN,
];

export const ENDPOINT_LIMIT = Number(getEnvVariable("ENDPOINT_LIMIT"));
export const ENDPOINT_LIMIT_TIME = Number(
  getEnvVariable("ENDPOINT_LIMIT_TIME")
);
export const RATELIMITER_REDIS_MAX_POINTS = Number(
  getEnvVariable("RATELIMITER_REDIS_MAX_POINTS")
);
export const RATELIMITER_REDIS_DURATION = Number(
  getEnvVariable("RATELIMITER_REDIS_DURATION")
);
export const RATELIMITER_REDIS_BLOCK_DURATION = Number(
  getEnvVariable("RATELIMITER_REDIS_BLOCK_DURATION")
);
export const SEED_BATCH_SIZE = Number(
  checkIfDefined(getEnvVariable("SEED_BATCH_SIZE"), "SEED_BATCH_SIZE")
);
export const SEED_STATE_FILE_PATH = checkIfDefined(
  getEnvVariable("SEED_STATE_FILE_PATH"),
  "SEED_STATE_FILE_PATH"
);  
export const SEED_LGA_FILE_PATH = checkIfDefined(
  getEnvVariable("SEED_LGA_FILE_PATH"),
  "SEED_LGA_FILE_PATH"
);
export const SEED_WARD_FILE_PATH = checkIfDefined(
  getEnvVariable("SEED_WARD_FILE_PATH"),
  "SEED_WARD_FILE_PATH"
);
export const SEED_POPULATION_FILE_PATH = checkIfDefined(
  getEnvVariable("SEED_POPULATION_FILE_PATH"),
  "SEED_POPULATION_FILE_PATH"
);
export const SEED_CONSOLIDATED_POPULATION_FILE_PATH = checkIfDefined(
  getEnvVariable("SEED_CONSOLIDATED_POPULATION_FILE_PATH"),
  "SEED_CONSOLIDATED_POPULATION_FILE_PATH"
);

