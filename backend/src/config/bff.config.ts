import { serverConfig } from "./server.config";

export const bffConfig = {
  session: {
    cookieName: "geoalert_session_id",
    absoluteTimeout: 24 * 60 * 60 * 1000,
    idleTimeout: 2 * 60 * 60 * 1000,
    maxConcurrent: 5,
    tokenRefreshThreshold: 5 * 60 * 1000,
  },

  cookie: {
    httpOnly: true,
    secure: serverConfig.app.isProd,
    sameSite: serverConfig.app.isProd ? "none" : "lax",
    path: "/",
    domain: serverConfig.app.isProd ? process.env.COOKIE_DOMAIN : undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },

  security: {
    enableDeviceFingerprinting: true,
    enableIpValidation: false,
    enableUserAgentValidation: true,
  },

  twoFactor: {
    tempSessionExpiry: 5 * 60,
    maxAttempts: 5,
    lockoutDuration: 15 * 60,
  },
};

export const bffErrorCodes = {
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  SESSION_INVALID: "SESSION_INVALID",
  SESSION_REVOKED: "SESSION_REVOKED",
  SESSION_IDLE: "SESSION_IDLE",
  SESSION_IDLE_TIMEOUT: "SESSION_IDLE_TIMEOUT",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  TOKEN_REFRESH_FAILED: "TOKEN_REFRESH_FAILED",
  TWO_FACTOR_REQUIRED: "TWO_FACTOR_REQUIRED",
  TWO_FACTOR_INVALID: "TWO_FACTOR_INVALID",
  TWO_FACTOR_EXPIRED: "TWO_FACTOR_EXPIRED",
  DEVICE_FINGERPRINT_MISMATCH: "DEVICE_FINGERPRINT_MISMATCH",
  IP_ADDRESS_MISMATCH: "IP_ADDRESS_MISMATCH",
  MAX_SESSIONS_EXCEEDED: "MAX_SESSIONS_EXCEEDED",
  USER_INACTIVE: "USER_INACTIVE",
} as const;

export type BFFErrorCode = (typeof bffErrorCodes)[keyof typeof bffErrorCodes];
