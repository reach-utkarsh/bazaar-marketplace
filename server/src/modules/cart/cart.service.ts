import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { MAX_QTY_PER_LINE } from './cart.schemas.js';

async function loadPurchasable(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { vendor: { select: { status: true } } } });
  if (!product || !product.isActive || product.vendor.status !== 'APPROVED') throw AppError.notFound('Product');
  return product;
}

function assertStock(product: { stock: number; title: string }, qty: number) {
  if (product.stock < qty) {
    throw new AppError(409, 'INSUFFICIENT_STOCK',
      product.stock === 0 ? `"${product.title}" is out of stock` : `Only ${product.stock} of "${product.title}" left in stock`,
      { available: product.stock });
  }
}

/** Cart grouped by vendor — mirrors how the order will be split into sub-orders. */
export async function getCart(userId: string) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        select: {
          id: true, title: true, slug: true, price: true, stock: true, isActive: true,
          images: { orderBy: { position: 'asc' }, take: 1 },
          vendor: { select: { id: true, storeName: true, slug: true, status: true } },
        },
      },
    },
  });

  const groups = new Map<string, { vendor: { id: string; storeName: string; slug: string }; items: unknown[]; subtotal: number }>();
  let total = 0;
  let itemCount = 0;
  for (const item of items) {
    const { vendor, ...product } = item.product;
    const available = product.isActive && vendor.status === 'APPROVED' && product.stock >= item.quantity;
    const lineTotal = product.price * item.quantity;
    const group = groups.get(vendor.id) ?? { vendor: { id: vendor.id, storeName: vendor.storeName, slug: vendor.slug }, items: [], subtotal: 0 };
    group.items.push({ productId: item.productId, quantity: item.quantity, lineTotal, available, product });
    group.subtotal += lineTotal;
    groups.set(vendor.id, group);
    total += lineTotal;
    itemCount += item.quantity;
  }
  return { groups: [...groups.values()], itemCount, total };
}

export async function addItem(userId: string, productId: string, quantity: number) {
  const product = await loadPurchasable(productId);
  const existing = await prisma.cartItem.findUnique({ where: { userId_productId: { userId, productId } } });
  const next = Math.min((existing?.quantity ?? 0) + quantity, MAX_QTY_PER_LINE);
  assertStock(product, next);
  await prisma.cartItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, quantity: next },
    update: { quantity: next },
  });
  return getCart(userId);
}

export async function updateItem(userId: string, productId: string, quantity: number) {
  const existing = await prisma.cartItem.findUnique({ where: { userId_productId: { userId, productId } } });
  if (!existing) throw AppError.notFound('Cart item');
  assertStock(await loadPurchasable(productId), quantity);
  await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });
  return getCart(userId);
}

export async function removeItem(userId: string, productId: string) {
  await prisma.cartItem.deleteMany({ where: { userId, productId } });
  return getCart(userId);
}

export async function clear(userId: string) {
  await prisma.cartItem.deleteMany({ where: { userId } });
  return getCart(userId);
}
