import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createUser } from './helpers.js';
import { paidOrder, vendorWithProduct } from './payment-helpers.js';

describe('reviews', () => {
  it('only verified buyers whose shipment was delivered may review', async () => {
    const v = await vendorWithProduct();
    const stranger = await createUser();
    const { customer, order } = await paidOrder([{ productId: v.product.id }]);
    const post = (auth: Record<string, string>, body = { rating: 5, comment: 'Lovely quality, would buy again.' }) =>
      api().post(`/api/products/${v.product.id}/reviews`).set(auth).send(body);

    expect((await post(stranger.auth)).status).toBe(403);
    // Bought but not delivered yet.
    expect((await post(customer.auth)).status).toBe(403);
    const elig = await api().get(`/api/products/${v.product.id}/reviews/eligibility`).set(customer.auth);
    expect(elig.body.canReview).toBe(false);

    await prisma.subOrder.update({ where: { id: order.subOrders[0].id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
    expect((await api().get(`/api/products/${v.product.id}/reviews/eligibility`).set(customer.auth)).body.canReview).toBe(true);
    expect((await post(customer.auth)).status).toBe(201);
    expect((await post(v.auth)).status).toBe(403); // vendors can't review
  });

  it('keeps one review per buyer and maintains rating aggregates', async () => {
    const v = await vendorWithProduct();
    const buyers = [];
    for (let i = 0; i < 2; i++) {
      const { customer, order } = await paidOrder([{ productId: v.product.id }]);
      await prisma.subOrder.update({ where: { id: order.subOrders[0].id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
      buyers.push(customer);
    }
    await api().post(`/api/products/${v.product.id}/reviews`).set(buyers[0].auth).send({ rating: 5, comment: 'Absolutely perfect, thank you!' });
    await api().post(`/api/products/${v.product.id}/reviews`).set(buyers[1].auth).send({ rating: 2, comment: 'Smaller than I expected it to be.' });
    let p = await prisma.product.findUniqueOrThrow({ where: { id: v.product.id } });
    expect(p).toMatchObject({ avgRating: 3.5, reviewCount: 2 });

    // Posting again edits the existing review.
    await api().post(`/api/products/${v.product.id}/reviews`).set(buyers[1].auth).send({ rating: 4, comment: 'Grew on me — actually great.' });
    p = await prisma.product.findUniqueOrThrow({ where: { id: v.product.id } });
    expect(p).toMatchObject({ avgRating: 4.5, reviewCount: 2 });

    const list = await api().get(`/api/products/${v.product.id}/reviews`);
    expect(list.body.total).toBe(2);
    expect(list.body.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 });
    expect(list.body.items[0].user.name).toBe('Test U.');
  });

  it('validates rating and comment', async () => {
    const v = await vendorWithProduct();
    const c = await createUser();
    const res = await api().post(`/api/products/${v.product.id}/reviews`).set(c.auth).send({ rating: 6, comment: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(['body.rating', 'body.comment']);
  });

  it('shortens reviewer surnames for privacy', async () => {
    const v = await vendorWithProduct();
    const c = await createUser('CUSTOMER', { name: 'Priya Sharma' });
    const { order } = await paidOrder([{ productId: v.product.id }], c);
    await prisma.subOrder.update({ where: { id: order.subOrders[0].id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
    await api().post(`/api/products/${v.product.id}/reviews`).set(c.auth).send({ rating: 4, comment: 'Nice and sturdy build.' });
    const list = await api().get(`/api/products/${v.product.id}/reviews`);
    expect(list.body.items[0].user.name).toBe('Priya S.');
  });
});
