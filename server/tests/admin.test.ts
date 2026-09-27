import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { addToCart, api, checkout, createUser, createVendor } from './helpers.js';
import { paidOrder, vendorWithProduct } from './payment-helpers.js';

describe('admin: vendor approval', () => {
  it('approves a pending vendor, promoting the user to VENDOR', async () => {
    const admin = await createUser('ADMIN');
    const applicant = await createUser();
    await api().post('/api/vendors/apply').set(applicant.auth).send({ storeName: 'Spice Route', description: 'Whole spices from Kerala farms, packed fresh.' });

    const list = await api().get('/api/admin/vendors').query({ status: 'PENDING' }).set(admin.auth);
    expect(list.body.total).toBe(1);
    const vendorId = list.body.items[0].id;
    expect(list.body.items[0].user.email).toBe(applicant.user.email);

    const res = await api().post(`/api/admin/vendors/${vendorId}/approve`).set(admin.auth);
    expect(res.body.status).toBe('APPROVED');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: applicant.user.id } })).role).toBe('VENDOR');
    // Vendor API works immediately, even with the old (CUSTOMER) access token.
    expect((await api().get('/api/vendor/products').set(applicant.auth)).status).toBe(200);
    // Approving twice is rejected.
    expect((await api().post(`/api/admin/vendors/${vendorId}/approve`).set(admin.auth)).status).toBe(409);
  });

  it('rejects with a reason', async () => {
    const admin = await createUser('ADMIN');
    const { vendor } = await createVendor('PENDING');
    expect((await api().post(`/api/admin/vendors/${vendor.id}/reject`).set(admin.auth).send({})).status).toBe(400);
    const res = await api().post(`/api/admin/vendors/${vendor.id}/reject`).set(admin.auth).send({ reason: 'Please add product photos' });
    expect(res.body).toMatchObject({ status: 'REJECTED', rejectionReason: 'Please add product photos' });
  });

  it('is admin-only', async () => {
    const vendor = await createVendor();
    const customer = await createUser();
    for (const u of [vendor, customer]) {
      expect((await api().get('/api/admin/vendors').set(u.auth)).status).toBe(403);
      expect((await api().get('/api/admin/dashboard').set(u.auth)).status).toBe(403);
    }
  });
});

describe('admin: commission & orders', () => {
  it('updates the commission rate within bounds and applies it to new orders', async () => {
    const admin = await createUser('ADMIN');
    expect((await api().get('/api/admin/settings').set(admin.auth)).body).toEqual({ commissionRateBps: 1000 });
    expect((await api().patch('/api/admin/settings/commission').set(admin.auth).send({ commissionRateBps: 9000 })).status).toBe(400);
    expect((await api().patch('/api/admin/settings/commission').set(admin.auth).send({ commissionRateBps: 1250 })).body).toEqual({ commissionRateBps: 1250 });

    const { product } = await vendorWithProduct({ price: 80_000 });
    const c = await createUser();
    await addToCart(c.auth, product.id);
    const { body } = await checkout(c.auth);
    expect(body.order.subOrders[0]).toMatchObject({ commissionRateBps: 1250, commissionAmount: 10_000, vendorEarnings: 70_000 });
  });

  it('lists and searches all orders', async () => {
    const admin = await createUser('ADMIN');
    const { product } = await vendorWithProduct();
    const buyer = await createUser('CUSTOMER', { email: 'findme@example.com' });
    const { order } = await paidOrder([{ productId: product.id }], buyer);
    await paidOrder([{ productId: product.id }]);

    const all = await api().get('/api/admin/orders').set(admin.auth);
    expect(all.body.total).toBe(2);
    const found = await api().get('/api/admin/orders').query({ search: 'findme' }).set(admin.auth);
    expect(found.body.items.map((o: { id: string }) => o.id)).toEqual([order.id]);
    const detail = await api().get(`/api/admin/orders/${order.id}`).set(admin.auth);
    expect(detail.body.customer.email).toBe('findme@example.com');
  });
});

describe('dashboards', () => {
  it('platform dashboard reports GMV and commission net of cancellations', async () => {
    const admin = await createUser('ADMIN');
    const a = await vendorWithProduct({ price: 100_000 });
    const b = await vendorWithProduct({ price: 50_000 });
    await paidOrder([{ productId: a.product.id }, { productId: b.product.id }]);
    const { order } = await paidOrder([{ productId: b.product.id }]);
    // Cancel one sub-order: it must not count toward GMV.
    await api().patch(`/api/vendor/orders/${order.subOrders[0].id}/status`).set(b.auth).send({ status: 'CANCELLED', reason: 'Out of stock' });

    const res = await api().get('/api/admin/dashboard').query({ days: 7 }).set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.range).toMatchObject({ sales: 150_000, commission: 15_000, orders: 2 });
    expect(res.body.daily).toHaveLength(7);
    expect(res.body.daily.at(-1).sales).toBe(150_000);
    expect(res.body.topVendors[0]).toMatchObject({ vendorId: a.vendor.id, sales: 100_000 });
    expect(res.body.counts.approvedVendors).toBe(2);
  });

  it('vendor analytics shows own sales, top products and pending orders', async () => {
    const v = await vendorWithProduct({ price: 20_000, stock: 50 });
    const other = await vendorWithProduct({ price: 99_000 });
    await paidOrder([{ productId: v.product.id, quantity: 3 }, { productId: other.product.id }]);
    await paidOrder([{ productId: v.product.id, quantity: 1 }]);

    const res = await api().get('/api/vendor/analytics').set(v.auth);
    expect(res.body.range).toMatchObject({ sales: 80_000, orders: 2, unitsSold: 4, avgOrderValue: 40_000 });
    expect(res.body.allTime.earnings).toBe(72_000);
    expect(res.body.topProducts[0]).toMatchObject({ productId: v.product.id, units: 4, revenue: 80_000 });
    expect(res.body.pendingOrders).toEqual({ placed: 2, packed: 0, shipped: 0 });
    expect(res.body.daily).toHaveLength(30);
  });
});
