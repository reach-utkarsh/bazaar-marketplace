import { z } from 'zod';
import { idParam, requestSchema } from '../../middleware/validate.js';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const addressSchema = z.object({
  shippingName: text(2, 80),
  shippingPhone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number'),
  shippingLine1: text(3, 120),
  shippingLine2: z.string().trim().max(120).optional().transform((v) => v || undefined),
  shippingCity: text(2, 60),
  shippingState: text(2, 60),
  shippingPostalCode: z.string().trim().regex(/^[A-Za-z0-9 -]{3,10}$/, 'Enter a valid postal code'),
  shippingCountry: text(2, 60).default('India'),
});

const subOrderParams = z.object({ id: z.string().min(1).max(64), subOrderId: z.string().min(1).max(64) });

export const checkoutSchema = requestSchema({ body: z.object({ address: addressSchema }) });
export const orderIdSchema = requestSchema({ params: idParam });
export const listOrdersSchema = requestSchema({
  query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(10) }),
});
export const cancelSubOrderSchema = requestSchema({
  params: subOrderParams,
  body: z.object({ reason: z.string().trim().max(500).optional() }),
});
export const refundRequestSchema = requestSchema({
  params: subOrderParams,
  body: z.object({ reason: z.string().trim().min(10, 'Please describe the problem (10+ characters)').max(500) }),
});
