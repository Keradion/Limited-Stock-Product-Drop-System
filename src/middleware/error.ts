import type { Request, Response, NextFunction } from "express";

export function handleInvalidJson(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  next(err);
}
