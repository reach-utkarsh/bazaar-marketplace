import { z } from 'zod';
import { requestSchema } from '../../middleware/validate.js';

const id = z.string().min(1).max(100);

export const configSchema = requestSchema({});

export const verifySchema = requestSchema({
  body: z.object({ orderId: id, providerOrderId: id, providerPaymentId: id, signature: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid signature') }),
});

export const webhookSchema = requestSchema({
  body: z
    .object({
      event: z.string().min(1).max(100),
      payload: z
        .object({
          payment: z
            .object({
              entity: z
                .object({
                  id,
                  order_id: id,
                  amount: z.number().int().nonnegative(),
                  status: z.string().optional(),
                  error_description: z.string().nullable().optional(),
                })
                .passthrough(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough(),
});

export const mockPaySchema = requestSchema({
  body: z.object({ orderId: id, outcome: z.enum(['success', 'failure']) }),
});
