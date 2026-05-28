import { appConfig } from "../config/env.js";
import type { ApiErrorBody } from "../types/api.types.js";
import { getStoredToken } from "../lib/storage.js";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false, signal } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getStoredToken();
    if (!token) {
      throw { error: "Not authenticated", statusCode: 401 } satisfies ApiErrorBody;
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), appConfig.apiTimeoutMs);

  const combinedSignal = signal
    ? mergeAbortSignals(signal, timeoutController.signal)
    : timeoutController.signal;

  try {
    const response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combinedSignal,
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
      throw (
        errorBody ?? {
          error: response.statusText || "Request failed",
          statusCode: response.status,
        }
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function mergeAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const abort = () => controller.abort();
  if (a.aborted || b.aborted) {
    abort();
    return controller.signal;
  }

  a.addEventListener("abort", abort);
  b.addEventListener("abort", abort);
  return controller.signal;
}
