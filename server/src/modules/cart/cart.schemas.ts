import { z } from 'zod';
import { requestSchema } from '../../middleware/validate.js';

export const MAX_QTY_PER_LINE = 20;
const quantity = z.coerce.number().int().min(1).max(MAX_QTY_PER_LINE, `You can buy at most ${MAX_QTY_PER_LINE} of an item`);
const productIdParam = z.object({ productId: z.string().min(1).max(64) });

export const getCartSchema = requestSchema({});
export const addItemSchema = requestSchema({ body: z.object({ productId: z.string().min(1).max(64), quantity: quantity.default(1) }) });
export const updateItemSchema = requestSchema({ params: productIdParam, body: z.object({ quantity }) });
export const removeItemSchema = requestSchema({ params: productIdParam });
export const clearCartSchema = requestSchema({});
