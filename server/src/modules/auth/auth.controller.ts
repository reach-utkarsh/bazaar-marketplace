import type { CookieOptions, Request, Response } from 'express';
import { isProduction } from '../../config/env.js';
import { currentUser } from '../../middleware/auth.js';
import { valid } from '../../middleware/validate.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export const REFRESH_COOKIE = 'mp_rt';

const cookieOptions = (expires?: Date): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/api/auth',
  ...(expires ? { expires } : {}),
});

function sendSession(res: Response, status: number, session: Awaited<ReturnType<typeof authService.login>>) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions(session.refreshExpiresAt));
  res.status(status).json({ user: session.user, accessToken: session.accessToken });
}

export async function register(req: Request, res: Response) {
  const { body } = valid(req, registerSchema);
  sendSession(res, 201, await authService.register(body));
}

export async function login(req: Request, res: Response) {
  const { body } = valid(req, loginSchema);
  sendSession(res, 200, await authService.login(body));
}

export async function refresh(req: Request, res: Response) {
  try {
    sendSession(res, 200, await authService.refresh(req.cookies?.[REFRESH_COOKIE]));
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json({ user: await authService.me(currentUser(req).id) });
}
