const _env = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_MAPBOX_TOKEN: import.meta.env.VITE_MAPBOX_TOKEN,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  VITE_MAPBOX_PUBLIC_TOKEN: import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN,
  VITE_MAPBOX_SECRET_TOKEN: import.meta.env.VITE_MAPBOX_SECRET_TOKEN,
};

export const ENV = {
  API_BASE_URL: _env.VITE_API_BASE_URL,
  APP_NAME: _env.VITE_APP_NAME,
  MAPBOX_PUBLIC_TOKEN: _env.VITE_MAPBOX_PUBLIC_TOKEN,
  MAPBOX_SECRET_TOKEN: _env.VITE_MAPBOX_SECRET_TOKEN,
  APP_ENV: _env.VITE_APP_ENV,
  // Helper flags
  IS_DEV: _env.VITE_APP_ENV === "development",
  IS_PROD: _env.VITE_APP_ENV === "production",
  TOKEN_REFRESH_INTERVAL: 4 * 60 * 1000, // 4 minutes (if token expires in 5 mins)
  SESSION_WARNING_TIME: 5 * 60 * 1000,
} as const;