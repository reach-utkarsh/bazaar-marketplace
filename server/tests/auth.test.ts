import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createUser } from './helpers.js';

function refreshCookie(res: { headers: Record<string, unknown> }): string {
  const cookies = (res.headers['set-cookie'] as string[] | undefined) ?? [];
  const c = cookies.find((x) => x.startsWith('mp_rt='));
  if (!c) throw new Error('no refresh cookie');
  return c.split(';')[0];
}

describe('auth', () => {
  it('registers a customer, sets an httpOnly refresh cookie and returns an access token', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Asha', email: 'Asha@Example.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'asha@example.com', role: 'CUSTOMER', vendor: null });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeTypeOf('string');
    const raw = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(raw).toMatch(/HttpOnly/i);
  });

  it('rejects invalid input with a consistent error format', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['body.name', 'body.email', 'body.password']),
    );
  });

  it('rejects duplicate emails', async () => {
    await api().post('/api/auth/register').send({ name: 'Asha', email: 'dup@example.com', password: 'secret123' });
    const res = await api().post('/api/auth/register').send({ name: 'Asha', email: 'dup@example.com', password: 'secret123' });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    await api().post('/api/auth/register').send({ name: 'Ravi', email: 'ravi@example.com', password: 'secret123' });
    const bad = await api().post('/api/auth/login').send({ email: 'ravi@example.com', password: 'wrong-pass1' });
    expect(bad.status).toBe(401);
    const ok = await api().post('/api/auth/login').send({ email: 'ravi@example.com', password: 'secret123' });
    expect(ok.status).toBe(200);
    const me = await api().get('/api/auth/me').set('Authorization', `Bearer ${ok.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('ravi@example.com');
  });

  it('requires a valid bearer token for /me', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const reg = await api().post('/api/auth/register').send({ name: 'Mira', email: 'mira@example.com', password: 'secret123' });
    const first = refreshCookie(reg);

    const r1 = await api().post('/api/auth/refresh').set('Cookie', first);
    expect(r1.status).toBe(200);
    expect(r1.body.accessToken).toBeTypeOf('string');
    const second = refreshCookie(r1);
    expect(second).not.toBe(first);

    // Replaying the rotated token is treated as theft: family is revoked.
    const replay = await api().post('/api/auth/refresh').set('Cookie', first);
    expect(replay.status).toBe(401);
    const afterReuse = await api().post('/api/auth/refresh').set('Cookie', second);
    expect(afterReuse.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const reg = await api().post('/api/auth/register').send({ name: 'Dev', email: 'dev@example.com', password: 'secret123' });
    const cookie = refreshCookie(reg);
    expect((await api().post('/api/auth/logout').set('Cookie', cookie)).status).toBe(204);
    expect((await api().post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it('never stores plaintext passwords', async () => {
    const { user } = await createUser();
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('returns 404 JSON for unknown routes', async () => {
    const res = await api().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
