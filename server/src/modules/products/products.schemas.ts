import { z } from 'zod';
import { idParam, requestSchema } from '../../middleware/validate.js';

export const SORTS = ['newest', 'price_asc', 'price_desc', 'rating', 'popular'] as const;

const money = z.coerce.number().int().min(0).max(1_000_000_000);

export const listProductsSchema = requestSchema({
  query: z
    .object({
      search: z.string().trim().max(100).optional(),
      category: z.string().trim().max(100).optional(),
      vendor: z.string().trim().max(100).optional(),
      minPrice: money.optional(),
      maxPrice: money.optional(),
      inStock: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
      sort: z.enum(SORTS).default('newest'),
      page: z.coerce.number().int().min(1).max(1000).default(1),
      limit: z.coerce.number().int().min(1).max(48).default(12),
    })
    .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
      message: 'minPrice must be ≤ maxPrice',
      path: ['minPrice'],
    }),
});

export const productBySlugSchema = requestSchema({ params: z.object({ slug: z.string().min(1).max(120) }) });

const productBody = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  price: z.coerce.number().int('Price must be in whole paise').min(100, 'Minimum price is ₹1').max(100_000_000),
  stock: z.coerce.number().int().min(0).max(100_000),
  categoryId: z.string().min(1).max(64),
  isActive: z.boolean().default(true),
});

export const vendorListProductsSchema = requestSchema({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    status: z.enum(['active', 'inactive', 'low_stock']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});
export const vendorGetProductSchema = requestSchema({ params: idParam });
export const createProductSchema = requestSchema({ body: productBody });
export const updateProductSchema = requestSchema({
  params: idParam,
  body: productBody.partial().refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update'),
});
export const deleteProductSchema = requestSchema({ params: idParam });
export const uploadImagesSchema = requestSchema({ params: idParam });
export const deleteImageSchema = requestSchema({
  params: z.object({ id: z.string().min(1).max(64), imageId: z.string().min(1).max(64) }),
});
