import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createCategory, createProduct, createUser, createVendor } from './helpers.js';

describe('categories', () => {
  it('lists categories publicly with active product counts', async () => {
    const cat = await createCategory('Books');
    const { vendor } = await createVendor();
    await createProduct(vendor.id, { categoryId: cat.id });
    const res = await api().get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([expect.objectContaining({ name: 'Books', productCount: 1 })]);
  });

  it('only admins can manage categories', async () => {
    const customer = await createUser('CUSTOMER');
    const admin = await createUser('ADMIN');
    expect((await api().post('/api/admin/categories').set(customer.auth).send({ name: 'Toys' })).status).toBe(403);
    expect((await api().post('/api/admin/categories').send({ name: 'Toys' })).status).toBe(401);

    const created = await api().post('/api/admin/categories').set(admin.auth).send({ name: 'Toys & Games' });
    expect(created.status).toBe(201);
    expect(created.body.slug).toBe('toys-games');

    const dup = await api().post('/api/admin/categories').set(admin.auth).send({ name: 'Toys & Games' });
    expect(dup.status).toBe(409);

    const renamed = await api().patch(`/api/admin/categories/${created.body.id}`).set(admin.auth).send({ name: 'Games' });
    expect(renamed.body.slug).toBe('games');
    expect((await api().delete(`/api/admin/categories/${created.body.id}`).set(admin.auth)).status).toBe(204);
  });

  it('refuses to delete a category that still has products', async () => {
    const admin = await createUser('ADMIN');
    const cat = await createCategory();
    const { vendor } = await createVendor();
    await createProduct(vendor.id, { categoryId: cat.id });
    expect((await api().delete(`/api/admin/categories/${cat.id}`).set(admin.auth)).status).toBe(409);
  });
});

describe('public catalog', () => {
  async function fixture() {
    const books = await createCategory('Books');
    const tech = await createCategory('Tech');
    const { vendor } = await createVendor();
    const pending = await createVendor('PENDING');
    await createProduct(vendor.id, { title: 'Cheap Novel', price: 29_900, categoryId: books.id });
    await createProduct(vendor.id, { title: 'Mechanical Keyboard', price: 549_900, categoryId: tech.id });
    await createProduct(vendor.id, { title: 'USB Cable', price: 19_900, categoryId: tech.id, stock: 0 });
    const hidden = await createProduct(vendor.id, { title: 'Hidden Gadget', categoryId: tech.id });
    await prisma.product.update({ where: { id: hidden.id }, data: { isActive: false } });
    await createProduct(pending.vendor.id, { title: 'Unapproved Vendor Item', categoryId: tech.id });
    return { books, tech };
  }

  it('hides inactive products and products from unapproved vendors', async () => {
    await fixture();
    const res = await api().get('/api/products');
    expect(res.status).toBe(200);
    const titles = res.body.items.map((p: { title: string }) => p.title);
    expect(titles).toHaveLength(3);
    expect(titles).not.toContain('Hidden Gadget');
    expect(titles).not.toContain('Unapproved Vendor Item');
  });

  it('filters by search, category, price range and stock', async () => {
    await fixture();
    const search = await api().get('/api/products').query({ search: 'keyboard' });
    expect(search.body.items.map((p: { title: string }) => p.title)).toEqual(['Mechanical Keyboard']);

    const cat = await api().get('/api/products').query({ category: 'tech' });
    expect(cat.body.total).toBe(2);

    const price = await api().get('/api/products').query({ minPrice: 20_000, maxPrice: 100_000 });
    expect(price.body.items.map((p: { title: string }) => p.title)).toEqual(['Cheap Novel']);

    const inStock = await api().get('/api/products').query({ category: 'tech', inStock: 'true' });
    expect(inStock.body.total).toBe(1);
  });

  it('sorts by price and paginates', async () => {
    await fixture();
    const asc = await api().get('/api/products').query({ sort: 'price_asc' });
    const prices = asc.body.items.map((p: { price: number }) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    const desc = await api().get('/api/products').query({ sort: 'price_desc', limit: 2, page: 1 });
    expect(desc.body).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(desc.body.items[0].title).toBe('Mechanical Keyboard');
    const page2 = await api().get('/api/products').query({ sort: 'price_desc', limit: 2, page: 2 });
    expect(page2.body.items).toHaveLength(1);
  });

  it('validates query parameters', async () => {
    const res = await api().get('/api/products').query({ sort: 'bogus', limit: 1000 });
    expect(res.status).toBe(400);
    const range = await api().get('/api/products').query({ minPrice: 500, maxPrice: 100 });
    expect(range.status).toBe(400);
  });

  it('returns product details by slug with vendor, category and images', async () => {
    const { vendor } = await createVendor();
    const p = await createProduct(vendor.id, { title: 'Desk Lamp' });
    await prisma.productImage.create({ data: { productId: p.id, url: 'https://example.com/a.jpg' } });
    const res = await api().get(`/api/products/${p.slug}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Desk Lamp', vendor: { id: vendor.id }, images: [{ url: 'https://example.com/a.jpg' }] });
    expect((await api().get('/api/products/nope')).status).toBe(404);
  });
});
