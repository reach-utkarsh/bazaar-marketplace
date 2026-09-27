import { z } from 'zod';
import { requestSchema } from '../../middleware/validate.js';

export const applySchema = requestSchema({
  body: z.object({
    storeName: z.string().trim().min(3).max(60),
    description: z.string().trim().min(20, 'Tell customers a bit more (20+ characters)').max(1000),
  }),
});

export const myVendorSchema = requestSchema({});

export const storeSchema = requestSchema({
  params: z.object({ slug: z.string().min(1).max(100) }),
});
