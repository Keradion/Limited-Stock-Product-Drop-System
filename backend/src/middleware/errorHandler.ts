import type { Request, Response, NextFunction } from "express";
import { config } from "../config/env.js";
import { AppError, buildErrorResponse, getErrorStatusCode } from "../lib/errors.js";
import { logRequestError } from "../lib/logger.js";

/**
 * Forwards malformed JSON errors from express.json() into the centralized handler.
 */
export function handleInvalidJson(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (err instanceof SyntaxError && "body" in err) {
    next(new AppError("Invalid JSON body", 400));
    return;
  }

  next(err);
}

/**
 * Central error handler — logs the error and returns a consistent JSON response.
 * Must be registered last in the Express middleware chain.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    return;
  }

  const statusCode = getErrorStatusCode(err);

  // Log server and unexpected errors; skip noisy client validation errors in production
  if (statusCode >= 500 || config.nodeEnv !== "production") {
    logRequestError(err, {
      method: req.method,
      path: req.originalUrl,
      userId: req.userId,
      statusCode,
    });
  }

  res
    .status(statusCode)
    .json(buildErrorResponse(err, config.nodeEnv === "production"));
}
