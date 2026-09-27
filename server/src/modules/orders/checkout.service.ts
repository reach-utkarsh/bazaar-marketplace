import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { commissionFor } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { paymentProvider } from '../../services/payments/index.js';
import { getCommissionBps } from '../settings/settings.service.js';
import { reserveStock } from './inventory.js';
import { closeUnpaidOrder } from './lifecycle.js';
import { orderInclude } from './orders.include.js';

export interface ShippingAddress {
  shippingName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2?: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
}

export function paymentInit(order: { id: string; totalAmount: number; currency: string }, providerOrderId: string) {
  const cfg = paymentProvider.publicConfig();
  return { provider: cfg.provider, keyId: cfg.keyId, providerOrderId, amount: order.totalAmount, currency: order.currency, orderId: order.id };
}

/**
 * Turns the customer's cart into one Order with a SubOrder per vendor.
 * Stock is reserved in the same transaction; the payment-gateway order is created
 * afterwards (network calls must not hold row locks).
 */
export async function checkout(customerId: string, address: ShippingAddress) {
  const order = await prisma.$transaction(async (tx) => {
    const cart = await tx.cartItem.findMany({
      where: { userId: customerId },
      include: { product: { include: { vendor: { select: { id: true, status: true } }, images: { orderBy: { position: 'asc' }, take: 1 } } } },
    });
    if (cart.length === 0) throw AppError.badRequest('Your cart is empty');

    const unavailable = cart.filter((i) => !i.product.isActive || i.product.vendor.status !== 'APPROVED');
    if (unavailable.length) {
      throw AppError.conflict('Some items in your cart are no longer available', { productIds: unavailable.map((i) => i.productId) });
    }

    await reserveStock(tx, cart);

    const rateBps = await getCommissionBps(tx);
    const byVendor = new Map<string, typeof cart>();
    for (const item of cart) byVendor.set(item.product.vendorId, [...(byVendor.get(item.product.vendorId) ?? []), item]);

    const subOrders = [...byVendor.entries()].map(([vendorId, items]) => {
      const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const commissionAmount = commissionFor(subtotal, rateBps);
      return {
        vendorId,
        subtotal,
        commissionRateBps: rateBps,
        commissionAmount,
        vendorEarnings: subtotal - commissionAmount,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            productTitle: i.product.title,
            imageUrl: i.product.images[0]?.url ?? null,
            unitPrice: i.product.price,
            quantity: i.quantity,
            lineTotal: i.product.price * i.quantity,
          })),
        },
      };
    });
    const totalAmount = subOrders.reduce((sum, s) => sum + s.subtotal, 0);

    const created = await tx.order.create({
      data: { customerId, totalAmount, ...address, subOrders: { create: subOrders } },
      include: orderInclude,
    });
    await tx.cartItem.deleteMany({ where: { userId: customerId } });
    return created;
  });

  try {
    const { providerOrderId } = await paymentProvider.createOrder({
      amount: order.totalAmount,
      currency: order.currency,
      receipt: order.id,
      notes: { orderId: order.id },
    });
    await prisma.payment.create({
      data: { orderId: order.id, provider: paymentProvider.name, providerOrderId, amount: order.totalAmount, currency: order.currency },
    });
    return { order, payment: paymentInit(order, providerOrderId) };
  } catch (err) {
    logger.error(`Could not create payment for order ${order.id}; releasing stock`, err);
    await closeUnpaidOrder(order.id, 'FAILED', 'Payment could not be initiated');
    throw err instanceof AppError ? err : new AppError(502, 'PAYMENT_ERROR', 'Could not start payment, please try again');
  }
}

/** Returns checkout data for an order that is still awaiting payment (retry / resume). */
export async function resumePayment(customerId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId }, include: { payment: true } });
  if (!order) throw AppError.notFound('Order');
  if (order.paymentStatus !== 'PENDING') throw AppError.invalidState('This order is not awaiting payment');
  if (order.payment) return paymentInit(order, order.payment.providerOrderId);

  const { providerOrderId } = await paymentProvider.createOrder({ amount: order.totalAmount, currency: order.currency, receipt: order.id });
  await prisma.payment.create({
    data: { orderId: order.id, provider: paymentProvider.name, providerOrderId, amount: order.totalAmount, currency: order.currency },
  });
  return paymentInit(order, providerOrderId);
}
