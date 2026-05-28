import type { ApiErrorBody } from "../types/api.types.js";

export type ParsedApiError = {
  message: string;
  statusCode: number | null;
  isTimeout: boolean;
  isNetworkError: boolean;
};

export function parseApiError(error: unknown): ParsedApiError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      message: "Request timed out. Please try again.",
      statusCode: null,
      isTimeout: true,
      isNetworkError: false,
    };
  }

  if (error instanceof TypeError) {
    return {
      message: "Network error. Check your connection and try again.",
      statusCode: null,
      isTimeout: false,
      isNetworkError: true,
    };
  }

  if (isApiErrorBody(error)) {
    return {
      message: error.error,
      statusCode: error.statusCode,
      isTimeout: false,
      isNetworkError: false,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: null,
      isTimeout: false,
      isNetworkError: false,
    };
  }

  return {
    message: "Something went wrong.",
    statusCode: null,
    isTimeout: false,
    isNetworkError: false,
  };
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.error === "string" && typeof record.statusCode === "number";
}
