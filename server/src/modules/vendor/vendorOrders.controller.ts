import type { Request, Response } from 'express';
import { currentVendor } from '../../middleware/auth.js';
import { valid } from '../../middleware/validate.js';
import { getVendorOrderSchema, listVendorOrdersSchema, updateVendorOrderStatusSchema } from './vendorOrders.schemas.js';
import * as service from './vendorOrders.service.js';

export async function list(req: Request, res: Response) {
  const { query } = valid(req, listVendorOrdersSchema);
  res.json(await service.listVendorOrders(currentVendor(req).id, query));
}

export async function get(req: Request, res: Response) {
  const { params } = valid(req, getVendorOrderSchema);
  res.json(await service.getVendorOrder(currentVendor(req).id, params.id));
}

export async function updateStatus(req: Request, res: Response) {
  const { params, body } = valid(req, updateVendorOrderStatusSchema);
  res.json(await service.updateStatus(currentVendor(req).id, params.id, body));
}
