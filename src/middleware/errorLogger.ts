import type { Request, Response, NextFunction } from "express";
import { config } from "../config/env.js";
import { getErrorMessage, getErrorStatusCode } from "../lib/errors.js";
import { logRequestError } from "../lib/logger.js";

export function errorLogger(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = getErrorStatusCode(err);

  logRequestError(err, {
    method: req.method,
    path: req.originalUrl,
    userId: req.userId,
    statusCode,
  });

  const message =
    statusCode >= 500 && config.nodeEnv === "production"
      ? "Internal server error"
      : getErrorMessage(err);

  res.status(statusCode).json({ error: message });
}
