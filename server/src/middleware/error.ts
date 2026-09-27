import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
};

function normalize(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Validation failed',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'File is too large');
    return AppError.badRequest(err.message);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ');
      return AppError.conflict(`A record with this ${target ?? 'value'} already exists`);
    }
    if (err.code === 'P2025') return AppError.notFound();
    if (err.code === 'P2003') return AppError.conflict('Operation violates a data relationship');
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') return AppError.badRequest('Malformed JSON body');
  if (e?.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appErr = normalize(err);
  if (appErr.status >= 500) logger.error(`${req.method} ${req.originalUrl} failed`, err);
  res.status(appErr.status).json({
    error: {
      code: appErr.code,
      message: appErr.message,
      ...(appErr.details !== undefined ? { details: appErr.details } : {}),
    },
  });
};
