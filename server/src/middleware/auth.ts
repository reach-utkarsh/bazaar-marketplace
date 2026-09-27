import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { prisma } from '../lib/prisma.js';

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearer(req);
  if (!token) throw AppError.unauthorized();
  req.user = verifyAccessToken(token);
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
}

/**
 * Vendor routes check the vendor record in the database (not just the JWT role),
 * so approvals/rejections take effect immediately.
 */
export async function requireApprovedVendor(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw AppError.unauthorized();
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
  if (!vendor) throw AppError.forbidden('You are not registered as a vendor');
  if (vendor.status !== 'APPROVED') throw AppError.forbidden('Your vendor account is not approved yet');
  req.vendor = vendor;
  next();
}

export function currentUser(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export function currentVendor(req: Request) {
  if (!req.vendor) throw AppError.forbidden('Vendor context missing');
  return req.vendor;
}
