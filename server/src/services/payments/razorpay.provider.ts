import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { hmacSha256Hex, safeEqualHex, type CreateOrderInput, type PaymentProvider } from './payment.provider.js';

const API = 'https://api.razorpay.com/v1';

/** Razorpay (TEST mode keys) via its REST API — no SDK dependency needed. */
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'RAZORPAY' as const;

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
  ) {}

  private async request<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
    if (!res.ok) {
      logger.error(`Razorpay ${path} failed (${res.status})`, json);
      throw new AppError(502, 'PAYMENT_ERROR', json.error?.description ?? 'Payment gateway error');
    }
    return json;
  }

  async createOrder(input: CreateOrderInput) {
    const order = await this.request<{ id: string }>('/orders', {
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    });
    return { providerOrderId: order.id };
  }

  verifyPaymentSignature({ providerOrderId, providerPaymentId, signature }: { providerOrderId: string; providerPaymentId: string; signature: string }) {
    const expected = hmacSha256Hex(this.keySecret, `${providerOrderId}|${providerPaymentId}`);
    return safeEqualHex(expected, signature);
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string) {
    if (!this.webhookSecret) {
      logger.warn('RAZORPAY_WEBHOOK_SECRET is not set; rejecting webhook');
      return false;
    }
    return safeEqualHex(hmacSha256Hex(this.webhookSecret, rawBody), signature);
  }

  async refund(providerPaymentId: string, amount: number) {
    const refund = await this.request<{ id: string }>(`/payments/${providerPaymentId}/refund`, { amount });
    return { refundId: refund.id };
  }

  publicConfig() {
    return { provider: this.name, keyId: this.keyId };
  }
}
