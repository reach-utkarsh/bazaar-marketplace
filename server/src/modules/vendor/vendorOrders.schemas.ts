import { z } from 'zod';
import { idParam, requestSchema } from '../../middleware/validate.js';

export const listVendorOrdersSchema = requestSchema({
  query: z.object({
    status: z.enum(['PLACED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(15),
  }),
});

export const getVendorOrderSchema = requestSchema({ params: idParam });

export const updateVendorOrderStatusSchema = requestSchema({
  params: idParam,
  body: z.discriminatedUnion('status', [
    z.object({ status: z.literal('PACKED'), note: z.string().trim().max(300).optional() }),
    z.object({
      status: z.literal('SHIPPED'),
      trackingNumber: z.string().trim().min(4).max(60),
      carrier: z.string().trim().min(2).max(60).optional(),
      note: z.string().trim().max(300).optional(),
    }),
    z.object({ status: z.literal('DELIVERED'), note: z.string().trim().max(300).optional() }),
    z.object({ status: z.literal('CANCELLED'), reason: z.string().trim().min(5, 'Tell the customer why (5+ characters)').max(300) }),
  ]),
});
