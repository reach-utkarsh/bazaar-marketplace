import { api } from '../lib/api';

export interface GatewayResult {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

/** The server — never the browser — decides whether a payment succeeded. */
export function verifyPayment(orderId: string, r: GatewayResult) {
  const body = { orderId, providerOrderId: r.providerOrderId, providerPaymentId: r.providerPaymentId, signature: r.signature };
  return api<{ status: string; orderId: string }>('/payments/verify', { method: 'POST', body });
}
