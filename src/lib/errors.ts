/**
 * Application error with HTTP status code and optional response details.
 * Throw this from services and middleware; the centralized handler formats the response.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function getErrorStatusCode(err: unknown): number {
  if (err instanceof AppError) {
    return err.statusCode;
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    typeof err.statusCode === "number"
  ) {
    return err.statusCode;
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof err.status === "number"
  ) {
    return err.status;
  }

  return 500;
}

export function getErrorMessage(err: unknown, isProduction: boolean): string {
  const statusCode = getErrorStatusCode(err);

  if (statusCode >= 500 && isProduction) {
    return "Internal server error";
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "Internal server error";
}

export function getErrorDetails(err: unknown): Record<string, unknown> | undefined {
  if (err instanceof AppError && err.details) {
    return err.details;
  }

  return undefined;
}

export type ErrorResponseBody = {
  error: string;
  details?: Record<string, unknown>;
};

export function buildErrorResponse(err: unknown, isProduction: boolean): ErrorResponseBody {
  const body: ErrorResponseBody = {
    error: getErrorMessage(err, isProduction),
  };

  const details = getErrorDetails(err);
  if (details) {
    body.details = details;
  }

  return body;
}
