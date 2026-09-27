import type { Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { pageResult, paginate } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { uniqueSlug } from '../../lib/slug.js';
import { storage } from '../../services/storage/storage.service.js';
import type { SORTS } from './products.schemas.js';

const MAX_IMAGES = 8;
export const LOW_STOCK_THRESHOLD = 5;

export const productInclude = {
  images: { orderBy: { position: 'asc' } },
  vendor: { select: { id: true, storeName: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductInclude;

const orderBy: Record<(typeof SORTS)[number], Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'asc' }],
  price_asc: [{ price: 'asc' }, { id: 'asc' }],
  price_desc: [{ price: 'desc' }, { id: 'asc' }],
  rating: [{ avgRating: 'desc' }, { reviewCount: 'desc' }, { id: 'asc' }],
  popular: [{ reviewCount: 'desc' }, { avgRating: 'desc' }, { id: 'asc' }],
};

export interface CatalogQuery {
  search?: string;
  category?: string;
  vendor?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort: (typeof SORTS)[number];
  page: number;
  limit: number;
}

/** Public catalog: only active products from approved vendors. */
export async function listCatalog(q: CatalogQuery) {
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    vendor: { status: 'APPROVED', ...(q.vendor ? { slug: q.vendor } : {}) },
    ...(q.category ? { category: { slug: q.category } } : {}),
    ...(q.inStock ? { stock: { gt: 0 } } : {}),
    ...(q.minPrice !== undefined || q.maxPrice !== undefined
      ? { price: { ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}), ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}) } }
      : {}),
    ...(q.search
      ? {
          OR: [
            { title: { contains: q.search, mode: 'insensitive' } },
            { description: { contains: q.search, mode: 'insensitive' } },
            { category: { name: { contains: q.search, mode: 'insensitive' } } },
            { vendor: { storeName: { contains: q.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({ where, include: productInclude, orderBy: orderBy[q.sort], ...paginate(q.page, q.limit) }),
    prisma.product.count({ where }),
  ]);
  return pageResult(items, total, q.page, q.limit);
}

export async function getBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true, vendor: { status: 'APPROVED' } },
    include: productInclude,
  });
  if (!product) throw AppError.notFound('Product');
  return product;
}

// ---------------- Vendor-side management ----------------

async function findOwned(vendorId: string, id: string) {
  const product = await prisma.product.findFirst({ where: { id, vendorId }, include: productInclude });
  if (!product) throw AppError.notFound('Product');
  return product;
}

export async function vendorList(
  vendorId: string,
  q: { search?: string; status?: 'active' | 'inactive' | 'low_stock'; page: number; limit: number },
) {
  const where: Prisma.ProductWhereInput = {
    vendorId,
    ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
    ...(q.status === 'active' ? { isActive: true } : {}),
    ...(q.status === 'inactive' ? { isActive: false } : {}),
    ...(q.status === 'low_stock' ? { stock: { lte: LOW_STOCK_THRESHOLD } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({ where, include: productInclude, orderBy: { updatedAt: 'desc' }, ...paginate(q.page, q.limit) }),
    prisma.product.count({ where }),
  ]);
  return pageResult(items, total, q.page, q.limit);
}

export const vendorGet = findOwned;

async function assertCategory(categoryId: string) {
  const exists = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!exists) throw AppError.badRequest('Category does not exist');
}

export async function create(
  vendorId: string,
  data: { title: string; description: string; price: number; stock: number; categoryId: string; isActive: boolean },
) {
  await assertCategory(data.categoryId);
  return prisma.product.create({ data: { ...data, vendorId, slug: uniqueSlug(data.title) }, include: productInclude });
}

export async function update(
  vendorId: string,
  id: string,
  data: Partial<{ title: string; description: string; price: number; stock: number; categoryId: string; isActive: boolean }>,
) {
  const existing = await findOwned(vendorId, id);
  if (data.categoryId) await assertCategory(data.categoryId);
  return prisma.product.update({
    where: { id },
    data: { ...data, ...(data.title && data.title !== existing.title ? { slug: uniqueSlug(data.title) } : {}) },
    include: productInclude,
  });
}

/**
 * Products that appear in past orders are soft-deleted (deactivated) to keep order
 * history intact; never-ordered products are removed together with their images.
 */
export async function remove(vendorId: string, id: string) {
  const product = await findOwned(vendorId, id);
  const ordered = await prisma.orderItem.count({ where: { productId: id } });
  if (ordered > 0) {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    return { deleted: false, deactivated: true };
  }
  await prisma.product.delete({ where: { id } });
  await Promise.all(product.images.filter((i) => i.storageKey).map((i) => storage.remove(i.storageKey!)));
  return { deleted: true, deactivated: false };
}

export async function addImages(vendorId: string, id: string, files: Express.Multer.File[]) {
  if (!files.length) throw AppError.badRequest('Attach at least one image (field name "images")');
  const product = await findOwned(vendorId, id);
  if (product.images.length + files.length > MAX_IMAGES) {
    throw AppError.badRequest(`A product can have at most ${MAX_IMAGES} images`);
  }
  const stored = await Promise.all(
    files.map((f) => storage.save({ buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype })),
  );
  const start = product.images.reduce((max, i) => Math.max(max, i.position + 1), 0);
  await prisma.productImage.createMany({
    data: stored.map((s, i) => ({ productId: id, url: s.url, storageKey: s.key, position: start + i })),
  });
  return findOwned(vendorId, id);
}

export async function removeImage(vendorId: string, id: string, imageId: string) {
  const product = await findOwned(vendorId, id);
  const image = product.images.find((i) => i.id === imageId);
  if (!image) throw AppError.notFound('Image');
  await prisma.productImage.delete({ where: { id: imageId } });
  if (image.storageKey) await storage.remove(image.storageKey);
  return findOwned(vendorId, id);
}
