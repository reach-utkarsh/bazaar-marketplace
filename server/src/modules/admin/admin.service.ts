import type { PaymentStatus, Prisma, VendorStatus } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { pageResult, paginate } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { emails } from '../../services/email/templates.js';
import { orderInclude } from '../orders/orders.include.js';

// ---------------- Vendors ----------------

export async function listVendors(q: { status?: VendorStatus; page: number; limit: number }) {
  const where: Prisma.VendorWhereInput = q.status ? { status: q.status } : {};
  const [items, total, counts] = await prisma.$transaction([
    prisma.vendor.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { products: true, subOrders: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      ...paginate(q.page, q.limit),
    }),
    prisma.vendor.count({ where }),
    prisma.vendor.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
  ]);
  return { ...pageResult(items, total, q.page, q.limit), statusCounts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])) };
}

export async function approveVendor(id: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id }, include: { user: true } });
  if (!vendor) throw AppError.notFound('Vendor');
  if (vendor.status !== 'PENDING') throw AppError.invalidState(`Vendor is already ${vendor.status.toLowerCase()}`);
  const [updated] = await prisma.$transaction([
    prisma.vendor.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), rejectionReason: null } }),
    prisma.user.update({ where: { id: vendor.userId }, data: { role: 'VENDOR' } }),
  ]);
  emails.vendorApproved(vendor.user.email, vendor.storeName);
  return updated;
}

export async function rejectVendor(id: string, reason: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id }, include: { user: true } });
  if (!vendor) throw AppError.notFound('Vendor');
  if (vendor.status !== 'PENDING') throw AppError.invalidState(`Vendor is already ${vendor.status.toLowerCase()}`);
  const updated = await prisma.vendor.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: reason } });
  emails.vendorRejected(vendor.user.email, vendor.storeName, reason);
  return updated;
}

// ---------------- Orders ----------------

export async function listOrders(q: { paymentStatus?: PaymentStatus; search?: string; page: number; limit: number }) {
  const where: Prisma.OrderWhereInput = {
    ...(q.paymentStatus ? { paymentStatus: q.paymentStatus } : {}),
    ...(q.search
      ? {
          OR: [
            { id: { contains: q.search, mode: 'insensitive' } },
            { customer: { email: { contains: q.search, mode: 'insensitive' } } },
            { customer: { name: { contains: q.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        subOrders: { select: { id: true, status: true, subtotal: true, vendor: { select: { id: true, storeName: true } } } },
        payment: { select: { provider: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...paginate(q.page, q.limit),
    }),
    prisma.order.count({ where }),
  ]);
  return pageResult(items, total, q.page, q.limit);
}

export async function getOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { ...orderInclude, customer: { select: { id: true, name: true, email: true } } },
  });
  if (!order) throw AppError.notFound('Order');
  return order;
}
