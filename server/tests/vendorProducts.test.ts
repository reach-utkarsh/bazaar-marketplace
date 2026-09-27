import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createCategory, createProduct, createUser, createVendor } from './helpers.js';

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

describe('vendor applications', () => {
  it('lets a customer apply; status starts PENDING', async () => {
    const { auth } = await createUser();
    const res = await api().post('/api/vendors/apply').set(auth).send({
      storeName: 'Tea Garden', description: 'Single-estate teas sourced directly from growers.' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ storeName: 'Tea Garden', slug: 'tea-garden', status: 'PENDING' });

    const again = await api().post('/api/vendors/apply').set(auth).send({
      storeName: 'Tea Garden 2', description: 'Single-estate teas sourced directly from growers.' });
    expect(again.status).toBe(409);

    const me = await api().get('/api/auth/me').set(auth);
    expect(me.body.user.vendor.status).toBe('PENDING');
  });

  it('rejects duplicate store names and lets rejected vendors re-apply', async () => {
    const a = await createUser();
    await api().post('/api/vendors/apply').set(a.auth).send({ storeName: 'Clay Co', description: 'Handmade ceramics from Jaipur artisans.' });
    const b = await createUser();
    const dup = await api().post('/api/vendors/apply').set(b.auth).send({ storeName: 'clay co', description: 'Handmade ceramics from Jaipur artisans.' });
    expect(dup.status).toBe(409);

    await prisma.vendor.updateMany({ where: { userId: a.user.id }, data: { status: 'REJECTED', rejectionReason: 'Incomplete' } });
    const re = await api().post('/api/vendors/apply').set(a.auth).send({ storeName: 'Clay Co', description: 'Handmade ceramics — now with photos!' });
    expect(re.status).toBe(201);
    expect(re.body.status).toBe('PENDING');
    expect(re.body.rejectionReason).toBeNull();
  });

  it('blocks pending vendors from the vendor API', async () => {
    const { auth } = await createVendor('PENDING');
    const res = await api().get('/api/vendor/products').set(auth);
    expect(res.status).toBe(403);
  });
});

describe('vendor product management', () => {
  it('creates, updates, lists and soft/hard deletes own products', async () => {
    const { auth } = await createVendor();
    const cat = await createCategory();
    const created = await api().post('/api/vendor/products').set(auth).send({
      title: 'Handwoven Basket', description: 'A sturdy basket woven from river grass.', price: 129_900, stock: 12, categoryId: cat.id });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: 'Handwoven Basket', price: 129_900, stock: 12, isActive: true });

    const updated = await api().patch(`/api/vendor/products/${created.body.id}`).set(auth).send({ stock: 3, price: 99_900 });
    expect(updated.body).toMatchObject({ stock: 3, price: 99_900 });

    const lowStock = await api().get('/api/vendor/products').query({ status: 'low_stock' }).set(auth);
    expect(lowStock.body.total).toBe(1);

    const del = await api().delete(`/api/vendor/products/${created.body.id}`).set(auth);
    expect(del.body).toEqual({ deleted: true, deactivated: false });
    expect(await prisma.product.count()).toBe(0);
  });

  it('validates product input', async () => {
    const { auth } = await createVendor();
    const res = await api().post('/api/vendor/products').set(auth).send({ title: 'x', price: -5, stock: 1.5, categoryId: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const badCat = await api().post('/api/vendor/products').set(auth).send({
      title: 'Valid title', description: 'Valid description here', price: 1000, stock: 1, categoryId: 'missing' });
    expect(badCat.status).toBe(400);
  });

  it("cannot see or modify another vendor's products", async () => {
    const a = await createVendor();
    const b = await createVendor();
    const product = await createProduct(a.vendor.id);
    expect((await api().get(`/api/vendor/products/${product.id}`).set(b.auth)).status).toBe(404);
    expect((await api().patch(`/api/vendor/products/${product.id}`).set(b.auth).send({ stock: 0 })).status).toBe(404);
    expect((await api().delete(`/api/vendor/products/${product.id}`).set(b.auth)).status).toBe(404);
    const list = await api().get('/api/vendor/products').set(b.auth);
    expect(list.body.total).toBe(0);
  });

  it('uploads and deletes images through the storage service', async () => {
    const { auth, vendor } = await createVendor();
    const product = await createProduct(vendor.id);
    const up = await api()
      .post(`/api/vendor/products/${product.id}/images`)
      .set(auth)
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('images', PNG, { filename: 'b.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body.images).toHaveLength(2);
    expect(up.body.images[0].url).toMatch(/^\/uploads\/.+\.png$/);

    const served = await api().get(up.body.images[0].url);
    expect(served.status).toBe(200);

    const del = await api().delete(`/api/vendor/products/${product.id}/images/${up.body.images[0].id}`).set(auth);
    expect(del.body.images).toHaveLength(1);
  });

  it('rejects non-image uploads', async () => {
    const { auth, vendor } = await createVendor();
    const product = await createProduct(vendor.id);
    const res = await api()
      .post(`/api/vendor/products/${product.id}/images`)
      .set(auth)
      .attach('images', Buffer.from('#!/bin/sh'), { filename: 'x.sh', contentType: 'text/x-sh' });
    expect(res.status).toBe(400);
  });
});
