import type { PaymentStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { restoreStock } from './inventory.js';

/**
 * Closes an unpaid order (customer cancel, payment could not start, or reservation expiry):
 * compare-and-swap PENDING → `status`, cancel every sub-order and release reserved stock.
 * Returns false if the order was no longer pending (e.g. it was paid concurrently).
 */
export async function closeUnpaidOrder(orderId: string, status: Extract<PaymentStatus, 'CANCELLED' | 'FAILED'>, reason: string) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({ where: { id: orderId, paymentStatus: 'PENDING' }, data: { paymentStatus: status } });
    if (count === 0) return false;
    const subOrders = await tx.subOrder.findMany({ where: { orderId }, include: { items: true } });
    const now = new Date();
    await tx.subOrder.updateMany({ where: { orderId }, data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason } });
    await tx.subOrderEvent.createMany({ data: subOrders.map((s) => ({ subOrderId: s.id, status: 'CANCELLED' as const, note: reason })) });
    await restoreStock(tx, subOrders.flatMap((s) => s.items));
    return true;
  });
}
