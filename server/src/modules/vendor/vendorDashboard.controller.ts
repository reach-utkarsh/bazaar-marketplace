import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentVendor } from '../../middleware/auth.js';
import { requestSchema, valid } from '../../middleware/validate.js';
import { vendorAnalytics } from '../analytics/analytics.service.js';
import { vendorPayoutSummary } from '../payouts/payouts.service.js';

export const analyticsSchema = requestSchema({ query: z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }) });
export const payoutsSchema = requestSchema({});

export async function analytics(req: Request, res: Response) {
  const { query } = valid(req, analyticsSchema);
  res.json(await vendorAnalytics(currentVendor(req).id, query.days));
}

export async function payouts(req: Request, res: Response) {
  res.json(await vendorPayoutSummary(currentVendor(req).id));
}
