import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

export function handleInvalidJson(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof SyntaxError && "body" in err) {
    logger.warn("Invalid JSON body", {
      method: req.method,
      path: req.originalUrl,
    });
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  next(err);
}
