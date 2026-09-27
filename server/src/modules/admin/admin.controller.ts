import type { Request, Response } from 'express';
import { valid } from '../../middleware/validate.js';
import { platformDashboard } from '../analytics/analytics.service.js';
import * as payouts from '../payouts/payouts.service.js';
import * as refunds from '../refunds/refunds.service.js';
import { getCommissionBps, setCommissionBps } from '../settings/settings.service.js';
import * as s from './admin.schemas.js';
import * as service from './admin.service.js';

export async function dashboard(req: Request, res: Response) {
  const { query } = valid(req, s.dashboardSchema);
  res.json(await platformDashboard(query.days));
}

export async function listVendors(req: Request, res: Response) {
  const { query } = valid(req, s.listVendorsSchema);
  res.json(await service.listVendors(query));
}

export async function approveVendor(req: Request, res: Response) {
  const { params } = valid(req, s.approveVendorSchema);
  res.json(await service.approveVendor(params.id));
}

export async function rejectVendor(req: Request, res: Response) {
  const { params, body } = valid(req, s.rejectVendorSchema);
  res.json(await service.rejectVendor(params.id, body.reason));
}

export async function listOrders(req: Request, res: Response) {
  const { query } = valid(req, s.listOrdersSchema);
  res.json(await service.listOrders(query));
}

export async function getOrder(req: Request, res: Response) {
  const { params } = valid(req, s.getOrderSchema);
  res.json(await service.getOrder(params.id));
}

export async function getSettings(_req: Request, res: Response) {
  res.json({ commissionRateBps: await getCommissionBps() });
}

export async function setCommission(req: Request, res: Response) {
  const { body } = valid(req, s.setCommissionSchema);
  res.json({ commissionRateBps: await setCommissionBps(body.commissionRateBps) });
}

export async function listPayouts(req: Request, res: Response) {
  const { query } = valid(req, s.listPayoutsSchema);
  const [list, eligible] = await Promise.all([payouts.listPayouts(query), payouts.eligibleBalances()]);
  res.json({ ...list, eligible });
}

export async function generatePayouts(_req: Request, res: Response) {
  const created = await payouts.generatePayouts();
  res.status(created.length ? 201 : 200).json({ created });
}

export async function markPayoutPaid(req: Request, res: Response) {
  const { params, body } = valid(req, s.markPayoutPaidSchema);
  res.json(await payouts.markPaid(params.id, body.reference));
}

export async function listRefunds(req: Request, res: Response) {
  const { query } = valid(req, s.listRefundsSchema);
  res.json(await refunds.listRefunds(query));
}

export async function approveRefund(req: Request, res: Response) {
  const { params, body } = valid(req, s.approveRefundSchema);
  res.json(await refunds.approveRefund(params.id, body.note));
}

export async function rejectRefund(req: Request, res: Response) {
  const { params, body } = valid(req, s.rejectRefundSchema);
  res.json(await refunds.rejectRefund(params.id, body.note));
}
