import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { slugify } from '../../lib/slug.js';

export async function listCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: { where: { isActive: true, vendor: { status: 'APPROVED' } } } } } },
  });
  return categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
}

export async function createCategory(name: string) {
  return prisma.category.create({ data: { name, slug: slugify(name) } });
}

export async function updateCategory(id: string, name: string) {
  return prisma.category.update({ where: { id }, data: { name, slug: slugify(name) } });
}

export async function deleteCategory(id: string) {
  const inUse = await prisma.product.count({ where: { categoryId: id } });
  if (inUse > 0) throw AppError.conflict(`Category has ${inUse} product(s); reassign them before deleting`);
  await prisma.category.delete({ where: { id } });
}
