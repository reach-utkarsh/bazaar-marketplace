import { Prisma } from '@prisma/client';
import { dayKeys, daysAgo } from '../../lib/dates.js';
import { prisma } from '../../lib/prisma.js';
import { LOW_STOCK_THRESHOLD } from '../products/products.service.js';
import { getCommissionBps } from '../settings/settings.service.js';

// Sales are counted from paid orders, excluding cancelled sub-orders and net of refunds.
const NET = Prisma.sql`(s."subtotal" - s."refundedAmount")`;
const NET_EARNINGS = Prisma.sql`ROUND((s."subtotal" - s."refundedAmount") * (10000 - s."commissionRateBps") / 10000.0)`;
const NET_COMMISSION = Prisma.sql`ROUND((s."subtotal" - s."refundedAmount") * s."commissionRateBps" / 10000.0)`;

interface DayRow {
  day: string;
  sales: bigint;
  commission: bigint;
  orders: bigint;
}

async function dailySeries(days: number, vendorId?: string) {
  const since = daysAgo(days);
  const rows = await prisma.$queryRaw<DayRow[]>`
    SELECT to_char(o."paidAt", 'YYYY-MM-DD') AS day,
           COALESCE(SUM(${NET}), 0)::bigint AS sales,
           COALESCE(SUM(${NET_COMMISSION}), 0)::bigint AS commission,
           COUNT(DISTINCT s."id")::bigint AS orders
    FROM "SubOrder" s
    JOIN "Order" o ON o."id" = s."orderId"
    WHERE o."paymentStatus" = 'PAID' AND s."status" <> 'CANCELLED' AND o."paidAt" >= ${since}
      ${vendorId ? Prisma.sql`AND s."vendorId" = ${vendorId}` : Prisma.empty}
    GROUP BY 1 ORDER BY 1`;
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return dayKeys(days).map((date) => {
    const r = byDay.get(date);
    return { date, sales: Number(r?.sales ?? 0), commission: Number(r?.commission ?? 0), orders: Number(r?.orders ?? 0) };
  });
}

interface TotalsRow {
  sales: bigint;
  earnings: bigint;
  commission: bigint;
  orders: bigint;
}

async function totals(vendorId?: string, since?: Date) {
  const [row] = await prisma.$queryRaw<TotalsRow[]>`
    SELECT COALESCE(SUM(${NET}), 0)::bigint AS sales,
           COALESCE(SUM(${NET_EARNINGS}), 0)::bigint AS earnings,
           COALESCE(SUM(${NET_COMMISSION}), 0)::bigint AS commission,
           COUNT(DISTINCT s."id")::bigint AS orders
    FROM "SubOrder" s
    JOIN "Order" o ON o."id" = s."orderId"
    WHERE o."paymentStatus" = 'PAID' AND s."status" <> 'CANCELLED'
      ${vendorId ? Prisma.sql`AND s."vendorId" = ${vendorId}` : Prisma.empty}
      ${since ? Prisma.sql`AND o."paidAt" >= ${since}` : Prisma.empty}`;
  return { sales: Number(row.sales), earnings: Number(row.earnings), commission: Number(row.commission), orders: Number(row.orders) };
}

export async function vendorAnalytics(vendorId: string, days: number) {
  const since = daysAgo(days);
  const paidActive = { vendorId, status: { not: 'CANCELLED' as const }, order: { paymentStatus: 'PAID' as const } };
  const [allTime, range, daily, top, units, pendingCounts, lowStock] = await Promise.all([
    totals(vendorId),
    totals(vendorId, since),
    dailySeries(days, vendorId),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { subOrder: { ...paidActive, order: { paymentStatus: 'PAID', paidAt: { gte: since } } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 5,
    }),
    prisma.orderItem.aggregate({ where: { subOrder: { ...paidActive, order: { paymentStatus: 'PAID', paidAt: { gte: since } } } }, _sum: { quantity: true } }),
    prisma.subOrder.groupBy({ by: ['status'], where: { vendorId, status: { in: ['PLACED', 'PACKED', 'SHIPPED'] }, order: { paymentStatus: 'PAID' } }, _count: { _all: true } }),
    prisma.product.findMany({ where: { vendorId, isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } }, select: { id: true, title: true, stock: true }, orderBy: { stock: 'asc' }, take: 5 }),
  ]);
  const titles = new Map(
    (await prisma.product.findMany({ where: { id: { in: top.map((t) => t.productId) } }, select: { id: true, title: true } })).map((p) => [p.id, p.title]),
  );
  const pending = Object.fromEntries(pendingCounts.map((p) => [p.status, p._count._all]));
  return {
    rangeDays: days,
    allTime,
    range: { ...range, unitsSold: units._sum.quantity ?? 0, avgOrderValue: range.orders ? Math.round(range.sales / range.orders) : 0 },
    pendingOrders: { placed: pending.PLACED ?? 0, packed: pending.PACKED ?? 0, shipped: pending.SHIPPED ?? 0 },
    daily,
    topProducts: top.map((t) => ({ productId: t.productId, title: titles.get(t.productId) ?? 'Deleted product', units: t._sum.quantity ?? 0, revenue: t._sum.lineTotal ?? 0 })),
    lowStock,
  };
}

export async function platformDashboard(days: number) {
  const since = daysAgo(days);
  const [allTime, range, daily, topVendorRows, customers, vendorCounts, pendingRefunds, pendingPayouts, commissionRateBps, recentOrders] = await Promise.all([
    totals(),
    totals(undefined, since),
    dailySeries(days),
    prisma.$queryRaw<{ vendorId: string; storeName: string; sales: bigint; orders: bigint }[]>`
      SELECT s."vendorId", v."storeName", COALESCE(SUM(${NET}), 0)::bigint AS sales, COUNT(*)::bigint AS orders
      FROM "SubOrder" s JOIN "Order" o ON o."id" = s."orderId" JOIN "Vendor" v ON v."id" = s."vendorId"
      WHERE o."paymentStatus" = 'PAID' AND s."status" <> 'CANCELLED' AND o."paidAt" >= ${since}
      GROUP BY s."vendorId", v."storeName" ORDER BY sales DESC LIMIT 5`,
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.vendor.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.refundRequest.count({ where: { status: 'REQUESTED' } }),
    prisma.payout.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true }, _count: { _all: true } }),
    getCommissionBps(),
    prisma.order.findMany({
      where: { paymentStatus: 'PAID' },
      orderBy: { paidAt: 'desc' },
      take: 6,
      select: { id: true, totalAmount: true, paidAt: true, customer: { select: { name: true } }, _count: { select: { subOrders: true } } },
    }),
  ]);
  const vendors = Object.fromEntries(vendorCounts.map((v) => [v.status, v._count._all]));
  return {
    rangeDays: days,
    commissionRateBps,
    allTime,
    range: { ...range, avgOrderValue: range.orders ? Math.round(range.sales / range.orders) : 0 },
    counts: {
      customers,
      approvedVendors: vendors.APPROVED ?? 0,
      pendingVendors: vendors.PENDING ?? 0,
      pendingRefunds,
      pendingPayouts: pendingPayouts._count._all,
      pendingPayoutAmount: pendingPayouts._sum.amount ?? 0,
    },
    daily,
    topVendors: topVendorRows.map((r) => ({ vendorId: r.vendorId, storeName: r.storeName, sales: Number(r.sales), orders: Number(r.orders) })),
    recentOrders,
  };
}
