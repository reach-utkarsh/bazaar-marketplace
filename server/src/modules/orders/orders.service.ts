import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { closeUnpaidOrder } from './lifecycle.js';
import { orderInclude } from './orders.include.js';

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
