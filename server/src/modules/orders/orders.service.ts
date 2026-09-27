import { AppError } from '../../lib/errors.js';
import { pageResult, paginate } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { closeUnpaidOrder } from './lifecycle.js';
import { orderInclude } from './orders.include.js';
import * as subOrders from './subOrders.service.js';

export async function listCustomerOrders(customerId: string, page: number, limit: number) {
  const where = { customerId };
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, ...paginate(page, limit) }),
    prisma.order.count({ where }),
  ]);
  return pageResult(items, total, page, limit);
}

export async function getCustomerOrder(customerId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId }, include: orderInclude });
  if (!order) throw AppError.notFound('Order');
  return order;
}

/** Customer abandons an order that has not been paid yet; reserved stock is released. */
export async function cancelUnpaidOrder(customerId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId } });
  if (!order) throw AppError.notFound('Order');
  if (order.paymentStatus !== 'PENDING') throw AppError.invalidState('Only unpaid orders can be cancelled this way');
  const closed = await closeUnpaidOrder(orderId, 'CANCELLED', 'Cancelled by customer before payment');
  if (!closed) throw AppError.invalidState('Order status changed, please refresh');
  return getCustomerOrder(customerId, orderId);
}

export async function cancelSubOrder(customerId: string, orderId: string, subOrderId: string, reason?: string) {
  const owned = await prisma.subOrder.findFirst({ where: { id: subOrderId, orderId, order: { customerId } }, select: { id: true } });
  if (!owned) throw AppError.notFound('Order');
  await subOrders.cancelSubOrder(subOrderId, { customerId }, reason?.trim() || 'Cancelled by customer');
  return getCustomerOrder(customerId, orderId);
}

export async function requestRefund(customerId: string, orderId: string, subOrderId: string, reason: string) {
  await subOrders.requestRefund(customerId, orderId, subOrderId, reason);
  return getCustomerOrder(customerId, orderId);
}
