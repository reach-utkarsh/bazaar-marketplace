import { z } from 'zod';
import { idParam, requestSchema } from '../../middleware/validate.js';

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(20);

export const dashboardSchema = requestSchema({ query: z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }) });

export const listVendorsSchema = requestSchema({ query: z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(), page, limit }) });
export const approveVendorSchema = requestSchema({ params: idParam });
export const rejectVendorSchema = requestSchema({ params: idParam, body: z.object({ reason: z.string().trim().min(5).max(500) }) });

export const listOrdersSchema = requestSchema({
  query: z.object({ paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'CANCELLED']).optional(), search: z.string().trim().max(100).optional(), page, limit }),
});
export const getOrderSchema = requestSchema({ params: idParam });

export const getSettingsSchema = requestSchema({});
export const setCommissionSchema = requestSchema({
  body: z.object({ commissionRateBps: z.number().int().min(0).max(5000, 'Commission cannot exceed 50%') }),
});

export const listPayoutsSchema = requestSchema({ query: z.object({ status: z.enum(['PENDING', 'PAID']).optional(), page, limit }) });
export const generatePayoutsSchema = requestSchema({});
export const markPayoutPaidSchema = requestSchema({ params: idParam, body: z.object({ reference: z.string().trim().max(100).optional() }) });

export const listRefundsSchema = requestSchema({ query: z.object({ status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED']).optional(), page, limit }) });
export const approveRefundSchema = requestSchema({ params: idParam, body: z.object({ note: z.string().trim().max(500).optional() }) });
export const rejectRefundSchema = requestSchema({ params: idParam, body: z.object({ note: z.string().trim().min(5, 'Explain the decision (5+ characters)').max(500) }) });
