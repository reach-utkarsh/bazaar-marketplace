import { describe, expect, it, vi } from 'vitest';
import { expireStaleOrders } from '../src/jobs/expireOrders.js';
import { prisma } from '../src/lib/prisma.js';
import { paymentProvider } from '../src/services/payments/index.js';
import { addToCart, api, checkout, createProduct, createUser, createVendor } from './helpers.js';
import { payAndVerify, sendWebhook, webhookBody } from './payment-helpers.js';

async function pendingOrder(opts: { stock?: number; qty?: number } = {}) {
  const customer = await createUser();
  const { vendor } = await createVendor();
  const product = await createProduct(vendor.id, { price: 25_000, stock: opts.stock ?? 10 });
  await addToCart(customer.auth, product.id, opts.qty ?? 1);
  const res = await checkout(customer.auth);
  expect(res.status).toBe(201);
  return { ...customer, product, order: res.body.order, payment: res.body.payment as { providerOrderId: string; amount: number } };
}

const placedEvents = (orderId: string) => prisma.subOrderEvent.count({ where: { subOrder: { orderId }, status: 'PLACED' } });

describe('payment verification', () => {
  it('exposes the active provider publicly without secrets', async () => {
    const res = await api().get('/api/payments/config');
    expect(res.body).toEqual({ provider: 'MOCK', keyId: null });
  });

  it('marks the order PAID only after a valid signature', async () => {
    const { auth, order, payment } = await pendingOrder();
    const res = await payAndVerify(auth, order.id, payment.providerOrderId, 'pay_abc');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'paid', orderId: order.id });
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(saved.paymentStatus).toBe('PAID');
    expect(saved.paidAt).not.toBeNull();
    expect(saved.payment).toMatchObject({ status: 'CAPTURED', providerPaymentId: 'pay_abc' });
  });

  it('rejects a forged signature and leaves the order pending', async () => {
    const { auth, order, payment } = await pendingOrder();
    const res = await api().post('/api/payments/verify').set(auth).send({
      orderId: order.id, providerOrderId: payment.providerOrderId, providerPaymentId: 'pay_x', signature: 'a'.repeat(64) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAYMENT_ERROR');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PENDING');
  });

  it("cannot verify another customer's order", async () => {
    const { order, payment } = await pendingOrder();
    const other = await createUser();
    const res = await payAndVerify(other.auth, order.id, payment.providerOrderId);
    expect(res.status).toBe(404);
  });

  it('verifying twice is idempotent', async () => {
    const { auth, order, payment } = await pendingOrder();
    await payAndVerify(auth, order.id, payment.providerOrderId, 'pay_1');
    const again = await payAndVerify(auth, order.id, payment.providerOrderId, 'pay_1');
    expect(again.body.status).toBe('already_paid');
    expect(await placedEvents(order.id)).toBe(1);
  });
});

describe('webhooks', () => {
  it('rejects webhooks with a bad signature', async () => {
    const { order, payment } = await pendingOrder();
    const raw = webhookBody('payment.captured', payment.providerOrderId, 'pay_w', payment.amount);
    const res = await sendWebhook(raw, { signature: 'f'.repeat(64) });
    expect(res.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PENDING');
  });

  it('processes payment.captured exactly once across replays', async () => {
    const { order, payment } = await pendingOrder();
    const raw = webhookBody('payment.captured', payment.providerOrderId, 'pay_w1', payment.amount);
    const first = await sendWebhook(raw, { eventId: 'evt_1' });
    expect(first.body).toEqual({ status: 'processed', outcome: 'paid' });
    const replay = await sendWebhook(raw, { eventId: 'evt_1' });
    expect(replay.body).toEqual({ status: 'duplicate' });
    // Concurrent duplicate deliveries are also safe.
    await Promise.all([sendWebhook(raw, { eventId: 'evt_2' }), sendWebhook(raw, { eventId: 'evt_3' })]);

    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PAID');
    expect(await placedEvents(order.id)).toBe(1);
    expect(await prisma.webhookEvent.count()).toBe(3);
  });

  it('webhook and browser verification racing produce a single transition', async () => {
    const { auth, order, payment } = await pendingOrder();
    const raw = webhookBody('payment.captured', payment.providerOrderId, 'pay_r', payment.amount);
    await Promise.all([payAndVerify(auth, order.id, payment.providerOrderId, 'pay_r'), sendWebhook(raw, { eventId: 'evt_r' })]);
    expect(await placedEvents(order.id)).toBe(1);
  });

  it('rejects a capture whose amount does not match', async () => {
    const { payment } = await pendingOrder();
    const raw = webhookBody('payment.captured', payment.providerOrderId, 'pay_m', payment.amount - 1);
    expect((await sendWebhook(raw, { eventId: 'evt_m' })).status).toBe(400);
  });

  it('payment.failed keeps the order open for a retry, which can then succeed', async () => {
    const { auth, order, payment, product } = await pendingOrder({ stock: 5, qty: 2 });
    const failed = webhookBody('payment.failed', payment.providerOrderId, 'pay_f', payment.amount, { error_description: 'Card declined', status: 'failed' });
    expect((await sendWebhook(failed, { eventId: 'evt_f' })).body.outcome).toBe('failure_recorded');

    let saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(saved.paymentStatus).toBe('PENDING');
    expect(saved.payment).toMatchObject({ status: 'FAILED', failureReason: 'Card declined' });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(3); // still reserved

    const retry = await api().post(`/api/orders/${order.id}/payment`).set(auth);
    expect(retry.body.providerOrderId).toBe(payment.providerOrderId);
    await payAndVerify(auth, order.id, payment.providerOrderId, 'pay_ok');
    saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(saved.paymentStatus).toBe('PAID');
    expect(saved.payment?.status).toBe('CAPTURED');
  });

  it('ignores unrelated events but records them', async () => {
    const raw = JSON.stringify({ event: 'refund.created', payload: {} });
    const res = await sendWebhook(raw, { eventId: 'evt_other' });
    expect(res.body).toEqual({ status: 'processed', outcome: 'ignored' });
  });
});

describe('unpaid order expiry', () => {
  it('releases stock for stale unpaid orders and refunds a late capture', async () => {
    const { order, payment, product } = await pendingOrder({ stock: 3, qty: 3 });
    await prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(Date.now() - 2 * 60 * 60_000) } });

    expect(await expireStaleOrders()).toBe(1);
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { subOrders: true } });
    expect(saved.paymentStatus).toBe('CANCELLED');
    expect(saved.subOrders[0].status).toBe('CANCELLED');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(3);

    const refund = vi.spyOn(paymentProvider, 'refund');
    const raw = webhookBody('payment.captured', payment.providerOrderId, 'pay_late', payment.amount);
    const res = await sendWebhook(raw, { eventId: 'evt_late' });
    expect(res.body.outcome).toBe('late_capture');
    expect(refund).toHaveBeenCalledWith('pay_late', payment.amount);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('CANCELLED');
    refund.mockRestore();
  });

  it('does not touch recent or paid orders', async () => {
    const { auth, order, payment } = await pendingOrder();
    await pendingOrder();
    await payAndVerify(auth, order.id, payment.providerOrderId);
    await prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(0) } });
    expect(await expireStaleOrders()).toBe(0);
  });
});

describe('mock gateway', () => {
  it('returns a signature that the verify endpoint accepts', async () => {
    const { auth, order } = await pendingOrder();
    const pay = await api().post('/api/payments/mock/pay').set(auth).send({ orderId: order.id, outcome: 'success' });
    expect(pay.body.status).toBe('success');
    const verify = await api().post('/api/payments/verify').set(auth).send({
      orderId: order.id, providerOrderId: pay.body.providerOrderId, providerPaymentId: pay.body.providerPaymentId, signature: pay.body.signature });
    expect(verify.status).toBe(200);
    expect(['paid', 'already_paid']).toContain(verify.body.status);
  });

  it('simulated failure records the failed attempt via the webhook path', async () => {
    const { auth, order } = await pendingOrder();
    const pay = await api().post('/api/payments/mock/pay').set(auth).send({ orderId: order.id, outcome: 'failure' });
    expect(pay.body.status).toBe('failed');
    const saved = await prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(saved.status).toBe('FAILED');
    expect(await prisma.webhookEvent.count({ where: { type: 'payment.failed' } })).toBe(1);
  });
});
