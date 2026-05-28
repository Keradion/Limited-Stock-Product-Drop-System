import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const { fieldErrors, formErrors } = result.error.flatten();

      res.status(400).json({
        error: "Validation failed",
        details: fieldErrors,
        ...(formErrors.length > 0 && { formErrors }),
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
