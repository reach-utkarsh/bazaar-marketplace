import type { Prisma, RefundStatus } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { pageResult, paginate } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { emails } from '../../services/email/templates.js';
import { paymentProvider } from '../../services/payments/index.js';

const include = {
  customer: { select: { id: true, name: true, email: true } },
  subOrder: {
    select: {
      id: true, orderId: true, status: true, subtotal: true, refundedAmount: true, deliveredAt: true,
      vendor: { select: { id: true, storeName: true } },
      items: { select: { id: true, productTitle: true, quantity: true, lineTotal: true } },
    },
  },
} satisfies Prisma.RefundRequestInclude;

export async function listRefunds(q: { status?: RefundStatus; page: number; limit: number }) {
  const where: Prisma.RefundRequestWhereInput = q.status ? { status: q.status } : {};
  const [items, total] = await prisma.$transaction([
    prisma.refundRequest.findMany({ where, include, orderBy: [{ status: 'desc' }, { createdAt: 'desc' }], ...paginate(q.page, q.limit) }),
    prisma.refundRequest.count({ where }),
  ]);
  return pageResult(items, total, q.page, q.limit);
}

/**
 * Approves a refund. The REQUESTED → APPROVED flip and the refundedAmount increment are
 * committed first (CAS, so a double-click can't refund twice); if the gateway call then
 * fails, both are rolled back so the request can be retried.
 */
export async function approveRefund(id: string, note?: string) {
  const request = await prisma.refundRequest.findUnique({ where: { id }, include: { subOrder: { include: { order: { include: { payment: true } } } } } });
  if (!request) throw AppError.notFound('Refund request');
  if (request.status !== 'REQUESTED') throw AppError.invalidState('This request has already been resolved');
  const remaining = request.subOrder.subtotal - request.subOrder.refundedAmount;
  const amount = Math.min(request.amount, remaining);
  if (amount <= 0) throw AppError.invalidState('Nothing left to refund on this shipment');
  const paymentId = request.subOrder.order.payment?.providerPaymentId;
  if (!paymentId) throw AppError.invalidState('No captured payment found for this order');

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.refundRequest.updateMany({
      where: { id, status: 'REQUESTED' },
      data: { status: 'APPROVED', amount, adminNote: note ?? request.adminNote, resolvedAt: new Date() },
    });
    if (count === 0) throw AppError.invalidState('This request has already been resolved');
    await tx.subOrder.update({ where: { id: request.subOrderId }, data: { refundedAmount: { increment: amount } } });
  });

  try {
    const { refundId } = await paymentProvider.refund(paymentId, amount);
    await prisma.refundRequest.update({ where: { id }, data: { providerRefundId: refundId } });
  } catch (err) {
    logger.error(`Refund ${id} failed at the gateway; reverting`, err);
    await prisma.$transaction([
      prisma.refundRequest.update({ where: { id }, data: { status: 'REQUESTED', resolvedAt: null, adminNote: 'Gateway refund failed — please retry' } }),
      prisma.subOrder.update({ where: { id: request.subOrderId }, data: { refundedAmount: { decrement: amount } } }),
    ]);
    throw new AppError(502, 'PAYMENT_ERROR', 'The payment gateway rejected the refund. Please try again.');
  }

  const customer = await prisma.user.findUnique({ where: { id: request.customerId }, select: { email: true } });
  if (customer) emails.refundIssued(customer.email, request.subOrderId, amount);
  return prisma.refundRequest.findUniqueOrThrow({ where: { id }, include });
}

export async function rejectRefund(id: string, note: string) {
  const { count } = await prisma.refundRequest.updateMany({ where: { id, status: 'REQUESTED' }, data: { status: 'REJECTED', adminNote: note, resolvedAt: new Date() } });
  if (count === 0) {
    if (!(await prisma.refundRequest.findUnique({ where: { id } }))) throw AppError.notFound('Refund request');
    throw AppError.invalidState('This request has already been resolved');
  }
  const request = await prisma.refundRequest.findUniqueOrThrow({ where: { id }, include });
  emails.refundRejected(request.customer.email, request.subOrderId, note);
  return request;
}
