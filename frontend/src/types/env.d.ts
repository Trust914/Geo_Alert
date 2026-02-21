/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_MAPBOX_TOKEN: string;
  readonly VITE_WS_URL: string;
  VITE_APP_ENV:string;
  readonly TOKEN_REFRESH_INTERVAL: number;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}