import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { emails } from '../../services/email/templates.js';
import { generateRefreshToken, hashToken, signAccessToken } from './tokens.js';

// A precomputed hash used to keep login timing uniform for unknown emails.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-password', 4);

export async function toPublicUser(user: User) {
  const vendor = await prisma.vendor.findUnique({
    where: { userId: user.id },
    select: { id: true, storeName: true, slug: true, status: true, rejectionReason: true },
  });
  return { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt, vendor };
}

async function issueTokens(user: User, familyId: string = randomUUID()) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), familyId, expiresAt },
  });
  return { accessToken: signAccessToken(user), refreshToken, refreshExpiresAt: expiresAt };
}

export async function register(input: { name: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('An account with this email already exists');
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const user = await prisma.user.create({ data: { name: input.name, email: input.email, passwordHash } });
  emails.welcome(user.email, user.name);
  return { user: await toPublicUser(user), ...(await issueTokens(user)) };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
  return { user: await toPublicUser(user), ...(await issueTokens(user)) };
}

/**
 * Rotates a refresh token. If a token that was already rotated is presented again
 * (possible theft), the whole token family is revoked.
 */
export async function refresh(presented: string | undefined) {
  if (!presented) throw AppError.unauthorized('No refresh token');
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(presented) } });
  if (!record) throw AppError.unauthorized('Invalid refresh token');

  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    logger.warn(`Refresh token reuse detected for user ${record.userId}; family revoked`);
    throw AppError.unauthorized('Refresh token reuse detected');
  }
  if (record.expiresAt < new Date()) throw AppError.unauthorized('Refresh token expired');

  // Compare-and-swap so two concurrent refreshes cannot both succeed.
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: record.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw AppError.unauthorized('Refresh token already used');

  const user = await prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
  return { user: await toPublicUser(user), ...(await issueTokens(user, record.familyId)) };
}

export async function logout(presented: string | undefined) {
  if (!presented) return;
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(presented) } });
  if (!record) return;
  await prisma.refreshToken.updateMany({
    where: { familyId: record.familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.unauthorized('User no longer exists');
  return toPublicUser(user);
}
