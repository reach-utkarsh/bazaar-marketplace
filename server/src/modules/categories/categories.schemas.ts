import { z } from 'zod';
import { idParam, requestSchema } from '../../middleware/validate.js';

const name = z.string().trim().min(2).max(50);

export const listCategoriesSchema = requestSchema({});
export const createCategorySchema = requestSchema({ body: z.object({ name }) });
export const updateCategorySchema = requestSchema({ params: idParam, body: z.object({ name }) });
export const deleteCategorySchema = requestSchema({ params: idParam });
