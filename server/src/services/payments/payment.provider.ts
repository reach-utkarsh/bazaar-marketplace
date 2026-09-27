import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentProvider as ProviderName } from '@prisma/client';

export interface CreateOrderInput {
  amount: number; // paise
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface PaymentProvider {
  readonly name: ProviderName;
  /** Creates an order on the gateway; the client completes payment against it. */
  createOrder(input: CreateOrderInput): Promise<{ providerOrderId: string }>;
  /** Verifies the signature returned to the client by the checkout widget. */
  verifyPaymentSignature(input: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean;
  /** Verifies the HMAC signature on an incoming webhook (over the raw body). */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean;
  refund(providerPaymentId: string, amount: number): Promise<{ refundId: string }>;
  /** Data safe to expose to the browser. */
  publicConfig(): { provider: ProviderName; keyId: string | null };
}

export function hmacSha256Hex(secret: string, payload: Buffer | string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Constant-time comparison of two hex strings. */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
