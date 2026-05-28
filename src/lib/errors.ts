export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
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

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  return "Internal server error";
}
