import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { checkout as checkoutService } from '../src/modules/orders/checkout.service.js';
import { ADDRESS, addToCart, checkout, createUser } from './helpers.js';
import { vendorWithProduct } from './payment-helpers.js';

describe('inventory safety under concurrency', () => {
  it('two buyers racing for the last unit: exactly one wins', async () => {
    const { product } = await vendorWithProduct({ stock: 1 });
    const alice = await createUser();
    const bob = await createUser();
    // Both carts are valid at the time items are added.
    await addToCart(alice.auth, product.id);
    await addToCart(bob.auth, product.id);

    const [a, b] = await Promise.all([checkout(alice.auth), checkout(bob.auth)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe('INSUFFICIENT_STOCK');

    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(0);
    expect(await prisma.orderItem.count({ where: { productId: product.id } })).toBe(1);
  });

  it('many concurrent buyers never oversell (20 buyers, 5 units)', async () => {
    const { product } = await vendorWithProduct({ stock: 5 });
    const buyers = await Promise.all(Array.from({ length: 20 }, () => createUser()));
    for (const b of buyers) await addToCart(b.auth, product.id);

    const results = await Promise.allSettled(buyers.map((b) => checkoutService(b.user.id, ADDRESS)));
    const wins = results.filter((r) => r.status === 'fulfilled').length;
    const losses = results.filter((r) => r.status === 'rejected');
    expect(wins).toBe(5);
    expect(losses).toHaveLength(15);
    for (const l of losses) expect((l as PromiseRejectedResult).reason.code).toBe('INSUFFICIENT_STOCK');

    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stock).toBe(0);
    const sold = await prisma.orderItem.aggregate({ where: { productId: product.id }, _sum: { quantity: true } });
    expect(sold._sum.quantity).toBe(5);
  });

  it('multi-quantity purchases racing: total sold never exceeds stock', async () => {
    const { product } = await vendorWithProduct({ stock: 7 });
    const buyers = await Promise.all(Array.from({ length: 6 }, () => createUser()));
    for (const b of buyers) await addToCart(b.auth, product.id, 2);
    await Promise.allSettled(buyers.map((b) => checkoutService(b.user.id, ADDRESS)));
    const sold = await prisma.orderItem.aggregate({ where: { productId: product.id }, _sum: { quantity: true } });
    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(sold._sum.quantity).toBe(6); // 3 orders of 2; the 4th would need 8 > 7
    expect(after.stock).toBe(1);
  });

  it('the database itself rejects negative stock (CHECK constraint)', async () => {
    const { product } = await vendorWithProduct({ stock: 1 });
    await expect(prisma.product.update({ where: { id: product.id }, data: { stock: { decrement: 2 } } })).rejects.toThrow();
  });
});
