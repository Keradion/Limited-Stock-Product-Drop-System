import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "../lib/errors.js";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const { fieldErrors, formErrors } = result.error.flatten();
      next(
        new AppError("Validation failed", 400, {
          ...(Object.keys(fieldErrors).length > 0 && { fields: fieldErrors }),
          ...(formErrors.length > 0 && { formErrors }),
        }),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const { fieldErrors, formErrors } = result.error.flatten();
      next(
        new AppError("Validation failed", 400, {
          ...(Object.keys(fieldErrors).length > 0 && { fields: fieldErrors }),
          ...(formErrors.length > 0 && { formErrors }),
        }),
      );
      return;
    }

    req.validatedQuery = result.data;
    next();
  };
}
