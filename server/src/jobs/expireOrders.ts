import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { closeUnpaidOrder } from '../modules/orders/lifecycle.js';

/** Releases stock held by orders that were never paid within PAYMENT_EXPIRY_MINUTES. */
export async function expireStaleOrders(now = new Date()) {
  const cutoff = new Date(now.getTime() - env.PAYMENT_EXPIRY_MINUTES * 60_000);
  const stale = await prisma.order.findMany({
    where: { paymentStatus: 'PENDING', createdAt: { lt: cutoff } },
    select: { id: true, payment: { select: { status: true } } },
    take: 100,
  });
  let expired = 0;
  for (const o of stale) {
    const failed = o.payment?.status === 'FAILED';
    const closed = await closeUnpaidOrder(o.id, failed ? 'FAILED' : 'CANCELLED', failed ? 'Payment failed' : 'Payment window expired');
    if (closed) expired++;
  }
  if (expired) logger.info(`Expired ${expired} unpaid order(s) and released their stock`);
  return expired;
}

export function startOrderExpiryJob(intervalMs = 60_000) {
  const timer = setInterval(() => {
    expireStaleOrders().catch((err) => logger.error('Order expiry job failed', err));
  }, intervalMs);
  timer.unref();
  return timer;
}
