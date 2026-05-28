/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_TIMEOUT_MS: string;
  readonly VITE_STOCK_POLL_MS: string;
  readonly VITE_DEFAULT_PRODUCT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
