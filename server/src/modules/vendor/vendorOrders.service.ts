import type { Prisma, SubOrderStatus } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { pageResult, paginate } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { advanceSubOrder, cancelSubOrder } from '../orders/subOrders.service.js';

const include = {
  items: { include: { product: { select: { slug: true } } } },
  events: { orderBy: { createdAt: 'asc' } },
  order: {
    select: {
      id: true, createdAt: true, paidAt: true,
      shippingName: true, shippingPhone: true, shippingLine1: true, shippingLine2: true,
      shippingCity: true, shippingState: true, shippingPostalCode: true, shippingCountry: true,
      customer: { select: { name: true } },
    },
  },
} satisfies Prisma.SubOrderInclude;

/** Vendors only ever see their own sub-orders, and only once the order is paid. */
export async function listVendorOrders(vendorId: string, q: { status?: SubOrderStatus; page: number; limit: number }) {
  const where: Prisma.SubOrderWhereInput = { vendorId, order: { paymentStatus: 'PAID' }, ...(q.status ? { status: q.status } : {}) };
  const [items, total, counts] = await prisma.$transaction([
    prisma.subOrder.findMany({ where, include, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.limit) }),
    prisma.subOrder.count({ where }),
    prisma.subOrder.groupBy({ by: ['status'], where: { vendorId, order: { paymentStatus: 'PAID' } }, _count: { _all: true }, orderBy: { status: 'asc' } }),
  ]);
  const statusCounts = Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all]));
  return { ...pageResult(items, total, q.page, q.limit), statusCounts };
}

export async function getVendorOrder(vendorId: string, id: string) {
  const sub = await prisma.subOrder.findFirst({ where: { id, vendorId, order: { paymentStatus: 'PAID' } }, include });
  if (!sub) throw AppError.notFound('Order');
  return sub;
}

export async function updateStatus(
  vendorId: string,
  id: string,
  body:
    | { status: 'PACKED' | 'DELIVERED'; note?: string }
    | { status: 'SHIPPED'; trackingNumber: string; carrier?: string; note?: string }
    | { status: 'CANCELLED'; reason: string },
) {
  if (body.status === 'CANCELLED') {
    await cancelSubOrder(id, { vendorId }, `Cancelled by seller: ${body.reason}`);
  } else {
    await advanceSubOrder(vendorId, id, body.status, body);
  }
  return getVendorOrder(vendorId, id);
}
