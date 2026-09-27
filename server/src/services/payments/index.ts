import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { MockPaymentProvider } from './mock.provider.js';
import type { PaymentProvider } from './payment.provider.js';
import { RazorpayProvider } from './razorpay.provider.js';

function createProvider(): PaymentProvider {
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    if (!env.RAZORPAY_KEY_ID.startsWith('rzp_test_')) {
      // Guardrail: this project must only ever run against Razorpay TEST mode.
      throw new Error('Only Razorpay TEST keys (rzp_test_…) are allowed in this project.');
    }
    logger.info('💳 Payments: Razorpay (TEST mode)');
    return new RazorpayProvider(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET);
  }
  logger.warn('💳 Payments: MOCK provider (Razorpay keys not configured) — no real money moves');
  return new MockPaymentProvider();
}

export const paymentProvider: PaymentProvider = createProvider();
export const mockProvider = paymentProvider instanceof MockPaymentProvider ? paymentProvider : null;
export type { PaymentProvider } from './payment.provider.js';
