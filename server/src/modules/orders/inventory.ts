import { AppError } from '../../lib/errors.js';
import type { Tx } from '../../lib/prisma.js';

interface Line {
  productId: string;
  quantity: number;
}

/**
 * Atomically reserves stock for each line inside the caller's transaction.
 *
 * Each decrement is a conditional `UPDATE … SET stock = stock - q WHERE id = ? AND stock >= q`.
 * Postgres takes a row-level lock for the UPDATE; a concurrent buyer's UPDATE blocks on that
 * lock and then re-evaluates `stock >= q` against the committed value, so the last unit can
 * only ever be sold once. Lines are processed in productId order to avoid deadlocks between
 * transactions that touch the same products. Any shortfall throws and rolls back everything.
 */
export async function reserveStock(tx: Tx, lines: Line[]) {
  const sorted = [...lines].sort((a, b) => a.productId.localeCompare(b.productId));
  for (const line of sorted) {
    const { count } = await tx.product.updateMany({
      where: { id: line.productId, stock: { gte: line.quantity } },
      data: { stock: { decrement: line.quantity } },
    });
    if (count === 0) {
      const product = await tx.product.findUnique({ where: { id: line.productId }, select: { title: true, stock: true } });
      const available = product?.stock ?? 0;
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        available === 0
          ? `"${product?.title ?? 'An item'}" just sold out`
          : `Only ${available} of "${product?.title}" left — please update your cart`,
        { productId: line.productId, available },
      );
    }
  }
}

/** Returns reserved stock (cancellation, failed/expired payment). */
export async function restoreStock(tx: Tx, lines: Line[]) {
  const sorted = [...lines].sort((a, b) => a.productId.localeCompare(b.productId));
  for (const line of sorted) {
    await tx.product.update({ where: { id: line.productId }, data: { stock: { increment: line.quantity } } });
  }
}
