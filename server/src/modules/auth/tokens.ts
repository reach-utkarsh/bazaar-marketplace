import { createHash, randomBytes } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';

interface AccessPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(user: { id: string; role: Role }): string {
  return jwt.sign({ role: user.role } satisfies Omit<AccessPayload, 'sub'>, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
    issuer: 'marketplace-api',
    audience: 'marketplace-client',
  });
}

export function verifyAccessToken(token: string): { id: string; role: Role } {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'marketplace-api',
      audience: 'marketplace-client',
      algorithms: ['HS256'],
    }) as jwt.JwtPayload & AccessPayload;
    if (!payload.sub || !payload.role) throw new Error('malformed');
    return { id: payload.sub, role: payload.role };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new AppError(401, 'UNAUTHORIZED', 'Access token expired');
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid access token');
  }
}

/** Refresh tokens are opaque random strings; only their SHA-256 hash is stored. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
