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

export const checkoutSchema = requestSchema({ body: z.object({ address: addressSchema }) });
export const orderIdSchema = requestSchema({ params: idParam });
