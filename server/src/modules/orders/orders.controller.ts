import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth.js';
import { valid } from '../../middleware/validate.js';
import { checkout as checkoutOrder, resumePayment } from './checkout.service.js';
import { checkoutSchema, orderIdSchema } from './orders.schemas.js';
import * as service from './orders.service.js';

export async function checkout(req: Request, res: Response) {
  const { body } = valid(req, checkoutSchema);
  res.status(201).json(await checkoutOrder(currentUser(req).id, body.address));
}

export async function get(req: Request, res: Response) {
  const { params } = valid(req, orderIdSchema);
  res.json(await service.getCustomerOrder(currentUser(req).id, params.id));
}

export async function payment(req: Request, res: Response) {
  const { params } = valid(req, orderIdSchema);
  res.json(await resumePayment(currentUser(req).id, params.id));
}

export async function cancel(req: Request, res: Response) {
  const { params } = valid(req, orderIdSchema);
  res.json(await service.cancelUnpaidOrder(currentUser(req).id, params.id));
}
