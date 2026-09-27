import { Prisma } from '@prisma/client';
import { isTestEnv } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { emails } from '../../services/email/templates.js';
import { mockProvider, paymentProvider } from '../../services/payments/index.js';

type ConfirmResult =
  | { status: 'paid'; orderId: string }
  | { status: 'already_paid'; orderId: string }
  | { status: 'late_capture'; orderId: string };

/**
 * Marks an order paid. Idempotent: the PENDING → PAID transition is a compare-and-swap,
 * so the verify endpoint and one or more webhook deliveries can all race safely.
 */
export async function confirmPayment(input: { providerOrderId: string; providerPaymentId: string; amount?: number }): Promise<ConfirmResult> {
  const result = await prisma.$transaction(async (tx): Promise<ConfirmResult & { amount: number }> => {
    const payment = await tx.payment.findUnique({ where: { providerOrderId: input.providerOrderId } });
    if (!payment) throw AppError.notFound('Payment');
    if (input.amount !== undefined && input.amount !== payment.amount) {
      throw AppError.badRequest(`Captured amount ${input.amount} does not match order amount ${payment.amount}`);
    }

    const { count } = await tx.order.updateMany({
      where: { id: payment.orderId, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'PAID', paidAt: new Date() },
    });
    if (count === 0) {
      const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
      if (order.paymentStatus === 'PAID') return { status: 'already_paid', orderId: order.id, amount: payment.amount };
      // The order was closed (expired/cancelled) and its stock released before the capture arrived.
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'CAPTURED', providerPaymentId: input.providerPaymentId, failureReason: 'Captured after the order was closed — refunded automatically' },
      });
      return { status: 'late_capture', orderId: order.id, amount: payment.amount };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'CAPTURED', providerPaymentId: input.providerPaymentId, failureReason: null },
    });
    const subOrders = await tx.subOrder.findMany({ where: { orderId: payment.orderId }, select: { id: true } });
    await tx.subOrderEvent.createMany({
      data: subOrders.map((s) => ({ subOrderId: s.id, status: 'PLACED' as const, note: 'Payment confirmed — order placed' })),
    });
    return { status: 'paid', orderId: payment.orderId, amount: payment.amount };
  });

  if (result.status === 'late_capture') {
    logger.warn(`Late capture for closed order ${result.orderId}; issuing refund`);
    await paymentProvider.refund(input.providerPaymentId, result.amount).catch((err) => logger.error('Late-capture refund failed', err));
  }
  if (result.status === 'paid') void notifyOrderPaid(result.orderId);
  return { status: result.status, orderId: result.orderId };
}

async function notifyOrderPaid(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, subOrders: { include: { vendor: { include: { user: true } } } } },
  });
  if (!order) return;
  emails.orderConfirmed(order.customer.email, order.id, order.totalAmount);
  for (const s of order.subOrders) emails.vendorNewOrder(s.vendor.user.email, s.id, s.subtotal);
}

/**
 * Records a failed attempt. The order stays PENDING with its stock reserved so the customer
 * can retry (Razorpay allows multiple attempts per order); the expiry job closes it later.
 */
export async function recordPaymentFailure(providerOrderId: string, reason: string) {
  await prisma.payment.updateMany({
    where: { providerOrderId, status: { not: 'CAPTURED' } },
    data: { status: 'FAILED', failureReason: reason.slice(0, 500) },
  });
}

/** Browser callback after checkout: trust nothing until the HMAC signature verifies. */
export async function verifyPayment(
  customerId: string,
  input: { orderId: string; providerOrderId: string; providerPaymentId: string; signature: string },
) {
  const payment = await prisma.payment.findUnique({ where: { providerOrderId: input.providerOrderId }, include: { order: true } });
  if (!payment || payment.order.customerId !== customerId || payment.orderId !== input.orderId) throw AppError.notFound('Payment');

  const ok = paymentProvider.verifyPaymentSignature({
    providerOrderId: input.providerOrderId,
    providerPaymentId: input.providerPaymentId,
    signature: input.signature,
  });
  if (!ok) {
    logger.warn(`Invalid payment signature for order ${payment.orderId}`);
    throw new AppError(400, 'PAYMENT_ERROR', 'Payment verification failed');
  }
  const result = await confirmPayment({ providerOrderId: input.providerOrderId, providerPaymentId: input.providerPaymentId });
  if (result.status === 'late_capture') {
    throw AppError.invalidState('This order had already expired. Your payment has been refunded.');
  }
  return result;
}

// ---------------- Webhooks ----------------

export interface WebhookBody {
  event: string;
  payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; status?: string; error_description?: string | null } } };
}

/**
 * Handles a signed gateway webhook exactly once per event id. Processing is itself
 * idempotent (see confirmPayment), and the WebhookEvent ledger skips replays.
 */
export async function handleWebhook(rawBody: Buffer | string, signature: string | undefined, eventIdHeader: string | undefined, body: WebhookBody) {
  if (!signature || !paymentProvider.verifyWebhookSignature(rawBody, signature)) {
    throw new AppError(400, 'PAYMENT_ERROR', 'Invalid webhook signature');
  }
  const entity = body.payload?.payment?.entity;
  const eventId = eventIdHeader || `${body.event}:${entity?.id ?? 'unknown'}`;

  if (await prisma.webhookEvent.findUnique({ where: { eventId } })) {
    return { status: 'duplicate' as const };
  }

  let outcome = 'ignored';
  if (entity && (body.event === 'payment.captured' || body.event === 'order.paid')) {
    outcome = (await confirmPayment({ providerOrderId: entity.order_id, providerPaymentId: entity.id, amount: entity.amount })).status;
  } else if (entity && body.event === 'payment.failed') {
    await recordPaymentFailure(entity.order_id, entity.error_description ?? 'Payment failed');
    outcome = 'failure_recorded';
  }

  try {
    await prisma.webhookEvent.create({
      data: { eventId, provider: paymentProvider.name, type: body.event, payload: body as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    // A concurrent delivery of the same event recorded it first — processing was idempotent anyway.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    return { status: 'duplicate' as const };
  }
  return { status: 'processed' as const, outcome };
}

// ---------------- Mock gateway (only when Razorpay keys are absent) ----------------

/**
 * ⚠️ MOCK ONLY. Simulates the hosted checkout: on success it returns exactly what Razorpay's
 * widget returns to the browser (ids + HMAC signature), which the client must still send to
 * /payments/verify. It also emits the corresponding signed webhook, like a real gateway.
 */
export async function mockPay(customerId: string, orderId: string, outcome: 'success' | 'failure') {
  if (!mockProvider) throw AppError.notFound('Mock gateway');
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId }, include: { payment: true } });
  if (!order?.payment) throw AppError.notFound('Order');
  if (order.paymentStatus !== 'PENDING') throw AppError.invalidState('This order is not awaiting payment');
  const providerOrderId = order.payment.providerOrderId;

  if (outcome === 'failure') {
    const failedId = `mock_pay_failed_${Date.now()}`;
    await deliverMockWebhook({
      event: 'payment.failed',
      payload: { payment: { entity: { id: failedId, order_id: providerOrderId, amount: order.totalAmount, status: 'failed', error_description: 'Card declined by issuing bank (simulated)' } } },
    });
    return { status: 'failed' as const, reason: 'Card declined by issuing bank (simulated)' };
  }

  const { providerPaymentId, signature } = mockProvider.simulateSuccess(providerOrderId);
  // The gateway's server-to-server webhook arrives independently of the browser callback.
  const delivery = deliverMockWebhook({
    event: 'payment.captured',
    payload: { payment: { entity: { id: providerPaymentId, order_id: providerOrderId, amount: order.totalAmount, status: 'captured' } } },
  }).catch((err) => logger.error('Mock webhook delivery failed', err));
  if (isTestEnv) await delivery; // deterministic ordering under test
  return { status: 'success' as const, providerOrderId, providerPaymentId, signature };
}

async function deliverMockWebhook(body: WebhookBody) {
  if (!mockProvider) return;
  const raw = JSON.stringify(body);
  const eventId = `mock_evt_${body.event}_${body.payload?.payment?.entity?.id}`;
  await handleWebhook(raw, mockProvider.signWebhook(raw), eventId, body);
}
