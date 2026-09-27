import { hmacSha256Hex } from '../src/services/payments/payment.provider.js';
import { MOCK_KEY_SECRET, MOCK_WEBHOOK_SECRET } from '../src/services/payments/mock.provider.js';
import { api } from './helpers.js';

export function paymentSignature(providerOrderId: string, providerPaymentId: string) {
  return hmacSha256Hex(MOCK_KEY_SECRET, `${providerOrderId}|${providerPaymentId}`);
}

export function webhookBody(event: string, providerOrderId: string, paymentId: string, amount: number, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ event, payload: { payment: { entity: { id: paymentId, order_id: providerOrderId, amount, status: 'captured', ...extra } } } });
}

export function sendWebhook(raw: string, opts: { eventId?: string; signature?: string } = {}) {
  const req = api()
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', opts.signature ?? hmacSha256Hex(MOCK_WEBHOOK_SECRET, raw));
  if (opts.eventId) req.set('x-razorpay-event-id', opts.eventId);
  return req.send(raw);
}

export async function payAndVerify(auth: Record<string, string>, orderId: string, providerOrderId: string, paymentId = `pay_${Date.now()}`) {
  return api().post('/api/payments/verify').set(auth).send({
    orderId, providerOrderId, providerPaymentId: paymentId, signature: paymentSignature(providerOrderId, paymentId),
  });
}

import { addToCart, checkout, createProduct, createUser, createVendor } from './helpers.js';

/** Customer buys products (one line each) and pays; returns the paid order. */
export async function paidOrder(lines: { productId: string; quantity?: number }[], customer?: Awaited<ReturnType<typeof createUser>>) {
  const c = customer ?? (await createUser());
  for (const l of lines) await addToCart(c.auth, l.productId, l.quantity ?? 1);
  const res = await checkout(c.auth);
  if (res.status !== 201) throw new Error(`checkout failed ${res.status} ${JSON.stringify(res.body)}`);
  const v = await payAndVerify(c.auth, res.body.order.id, res.body.payment.providerOrderId, `pay_${Math.random().toString(36).slice(2)}`);
  if (v.status !== 200) throw new Error('payment failed');
  return { customer: c, order: res.body.order as { id: string; subOrders: { id: string; vendorId: string; subtotal: number }[] } };
}

export async function vendorWithProduct(data: { price?: number; stock?: number } = {}) {
  const v = await createVendor();
  const product = await createProduct(v.vendor.id, data);
  return { ...v, product };
}
