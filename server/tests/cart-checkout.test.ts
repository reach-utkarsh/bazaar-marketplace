import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { setCommissionBps } from '../src/modules/settings/settings.service.js';
import { addToCart, api, checkout, createProduct, createUser, createVendor } from './helpers.js';

describe('cart', () => {
  it('groups items by vendor and totals them', async () => {
    const { auth } = await createUser();
    const a = await createVendor();
    const b = await createVendor();
    const p1 = await createProduct(a.vendor.id, { price: 10_000 });
    const p2 = await createProduct(a.vendor.id, { price: 5_000 });
    const p3 = await createProduct(b.vendor.id, { price: 20_000 });
    await addToCart(auth, p1.id, 2);
    await addToCart(auth, p2.id);
    const cart = await addToCart(auth, p3.id);
    expect(cart.groups).toHaveLength(2);
    expect(cart.total).toBe(2 * 10_000 + 5_000 + 20_000);
    expect(cart.itemCount).toBe(4);
    const groupA = cart.groups.find((g: { vendor: { id: string } }) => g.vendor.id === a.vendor.id);
    expect(groupA.subtotal).toBe(25_000);
  });

  it('merges repeated adds and enforces stock', async () => {
    const { auth } = await createUser();
    const { vendor } = await createVendor();
    const p = await createProduct(vendor.id, { stock: 3 });
    await addToCart(auth, p.id, 2);
    const over = await api().post('/api/cart/items').set(auth).send({ productId: p.id, quantity: 2 });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('INSUFFICIENT_STOCK');
    const upd = await api().patch(`/api/cart/items/${p.id}`).set(auth).send({ quantity: 3 });
    expect(upd.body.itemCount).toBe(3);
    const del = await api().delete(`/api/cart/items/${p.id}`).set(auth);
    expect(del.body.groups).toHaveLength(0);
  });

  it('rejects inactive products and non-customers', async () => {
    const { auth } = await createUser();
    const { vendor, auth: vendorAuth } = await createVendor();
    const p = await createProduct(vendor.id);
    await prisma.product.update({ where: { id: p.id }, data: { isActive: false } });
    expect((await api().post('/api/cart/items').set(auth).send({ productId: p.id })).status).toBe(404);
    expect((await api().get('/api/cart').set(vendorAuth)).status).toBe(403);
  });
});

describe('checkout', () => {
  it('splits the order per vendor, snapshots commission, reserves stock and empties the cart', async () => {
    await setCommissionBps(1500); // 15%
    const { auth, user } = await createUser();
    const a = await createVendor();
    const b = await createVendor();
    const p1 = await createProduct(a.vendor.id, { price: 10_000, stock: 5 });
    const p2 = await createProduct(b.vendor.id, { price: 33_333, stock: 5 });
    await addToCart(auth, p1.id, 2);
    await addToCart(auth, p2.id, 1);

    const res = await checkout(auth);
    expect(res.status).toBe(201);
    const { order, payment } = res.body;
    expect(order.paymentStatus).toBe('PENDING');
    expect(order.totalAmount).toBe(53_333);
    expect(order.subOrders).toHaveLength(2);
    const subA = order.subOrders.find((s: { vendorId: string }) => s.vendorId === a.vendor.id);
    expect(subA).toMatchObject({ subtotal: 20_000, commissionRateBps: 1500, commissionAmount: 3_000, vendorEarnings: 17_000, status: 'PLACED' });
    const subB = order.subOrders.find((s: { vendorId: string }) => s.vendorId === b.vendor.id);
    expect(subB.commissionAmount + subB.vendorEarnings).toBe(33_333);
    expect(subB.items[0]).toMatchObject({ productTitle: p2.title, unitPrice: 33_333, quantity: 1 });

    expect(payment).toMatchObject({ provider: 'MOCK', amount: 53_333, orderId: order.id });
    expect(payment.providerOrderId).toMatch(/^mock_order_/);

    expect((await prisma.product.findUniqueOrThrow({ where: { id: p1.id } })).stock).toBe(3);
    expect(await prisma.cartItem.count({ where: { userId: user.id } })).toBe(0);
  });

  it('later commission changes do not affect existing sub-orders', async () => {
    const { auth } = await createUser();
    const { vendor } = await createVendor();
    const p = await createProduct(vendor.id, { price: 10_000 });
    await addToCart(auth, p.id);
    const { body } = await checkout(auth);
    await setCommissionBps(2500);
    const sub = await prisma.subOrder.findFirstOrThrow({ where: { orderId: body.order.id } });
    expect(sub.commissionRateBps).toBe(1000);
    expect(sub.commissionAmount).toBe(1_000);
  });

  it('validates the address and rejects an empty cart', async () => {
    const { auth } = await createUser();
    const bad = await api().post('/api/orders/checkout').set(auth).send({ address: { shippingName: 'A' } });
    expect(bad.status).toBe(400);
    const empty = await checkout(auth);
    expect(empty.status).toBe(400);
    expect(empty.body.error.message).toMatch(/empty/);
  });

  it('fails atomically when one item is short on stock', async () => {
    const { auth } = await createUser();
    const { vendor } = await createVendor();
    const plenty = await createProduct(vendor.id, { stock: 10 });
    const scarce = await createProduct(vendor.id, { stock: 2 });
    await addToCart(auth, plenty.id, 3);
    await addToCart(auth, scarce.id, 2);
    await prisma.product.update({ where: { id: scarce.id }, data: { stock: 1 } }); // someone else bought one

    const res = await checkout(auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    // Nothing was deducted and no order was created.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: plenty.id } })).stock).toBe(10);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.cartItem.count()).toBe(2);
  });

  it('lets the customer cancel an unpaid order, releasing stock', async () => {
    const { auth } = await createUser();
    const { vendor } = await createVendor();
    const p = await createProduct(vendor.id, { stock: 4 });
    await addToCart(auth, p.id, 3);
    const { body } = await checkout(auth);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(1);

    const res = await api().post(`/api/orders/${body.order.id}/cancel`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe('CANCELLED');
    expect(res.body.subOrders.every((s: { status: string }) => s.status === 'CANCELLED')).toBe(true);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(4);

    // Cancelling twice is rejected.
    expect((await api().post(`/api/orders/${body.order.id}/cancel`).set(auth)).status).toBe(409);
  });

  it("hides other customers' orders", async () => {
    const a = await createUser();
    const b = await createUser();
    const { vendor } = await createVendor();
    const p = await createProduct(vendor.id);
    await addToCart(a.auth, p.id);
    const { body } = await checkout(a.auth);
    expect((await api().get(`/api/orders/${body.order.id}`).set(b.auth)).status).toBe(404);
    expect((await api().post(`/api/orders/${body.order.id}/cancel`).set(b.auth)).status).toBe(404);
  });
});
