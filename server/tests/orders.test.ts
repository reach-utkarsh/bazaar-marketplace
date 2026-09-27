import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { paymentProvider } from '../src/services/payments/index.js';
import { addToCart, api, checkout, createUser } from './helpers.js';
import { paidOrder, vendorWithProduct } from './payment-helpers.js';

const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stock;

describe('customer orders', () => {
  it('lists own orders newest first with sub-orders', async () => {
    const a = await vendorWithProduct();
    const b = await vendorWithProduct();
    const { customer, order } = await paidOrder([{ productId: a.product.id }, { productId: b.product.id }]);
    await paidOrder([{ productId: a.product.id }]); // someone else's order

    const res = await api().get('/api/orders').set(customer.auth);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe(order.id);
    expect(res.body.items[0].subOrders).toHaveLength(2);
    expect(res.body.items[0].subOrders[0].events.length).toBeGreaterThan(0);
  });
});

describe('vendor order management', () => {
  it('vendors see only their own sub-orders, and only paid ones', async () => {
    const a = await vendorWithProduct();
    const b = await vendorWithProduct();
    await paidOrder([{ productId: a.product.id }, { productId: b.product.id }]);
    // An unpaid order must not show up for the vendor.
    const unpaid = await createUser();
    await addToCart(unpaid.auth, a.product.id);
    await checkout(unpaid.auth);

    const res = await api().get('/api/vendor/orders').set(a.auth);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].vendorId).toBe(a.vendor.id);
    expect(res.body.items[0].order.shippingCity).toBe('Bengaluru');
    expect(res.body.statusCounts).toEqual({ PLACED: 1 });
  });

  it('follows PLACED → PACKED → SHIPPED → DELIVERED and records the timeline', async () => {
    const v = await vendorWithProduct();
    const { order } = await paidOrder([{ productId: v.product.id }]);
    const subId = order.subOrders[0].id;
    const patch = (body: object) => api().patch(`/api/vendor/orders/${subId}/status`).set(v.auth).send(body);

    // Cannot skip steps.
    expect((await patch({ status: 'DELIVERED' })).status).toBe(409);
    expect((await patch({ status: 'PACKED' })).body.status).toBe('PACKED');
    // Shipping needs a tracking number.
    expect((await patch({ status: 'SHIPPED' })).status).toBe(400);
    const shipped = await patch({ status: 'SHIPPED', trackingNumber: 'DTDC123456', carrier: 'DTDC' });
    expect(shipped.body).toMatchObject({ status: 'SHIPPED', trackingNumber: 'DTDC123456', carrier: 'DTDC' });
    const delivered = await patch({ status: 'DELIVERED' });
    expect(delivered.body.status).toBe('DELIVERED');
    expect(delivered.body.deliveredAt).toBeTruthy();
    expect(delivered.body.events.map((e: { status: string }) => e.status)).toEqual(['PLACED', 'PACKED', 'SHIPPED', 'DELIVERED']);

    // Terminal state.
    expect((await patch({ status: 'PACKED' })).status).toBe(409);
    expect((await patch({ status: 'CANCELLED', reason: 'Changed my mind' })).status).toBe(409);
  });

  it("cannot touch another vendor's sub-order", async () => {
    const a = await vendorWithProduct();
    const b = await vendorWithProduct();
    const { order } = await paidOrder([{ productId: a.product.id }]);
    const res = await api().patch(`/api/vendor/orders/${order.subOrders[0].id}/status`).set(b.auth).send({ status: 'PACKED' });
    expect(res.status).toBe(404);
  });

  it('vendor cancellation restores stock and refunds the customer', async () => {
    const v = await vendorWithProduct({ stock: 5, price: 40_000 });
    const { order } = await paidOrder([{ productId: v.product.id, quantity: 2 }]);
    expect(await stockOf(v.product.id)).toBe(3);

    const res = await api().patch(`/api/vendor/orders/${order.subOrders[0].id}/status`).set(v.auth).send({ status: 'CANCELLED', reason: 'Item damaged in warehouse' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(await stockOf(v.product.id)).toBe(5);

    const sub = await prisma.subOrder.findUniqueOrThrow({ where: { id: order.subOrders[0].id }, include: { refundRequests: true } });
    expect(sub.refundedAmount).toBe(80_000);
    expect(sub.refundRequests).toEqual([expect.objectContaining({ status: 'APPROVED', amount: 80_000 })]);
    expect(sub.refundRequests[0].providerRefundId).toMatch(/^mock_rfnd_/);
  });
});

describe('customer cancellation & refund requests', () => {
  it('customer can cancel an unshipped sub-order; other sub-orders are unaffected', async () => {
    const a = await vendorWithProduct({ stock: 3 });
    const b = await vendorWithProduct({ stock: 3 });
    const { customer, order } = await paidOrder([{ productId: a.product.id }, { productId: b.product.id }]);
    const subA = order.subOrders.find((s) => s.vendorId === a.vendor.id)!;

    const res = await api().post(`/api/orders/${order.id}/sub-orders/${subA.id}/cancel`).set(customer.auth).send({ reason: 'Ordered by mistake' });
    expect(res.status).toBe(200);
    const statuses = Object.fromEntries(res.body.subOrders.map((s: { vendorId: string; status: string }) => [s.vendorId, s.status]));
    expect(statuses).toEqual({ [a.vendor.id]: 'CANCELLED', [b.vendor.id]: 'PLACED' });
    expect(await stockOf(a.product.id)).toBe(3);
    expect(await stockOf(b.product.id)).toBe(2);
  });

  it('cannot cancel once shipped, but can then request a refund (once)', async () => {
    const v = await vendorWithProduct();
    const { customer, order } = await paidOrder([{ productId: v.product.id }]);
    const subId = order.subOrders[0].id;
    await api().patch(`/api/vendor/orders/${subId}/status`).set(v.auth).send({ status: 'PACKED' });

    // Refund request before shipping is rejected (cancel instead).
    const early = await api().post(`/api/orders/${order.id}/sub-orders/${subId}/refund-requests`).set(customer.auth).send({ reason: 'Please refund me now' });
    expect(early.status).toBe(409);

    await api().patch(`/api/vendor/orders/${subId}/status`).set(v.auth).send({ status: 'SHIPPED', trackingNumber: 'BD99887766' });
    const cancel = await api().post(`/api/orders/${order.id}/sub-orders/${subId}/cancel`).set(customer.auth).send({});
    expect(cancel.status).toBe(409);

    const ok = await api().post(`/api/orders/${order.id}/sub-orders/${subId}/refund-requests`).set(customer.auth).send({ reason: 'Package arrived damaged' });
    expect(ok.status).toBe(201);
    const sub = ok.body.subOrders[0];
    expect(sub.refundRequests[0]).toMatchObject({ status: 'REQUESTED', amount: sub.subtotal });

    const dup = await api().post(`/api/orders/${order.id}/sub-orders/${subId}/refund-requests`).set(customer.auth).send({ reason: 'Package arrived damaged' });
    expect(dup.status).toBe(409);
  });

  it('enforces the return window after delivery', async () => {
    const v = await vendorWithProduct();
    const { customer, order } = await paidOrder([{ productId: v.product.id }]);
    const subId = order.subOrders[0].id;
    await prisma.subOrder.update({ where: { id: subId }, data: { status: 'DELIVERED', deliveredAt: new Date(Date.now() - 30 * 86_400_000) } });
    const res = await api().post(`/api/orders/${order.id}/sub-orders/${subId}/refund-requests`).set(customer.auth).send({ reason: 'Stopped working after a month' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/within 7 days/);
  });

  it('queues a failed automatic refund for admin review', async () => {
    const v = await vendorWithProduct();
    const { customer, order } = await paidOrder([{ productId: v.product.id }]);
    const spy = vi.spyOn(paymentProvider, 'refund').mockRejectedValueOnce(new Error('gateway down'));
    await api().post(`/api/orders/${order.id}/sub-orders/${order.subOrders[0].id}/cancel`).set(customer.auth).send({});
    const rr = await prisma.refundRequest.findFirstOrThrow({ where: { subOrderId: order.subOrders[0].id } });
    expect(rr.status).toBe('REQUESTED');
    expect(rr.adminNote).toMatch(/failed/);
    spy.mockRestore();
  });
});
