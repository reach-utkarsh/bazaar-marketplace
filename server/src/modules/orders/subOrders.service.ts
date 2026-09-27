import type { SubOrderStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { emails } from '../../services/email/templates.js';
import { paymentProvider } from '../../services/payments/index.js';
import { restoreStock } from './inventory.js';

/** Allowed forward transitions. CANCELLED is only reachable before shipping. */
export const TRANSITIONS: Record<SubOrderStatus, SubOrderStatus[]> = {
  PLACED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const CANCELLABLE: SubOrderStatus[] = ['PLACED', 'PACKED'];

const timestampField: Partial<Record<SubOrderStatus, 'packedAt' | 'shippedAt' | 'deliveredAt'>> = {
  PACKED: 'packedAt',
  SHIPPED: 'shippedAt',
  DELIVERED: 'deliveredAt',
};

/** Vendor moves a paid sub-order forward (PLACED → PACKED → SHIPPED → DELIVERED). */
export async function advanceSubOrder(
  vendorId: string,
  subOrderId: string,
  to: Exclude<SubOrderStatus, 'PLACED' | 'CANCELLED'>,
  opts: { trackingNumber?: string; carrier?: string; note?: string } = {},
) {
  const sub = await prisma.subOrder.findFirst({
    where: { id: subOrderId, vendorId },
    include: { order: { select: { paymentStatus: true, customer: { select: { email: true } } } } },
  });
  if (!sub) throw AppError.notFound('Order');
  if (sub.order.paymentStatus !== 'PAID') throw AppError.invalidState('This order has not been paid');
  if (!TRANSITIONS[sub.status].includes(to)) {
    throw AppError.invalidState(`Cannot move an order from ${sub.status} to ${to}`);
  }
  if (to === 'SHIPPED' && !opts.trackingNumber) throw AppError.badRequest('A tracking number is required to mark as shipped');

  await prisma.$transaction(async (tx) => {
    // Compare-and-swap on the current status guards against double-clicks / concurrent updates.
    const { count } = await tx.subOrder.updateMany({
      where: { id: subOrderId, status: sub.status },
      data: {
        status: to,
        [timestampField[to]!]: new Date(),
        ...(to === 'SHIPPED' ? { trackingNumber: opts.trackingNumber, carrier: opts.carrier ?? null } : {}),
      },
    });
    if (count === 0) throw AppError.invalidState('Order status changed, please refresh');
    await tx.subOrderEvent.create({
      data: {
        subOrderId,
        status: to,
        note: opts.note ?? (to === 'SHIPPED' ? `Shipped via ${opts.carrier ?? 'courier'} · tracking ${opts.trackingNumber}` : null),
      },
    });
  });

  emails.subOrderStatusChanged(sub.order.customer.email, subOrderId, to,
    to === 'SHIPPED' ? `Tracking number: ${opts.trackingNumber}${opts.carrier ? ` (${opts.carrier})` : ''}` : undefined);
}

/**
 * Cancels a paid sub-order that has not shipped yet (customer or vendor initiated):
 * status CAS → CANCELLED, stock restored in the same transaction, then the sub-order
 * amount is refunded through the payment provider.
 */
export async function cancelSubOrder(
  subOrderId: string,
  scope: { customerId?: string; vendorId?: string },
  reason: string,
) {
  const sub = await prisma.subOrder.findFirst({
    where: { id: subOrderId, ...(scope.vendorId ? { vendorId: scope.vendorId } : {}), ...(scope.customerId ? { order: { customerId: scope.customerId } } : {}) },
    include: { items: true, order: { include: { payment: true, customer: { select: { id: true, email: true } } } } },
  });
  if (!sub) throw AppError.notFound('Order');
  if (sub.order.paymentStatus !== 'PAID') throw AppError.invalidState('Only paid orders can be cancelled here');
  if (!CANCELLABLE.includes(sub.status)) throw AppError.invalidState('This shipment has already been dispatched and can no longer be cancelled');

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.subOrder.updateMany({
      where: { id: subOrderId, status: { in: CANCELLABLE } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
    });
    if (count === 0) throw AppError.invalidState('Order status changed, please refresh');
    await tx.subOrderEvent.create({ data: { subOrderId, status: 'CANCELLED', note: reason } });
    await restoreStock(tx, sub.items);
  });

  const amount = sub.subtotal - sub.refundedAmount;
  if (amount > 0) await refundSubOrder(sub.id, sub.order.customer.id, sub.order.payment?.providerPaymentId ?? null, amount, `Automatic refund: ${reason}`);
  emails.subOrderStatusChanged(sub.order.customer.email, subOrderId, 'CANCELLED', reason);
}

/**
 * Issues a refund for a sub-order and records it as an (auto-approved) RefundRequest.
 * If the gateway call fails the request stays REQUESTED so an admin can retry it.
 */
export async function refundSubOrder(subOrderId: string, customerId: string, providerPaymentId: string | null, amount: number, reason: string) {
  try {
    if (!providerPaymentId) throw new Error('No captured payment id on record');
    const { refundId } = await paymentProvider.refund(providerPaymentId, amount);
    await prisma.$transaction([
      prisma.refundRequest.create({
        data: { subOrderId, customerId, reason, amount, status: 'APPROVED', providerRefundId: refundId, resolvedAt: new Date(), adminNote: 'Refunded automatically on cancellation' },
      }),
      prisma.subOrder.update({ where: { id: subOrderId }, data: { refundedAmount: { increment: amount } } }),
    ]);
    const customer = await prisma.user.findUnique({ where: { id: customerId }, select: { email: true } });
    if (customer) emails.refundIssued(customer.email, subOrderId, amount);
  } catch (err) {
    logger.error(`Automatic refund for sub-order ${subOrderId} failed; queued for admin review`, err);
    await prisma.refundRequest.create({
      data: { subOrderId, customerId, reason, amount, status: 'REQUESTED', adminNote: 'Automatic refund failed — please retry' },
    });
  }
}

/** Customer asks for a refund on a shipped/delivered sub-order; an admin decides. */
export async function requestRefund(customerId: string, orderId: string, subOrderId: string, reason: string) {
  const sub = await prisma.subOrder.findFirst({
    where: { id: subOrderId, orderId, order: { customerId } },
    include: { order: true, refundRequests: { where: { status: 'REQUESTED' } } },
  });
  if (!sub) throw AppError.notFound('Order');
  if (sub.order.paymentStatus !== 'PAID') throw AppError.invalidState('This order was not paid');
  if (CANCELLABLE.includes(sub.status)) throw AppError.invalidState('This shipment has not shipped yet — cancel it instead');
  if (sub.status === 'CANCELLED') throw AppError.invalidState('This shipment was cancelled');
  if (sub.status === 'DELIVERED' && sub.deliveredAt) {
    const windowEnds = sub.deliveredAt.getTime() + env.RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() > windowEnds) throw AppError.invalidState(`Refunds can be requested within ${env.RETURN_WINDOW_DAYS} days of delivery`);
  }
  if (sub.refundRequests.length) throw AppError.conflict('A refund request for this shipment is already under review');
  const amount = sub.subtotal - sub.refundedAmount;
  if (amount <= 0) throw AppError.invalidState('This shipment has already been fully refunded');

  await prisma.refundRequest.create({ data: { subOrderId, customerId, reason, amount } });
}
