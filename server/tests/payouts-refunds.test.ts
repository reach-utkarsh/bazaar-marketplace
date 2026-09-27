import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { paymentProvider } from '../src/services/payments/index.js';
import { api, createUser } from './helpers.js';
import { paidOrder, vendorWithProduct } from './payment-helpers.js';

const DAY = 86_400_000;

async function deliver(subOrderId: string, daysAgo: number) {
  await prisma.subOrder.update({ where: { id: subOrderId }, data: { status: 'DELIVERED', deliveredAt: new Date(Date.now() - daysAgo * DAY) } });
}

describe('payouts', () => {
  it('pays out only delivered sub-orders past the return window, one batch per vendor', async () => {
    const admin = await createUser('ADMIN');
    const a = await vendorWithProduct({ price: 100_000 });
    const b = await vendorWithProduct({ price: 30_000 });
    const o1 = await paidOrder([{ productId: a.product.id }, { productId: b.product.id }]);
    const o2 = await paidOrder([{ productId: a.product.id }]);
    const o3 = await paidOrder([{ productId: a.product.id }]); // still in return window
    await paidOrder([{ productId: a.product.id }]); // not delivered

    for (const s of o1.order.subOrders) await deliver(s.id, 10);
    await deliver(o2.order.subOrders[0].id, 8);
    await deliver(o3.order.subOrders[0].id, 2);

    const preview = await api().get('/api/admin/payouts').set(admin.auth);
    expect(preview.body.eligible).toEqual([
      expect.objectContaining({ vendorId: a.vendor.id, amount: 180_000, subOrderCount: 2 }),
      expect.objectContaining({ vendorId: b.vendor.id, amount: 27_000, subOrderCount: 1 }),
    ]);

    const gen = await api().post('/api/admin/payouts/generate').set(admin.auth);
    expect(gen.status).toBe(201);
    expect(gen.body.created).toHaveLength(2);
    const payoutA = gen.body.created.find((p: { vendorId: string }) => p.vendorId === a.vendor.id);
    expect(payoutA).toMatchObject({ amount: 180_000, status: 'PENDING' });

    // Running again creates nothing — sub-orders can never be paid twice.
    const again = await api().post('/api/admin/payouts/generate').set(admin.auth);
    expect(again.body.created).toHaveLength(0);

    const summary = await api().get('/api/vendor/payouts').set(a.auth);
    expect(summary.body.summary).toMatchObject({ pendingPayout: 180_000, paidOut: 0, availableForPayout: 0, inReturnWindow: 90_000, inProgress: 90_000 });

    const paid = await api().post(`/api/admin/payouts/${payoutA.id}/mark-paid`).set(admin.auth).send({ reference: 'NEFT-001' });
    expect(paid.body).toMatchObject({ status: 'PAID', reference: 'NEFT-001' });
    expect((await api().post(`/api/admin/payouts/${payoutA.id}/mark-paid`).set(admin.auth).send({})).status).toBe(409);

    const after = await api().get('/api/vendor/payouts').set(a.auth);
    expect(after.body.summary).toMatchObject({ paidOut: 180_000, pendingPayout: 0, lifetimeEarnings: 270_000 });
    expect(after.body.payouts[0]).toMatchObject({ status: 'PAID', amount: 180_000 });
  });

  it('excludes refunded sub-orders and those with an open refund request', async () => {
    const admin = await createUser('ADMIN');
    const v = await vendorWithProduct({ price: 10_000 });
    const refunded = await paidOrder([{ productId: v.product.id }]);
    const disputed = await paidOrder([{ productId: v.product.id }]);
    for (const o of [refunded, disputed]) await deliver(o.order.subOrders[0].id, 10);
    await prisma.subOrder.update({ where: { id: refunded.order.subOrders[0].id }, data: { refundedAmount: 10_000 } });
    await prisma.refundRequest.create({ data: { subOrderId: disputed.order.subOrders[0].id, customerId: disputed.customer.user.id, reason: 'Broken on arrival', amount: 10_000 } });

    const gen = await api().post('/api/admin/payouts/generate').set(admin.auth);
    expect(gen.body.created).toHaveLength(0);
  });
});

describe('admin refund handling', () => {
  async function refundRequest() {
    const v = await vendorWithProduct({ price: 45_000 });
    const { customer, order } = await paidOrder([{ productId: v.product.id }]);
    const subId = order.subOrders[0].id;
    await api().patch(`/api/vendor/orders/${subId}/status`).set(v.auth).send({ status: 'PACKED' });
    await api().patch(`/api/vendor/orders/${subId}/status`).set(v.auth).send({ status: 'SHIPPED', trackingNumber: 'XP123456' });
    await api().patch(`/api/vendor/orders/${subId}/status`).set(v.auth).send({ status: 'DELIVERED' });
    await api().post(`/api/orders/${order.id}/sub-orders/${subId}/refund-requests`).set(customer.auth).send({ reason: 'Wrong colour delivered' });
    const rr = await prisma.refundRequest.findFirstOrThrow({ where: { subOrderId: subId } });
    return { rr, subId, customer };
  }

  it('approving refunds through the provider exactly once', async () => {
    const admin = await createUser('ADMIN');
    const { rr, subId } = await refundRequest();
    const spy = vi.spyOn(paymentProvider, 'refund');

    const list = await api().get('/api/admin/refunds').query({ status: 'REQUESTED' }).set(admin.auth);
    expect(list.body.items[0]).toMatchObject({ id: rr.id, amount: 45_000, reason: 'Wrong colour delivered' });

    const [a, b] = await Promise.all([
      api().post(`/api/admin/refunds/${rr.id}/approve`).set(admin.auth).send({ note: 'Sorry about that' }),
      api().post(`/api/admin/refunds/${rr.id}/approve`).set(admin.auth).send({ note: 'Sorry about that' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(spy).toHaveBeenCalledTimes(1);
    const sub = await prisma.subOrder.findUniqueOrThrow({ where: { id: subId } });
    expect(sub.refundedAmount).toBe(45_000);
    const saved = await prisma.refundRequest.findUniqueOrThrow({ where: { id: rr.id } });
    expect(saved).toMatchObject({ status: 'APPROVED', adminNote: 'Sorry about that' });
    expect(saved.providerRefundId).toMatch(/^mock_rfnd_/);
    spy.mockRestore();
  });

  it('reverts if the gateway refund fails', async () => {
    const admin = await createUser('ADMIN');
    const { rr, subId } = await refundRequest();
    const spy = vi.spyOn(paymentProvider, 'refund').mockRejectedValueOnce(new Error('gateway timeout'));
    const res = await api().post(`/api/admin/refunds/${rr.id}/approve`).set(admin.auth).send({});
    expect(res.status).toBe(502);
    expect((await prisma.refundRequest.findUniqueOrThrow({ where: { id: rr.id } })).status).toBe('REQUESTED');
    expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: subId } })).refundedAmount).toBe(0);
    spy.mockRestore();
  });

  it('rejecting requires a note', async () => {
    const admin = await createUser('ADMIN');
    const { rr } = await refundRequest();
    expect((await api().post(`/api/admin/refunds/${rr.id}/reject`).set(admin.auth).send({})).status).toBe(400);
    const res = await api().post(`/api/admin/refunds/${rr.id}/reject`).set(admin.auth).send({ note: 'Photos show the item as described' });
    expect(res.body.status).toBe('REJECTED');
    expect((await api().post(`/api/admin/refunds/${rr.id}/approve`).set(admin.auth).send({})).status).toBe(409);
  });
});
