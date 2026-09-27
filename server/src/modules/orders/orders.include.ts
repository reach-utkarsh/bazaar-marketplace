import type { Prisma } from '@prisma/client';

export const subOrderInclude = {
  vendor: { select: { id: true, storeName: true, slug: true } },
  items: { include: { product: { select: { slug: true } } } },
  events: { orderBy: { createdAt: 'asc' } },
  refundRequests: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.SubOrderInclude;

export const orderInclude = {
  subOrders: { include: subOrderInclude, orderBy: { createdAt: 'asc' } },
  payment: { select: { provider: true, status: true, providerOrderId: true, failureReason: true } },
} satisfies Prisma.OrderInclude;
