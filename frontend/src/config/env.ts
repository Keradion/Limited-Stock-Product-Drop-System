function readIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function readApiBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  return trimmed;
}

export const appConfig = {
  apiBaseUrl: readApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  apiTimeoutMs: readIntEnv(import.meta.env.VITE_API_TIMEOUT_MS, 10_000),
  stockPollMs: readIntEnv(import.meta.env.VITE_STOCK_POLL_MS, 5_000),
  defaultProductId: (import.meta.env.VITE_DEFAULT_PRODUCT_ID ?? "").trim(),
};
