import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { uniqueSlug } from '../src/lib/slug.js';
import { signAccessToken } from '../src/modules/auth/tokens.js';

export const app = createApp();
export const api = () => request(app);

let seq = 0;
const next = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export const PASSWORD = 'Password123';
const hash = bcrypt.hashSync(PASSWORD, 4);

export async function createUser(role: Role = 'CUSTOMER', overrides: { email?: string; name?: string } = {}) {
  const user = await prisma.user.create({
    data: { email: overrides.email ?? `user-${next()}@test.dev`, name: overrides.name ?? 'Test User', passwordHash: hash, role },
  });
  return { user, token: signAccessToken(user), auth: { Authorization: `Bearer ${signAccessToken(user)}` } };
}

export async function createVendor(status: 'APPROVED' | 'PENDING' | 'REJECTED' = 'APPROVED') {
  const u = await createUser(status === 'APPROVED' ? 'VENDOR' : 'CUSTOMER');
  const name = `Store ${next()}`;
  const vendor = await prisma.vendor.create({
    data: { userId: u.user.id, storeName: name, slug: uniqueSlug(name), description: 'A test store', status,
      approvedAt: status === 'APPROVED' ? new Date() : null },
  });
  return { ...u, vendor };
}

export async function createCategory(name = `Category ${next()}`) {
  return prisma.category.create({ data: { name, slug: uniqueSlug(name) } });
}

export async function createProduct(vendorId: string, data: { price?: number; stock?: number; categoryId?: string; title?: string } = {}) {
  const categoryId = data.categoryId ?? (await createCategory()).id;
  const title = data.title ?? `Product ${next()}`;
  return prisma.product.create({
    data: { vendorId, categoryId, title, slug: uniqueSlug(title), description: 'A great product for testing',
      price: data.price ?? 10_000, stock: data.stock ?? 10 },
  });
}
