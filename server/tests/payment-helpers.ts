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
