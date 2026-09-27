import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth.js';
import { valid } from '../../middleware/validate.js';
import { paymentProvider } from '../../services/payments/index.js';
import { mockPaySchema, verifySchema, webhookSchema } from './payments.schemas.js';
import * as service from './payments.service.js';

export function config(_req: Request, res: Response) {
  res.json(paymentProvider.publicConfig());
}

export async function verify(req: Request, res: Response) {
  const { body } = valid(req, verifySchema);
  res.json(await service.verifyPayment(currentUser(req).id, body));
}

export async function webhook(req: Request, res: Response) {
  const { body } = valid(req, webhookSchema);
  const result = await service.handleWebhook(
    req.rawBody ?? JSON.stringify(req.body),
    req.header('x-razorpay-signature'),
    req.header('x-razorpay-event-id'),
    body,
  );
  res.json(result);
}

export async function mockPay(req: Request, res: Response) {
  const { body } = valid(req, mockPaySchema);
  res.json(await service.mockPay(currentUser(req).id, body.orderId, body.outcome));
}
