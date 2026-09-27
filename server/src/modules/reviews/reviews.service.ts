import { AppError } from '../../lib/errors.js';
import { pageResult, paginate } from '../../lib/pagination.js';
import { prisma, type Tx } from '../../lib/prisma.js';

/** A verified buyer has a delivered, paid shipment containing the product. */
async function isVerifiedBuyer(userId: string, productId: string) {
  const count = await prisma.orderItem.count({
    where: { productId, subOrder: { status: 'DELIVERED', order: { customerId: userId, paymentStatus: 'PAID' } } },
  });
  return count > 0;
}

export async function listReviews(productId: string, page: number, limit: number) {
  const where = { productId };
  const [items, total, dist] = await prisma.$transaction([
    prisma.review.findMany({ where, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, ...paginate(page, limit) }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true }, orderBy: { rating: 'asc' } }),
  ]);
  const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((r) => [r, 0]));
  for (const d of dist) distribution[d.rating] = (d._count as { _all: number })._all;
  // Reviewer names are shortened for privacy ("Priya S.").
  const anonymised = items.map((r) => ({ ...r, user: { id: r.user.id, name: shortName(r.user.name) } }));
  return { ...pageResult(anonymised, total, page, limit), distribution };
}

function shortName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

export async function eligibility(userId: string, productId: string) {
  const [verified, existing] = await Promise.all([
    isVerifiedBuyer(userId, productId),
    prisma.review.findUnique({ where: { productId_userId: { productId, userId } } }),
  ]);
  return {
    canReview: verified,
    reason: verified ? null : 'Only customers who received this product can review it',
    existingReview: existing,
  };
}

async function refreshAggregates(tx: Tx, productId: string) {
  const agg = await tx.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: { _all: true } });
  await tx.product.update({
    where: { id: productId },
    data: { avgRating: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count._all },
  });
}

/** Creates or updates the caller's review (one per product per buyer). */
export async function upsertReview(userId: string, productId: string, input: { rating: number; comment: string }) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw AppError.notFound('Product');
  if (!(await isVerifiedBuyer(userId, productId))) {
    throw AppError.forbidden('Only verified buyers who have received this product can review it');
  }
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.upsert({
      where: { productId_userId: { productId, userId } },
      create: { productId, userId, ...input },
      update: input,
    });
    await refreshAggregates(tx, productId);
    return review;
  });
}
