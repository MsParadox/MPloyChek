// ============================================================
// MPloyChek — Validation Middleware (Zod)
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = result.error.errors.map((e: ZodError['errors'][0]) => ({
        field:   e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({
        success:   false,
        error:     'Validation failed',
        details:   errors,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    // Replace the target with the parsed/coerced values
    (req as any)[target] = result.data;
    next();
  };
}
