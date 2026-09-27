import type { NextFunction, Request, Response } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { AppError } from '../lib/errors.js';

/**
 * Build a request schema. Every route declares one, even if empty, so that unexpected
 * input is rejected consistently. Unknown body keys are stripped by Zod.
 */
export function requestSchema<
  B extends ZodTypeAny = z.ZodObject<Record<string, never>>,
  Q extends ZodTypeAny = z.ZodObject<Record<string, never>>,
  P extends ZodTypeAny = z.ZodObject<Record<string, never>>,
>(shape: { body?: B; query?: Q; params?: P }) {
  return z.object({
    body: (shape.body ?? z.object({}).optional().default({})) as B,
    query: (shape.query ?? z.object({})) as Q,
    params: (shape.params ?? z.object({})) as P,
  });
}

export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({ body: req.body ?? {}, query: req.query, params: req.params });
    if (!result.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Request validation failed',
        result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
    req.valid = result.data;
    next();
  };
}

/** Typed accessor for data parsed by `validate(schema)`. */
export function valid<S extends ZodTypeAny>(req: Request, _schema: S): z.infer<S> {
  if (req.valid === undefined) throw new Error('valid() called on a route without validate()');
  return req.valid as z.infer<S>;
}

export const idParam = z.object({ id: z.string().min(1).max(64) });
