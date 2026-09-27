import { z } from 'zod';
import { idParam, requestSchema } from '../../middleware/validate.js';

export const listReviewsSchema = requestSchema({
  params: idParam,
  query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(10) }),
});
export const eligibilitySchema = requestSchema({ params: idParam });
export const upsertReviewSchema = requestSchema({
  params: idParam,
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(10, 'Please write at least 10 characters').max(2000),
  }),
});
