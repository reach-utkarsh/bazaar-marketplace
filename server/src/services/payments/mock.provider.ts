import { randomBytes } from 'node:crypto';
import { hmacSha256Hex, safeEqualHex, type CreateOrderInput, type PaymentProvider } from './payment.provider.js';

/**
 * ⚠️ MOCK PAYMENT PROVIDER — used automatically when Razorpay keys are not configured.
 * It mirrors Razorpay's contract exactly (order ids, HMAC signatures, webhooks) so the
 * server-side verification path is identical; only the "gateway" is simulated in-process.
 */
export const MOCK_KEY_SECRET = 'mock_key_secret_not_for_production';
export const MOCK_WEBHOOK_SECRET = 'mock_webhook_secret_not_for_production';

const id = (prefix: string) => `${prefix}_${randomBytes(7).toString('hex')}`;

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK' as const;

  async createOrder(_input: CreateOrderInput) {
    return { providerOrderId: id('mock_order') };
  }

  /** Simulates what the gateway returns to the browser after a successful payment. */
  simulateSuccess(providerOrderId: string) {
    const providerPaymentId = id('mock_pay');
    const signature = hmacSha256Hex(MOCK_KEY_SECRET, `${providerOrderId}|${providerPaymentId}`);
    return { providerPaymentId, signature };
  }

  signWebhook(rawBody: string) {
    return hmacSha256Hex(MOCK_WEBHOOK_SECRET, rawBody);
  }

  verifyPaymentSignature({ providerOrderId, providerPaymentId, signature }: { providerOrderId: string; providerPaymentId: string; signature: string }) {
    return safeEqualHex(hmacSha256Hex(MOCK_KEY_SECRET, `${providerOrderId}|${providerPaymentId}`), signature);
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string) {
    return safeEqualHex(hmacSha256Hex(MOCK_WEBHOOK_SECRET, rawBody), signature);
  }

  async refund(_providerPaymentId: string, _amount: number) {
    return { refundId: id('mock_rfnd') };
  }

  publicConfig() {
    return { provider: this.name, keyId: null };
  }
}
