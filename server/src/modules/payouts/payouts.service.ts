import type { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { pageResult, paginate } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { emails } from '../../services/email/templates.js';
import { getCommissionBps } from '../settings/settings.service.js';

const returnWindowCutoff = (now = new Date()) => new Date(now.getTime() - env.RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

/**
 * A sub-order's earnings are payable once it has been delivered, its return window has
 * passed, it has not been refunded, has no open refund request, and is not in a payout yet.
 */
export function eligibleWhere(now = new Date()): Prisma.SubOrderWhereInput {
  return {
    status: 'DELIVERED',
    payoutId: null,
    refundedAmount: 0,
    deliveredAt: { lte: returnWindowCutoff(now) },
    order: { paymentStatus: 'PAID' },
    refundRequests: { none: { status: 'REQUESTED' } },
  };
}

/** Balances that would be paid out if payouts were generated now, per vendor. */
export async function eligibleBalances() {
  const rows = await prisma.subOrder.groupBy({
    by: ['vendorId'],
    where: eligibleWhere(),
    _sum: { vendorEarnings: true },
    _count: { _all: true },
  });
  const vendors = await prisma.vendor.findMany({ where: { id: { in: rows.map((r) => r.vendorId) } }, select: { id: true, storeName: true } });
  const names = new Map(vendors.map((v) => [v.id, v.storeName]));
  return rows
    .map((r) => ({ vendorId: r.vendorId, storeName: names.get(r.vendorId) ?? '—', amount: r._sum.vendorEarnings ?? 0, subOrderCount: r._count._all }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Batches every eligible sub-order into one PENDING payout per vendor. Runs in a
 * transaction and only claims sub-orders whose payoutId is still null, so running it
 * twice (or concurrently) can never pay the same sub-order twice.
 */
export async function generatePayouts() {
  return prisma.$transaction(async (tx) => {
    const eligible = await tx.subOrder.findMany({ where: eligibleWhere(), select: { id: true, vendorId: true, vendorEarnings: true } });
    const byVendor = new Map<string, typeof eligible>();
    for (const s of eligible) byVendor.set(s.vendorId, [...(byVendor.get(s.vendorId) ?? []), s]);

    const created = [];
    for (const [vendorId, subs] of byVendor) {
      const payout = await tx.payout.create({ data: { vendorId, amount: 0 } });
      const { count } = await tx.subOrder.updateMany({ where: { id: { in: subs.map((s) => s.id) }, payoutId: null }, data: { payoutId: payout.id } });
      if (count !== subs.length) throw AppError.conflict('Payout generation raced with another run; please retry');
      const amount = subs.reduce((sum, s) => sum + s.vendorEarnings, 0);
      created.push(await tx.payout.update({ where: { id: payout.id }, data: { amount }, include: { vendor: { select: { id: true, storeName: true } } } }));
    }
    return created;
  });
}

export async function listPayouts(q: { status?: 'PENDING' | 'PAID'; vendorId?: string; page: number; limit: number }) {
  const where: Prisma.PayoutWhereInput = { ...(q.status ? { status: q.status } : {}), ...(q.vendorId ? { vendorId: q.vendorId } : {}) };
  const [items, total] = await prisma.$transaction([
    prisma.payout.findMany({
      where,
      include: { vendor: { select: { id: true, storeName: true } }, _count: { select: { subOrders: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      ...paginate(q.page, q.limit),
    }),
    prisma.payout.count({ where }),
  ]);
  return pageResult(items, total, q.page, q.limit);
}

export async function markPaid(id: string, reference?: string) {
  const { count } = await prisma.payout.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PAID', paidAt: new Date(), reference: reference ?? null } });
  if (count === 0) {
    const exists = await prisma.payout.findUnique({ where: { id } });
    if (!exists) throw AppError.notFound('Payout');
    throw AppError.invalidState('Payout is already marked as paid');
  }
  const payout = await prisma.payout.findUniqueOrThrow({ where: { id }, include: { vendor: { include: { user: { select: { email: true } } } } } });
  emails.payoutPaid(payout.vendor.user.email, payout.amount, payout.reference);
  const { vendor, ...rest } = payout;
  return { ...rest, vendor: { id: vendor.id, storeName: vendor.storeName } };
}

/** Vendor-facing summary of where their money is. */
export async function vendorPayoutSummary(vendorId: string) {
  const net = { vendorEarnings: true } as const;
  const [delivered, available, inWindow, inProgress, pending, paid, payouts, commissionRateBps] = await Promise.all([
    prisma.subOrder.aggregate({ where: { vendorId, status: 'DELIVERED', refundedAmount: 0, order: { paymentStatus: 'PAID' } }, _sum: net }),
    prisma.subOrder.aggregate({ where: { vendorId, ...eligibleWhere() }, _sum: net }),
    prisma.subOrder.aggregate({
      where: { vendorId, status: 'DELIVERED', payoutId: null, refundedAmount: 0, order: { paymentStatus: 'PAID' },
        OR: [{ deliveredAt: { gt: returnWindowCutoff() } }, { refundRequests: { some: { status: 'REQUESTED' } } }] },
      _sum: net,
    }),
    prisma.subOrder.aggregate({ where: { vendorId, status: { in: ['PLACED', 'PACKED', 'SHIPPED'] }, order: { paymentStatus: 'PAID' } }, _sum: net }),
    prisma.payout.aggregate({ where: { vendorId, status: 'PENDING' }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { vendorId, status: 'PAID' }, _sum: { amount: true } }),
    prisma.payout.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, take: 50, include: { _count: { select: { subOrders: true } } } }),
    getCommissionBps(),
  ]);
  return {
    summary: {
      lifetimeEarnings: delivered._sum.vendorEarnings ?? 0,
      paidOut: paid._sum.amount ?? 0,
      pendingPayout: pending._sum.amount ?? 0,
      availableForPayout: available._sum.vendorEarnings ?? 0,
      inReturnWindow: inWindow._sum.vendorEarnings ?? 0,
      inProgress: inProgress._sum.vendorEarnings ?? 0,
    },
    returnWindowDays: env.RETURN_WINDOW_DAYS,
    commissionRateBps,
    payouts,
  };
}
