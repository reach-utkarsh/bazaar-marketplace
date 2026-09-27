import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { slugify } from '../../lib/slug.js';
import { emails } from '../../services/email/templates.js';

export async function apply(userId: string, input: { storeName: string; description: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { vendor: true } });
  if (user.role === 'ADMIN') throw AppError.forbidden('Admins cannot open a store');

  const slug = slugify(input.storeName);
  if (!slug) throw AppError.badRequest('Store name must contain letters or numbers');
  const clash = await prisma.vendor.findFirst({
    where: { OR: [{ storeName: { equals: input.storeName, mode: 'insensitive' } }, { slug }], NOT: { userId } },
  });
  if (clash) throw AppError.conflict('That store name is already taken');

  if (user.vendor) {
    if (user.vendor.status !== 'REJECTED') {
      throw AppError.conflict(user.vendor.status === 'PENDING' ? 'Your application is already under review' : 'You are already a vendor');
    }
    // Rejected applicants may re-apply.
    const vendor = await prisma.vendor.update({
      where: { id: user.vendor.id },
      data: { ...input, slug, status: 'PENDING', rejectionReason: null },
    });
    emails.vendorApplicationReceived(user.email, vendor.storeName);
    return vendor;
  }

  const vendor = await prisma.vendor.create({ data: { userId, ...input, slug } });
  emails.vendorApplicationReceived(user.email, vendor.storeName);
  return vendor;
}

export async function getMine(userId: string) {
  return prisma.vendor.findUnique({ where: { userId } });
}

export async function getStore(slug: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { slug, status: 'APPROVED' },
    select: { id: true, storeName: true, slug: true, description: true, createdAt: true,
      _count: { select: { products: { where: { isActive: true } } } } },
  });
  if (!vendor) throw AppError.notFound('Store');
  const agg = await prisma.product.aggregate({
    where: { vendorId: vendor.id, reviewCount: { gt: 0 } },
    _avg: { avgRating: true },
  });
  const { _count, ...rest } = vendor;
  return { ...rest, productCount: _count.products, avgRating: agg._avg.avgRating ?? 0 };
}
