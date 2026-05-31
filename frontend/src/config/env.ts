function readIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function readApiBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed && import.meta.env.PROD) {
    return "https://limited-stock-drop.pxxl.click";
  }

  // If someone accidentally sets a full path (e.g. "https://host.example/health"),
  // use only the origin (`https://host.example`) so requests to `/api/...` are formed correctly.
  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    // Not an absolute URL — return as-is (the existing behavior)
    return trimmed;
  }
}

export const appConfig = {
  apiBaseUrl: readApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  apiTimeoutMs: readIntEnv(import.meta.env.VITE_API_TIMEOUT_MS, 10_000),
  stockPollMs: readIntEnv(import.meta.env.VITE_STOCK_POLL_MS, 5_000),
  defaultProductId: (import.meta.env.VITE_DEFAULT_PRODUCT_ID ?? "").trim(),
};
