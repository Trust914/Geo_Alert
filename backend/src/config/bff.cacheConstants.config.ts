export const bffCacheConstants = {
  keys: {
    AUTH: {
      SESSION: 'session',
      USER_SESSIONS: 'user:sessions',
      REFRESH_TOKEN_METADATA: 'refresh:metadata',
      REFRESH_TOKEN_MAP: 'refresh:map',
      REFRESH_TOKEN_FAMILY: 'refresh:family',
      TOKEN_BLACKLIST: 'token:blacklist',
      DEVICE_FINGERPRINT: 'device:fingerprint',
      CSRF_TOKEN: 'csrf:token',
      LOGIN_ATTEMPTS: 'login:attempts',
      TWO_FA_ATTEMPTS: '2fa:attempts',
    },
  },

  ttl: {
    SESSION_ABSOLUTE: 24 * 60 * 60,
    SESSION_IDLE: 2 * 60 * 60,
    ACCESS_TOKEN: 15 * 60,
    REFRESH_TOKEN: 7 * 24 * 60 * 60,
    PRE_AUTH_TOKEN: 5 * 60,
    TOKEN_BLACKLIST: 24 * 60 * 60,
    CSRF_TOKEN: 60 * 60,
    DEVICE_FINGERPRINT: 30 * 24 * 60 * 60,
    REFRESH_TOKEN_METADATA: 7 * 24 * 60 * 60,
    SESSION_METADATA: 24 * 60 * 60,
  },
};