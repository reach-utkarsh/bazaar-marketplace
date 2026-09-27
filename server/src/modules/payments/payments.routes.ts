import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as ctrl from './payments.controller.js';
import { configSchema, mockPaySchema, verifySchema, webhookSchema } from './payments.schemas.js';

export const paymentsRouter = Router();
paymentsRouter.get('/config', validate(configSchema), ctrl.config);
paymentsRouter.post('/verify', authenticate, requireRole('CUSTOMER'), validate(verifySchema), ctrl.verify);
// Called by the gateway (server-to-server); authenticated by HMAC signature over the raw body.
paymentsRouter.post('/webhook', validate(webhookSchema), ctrl.webhook);
paymentsRouter.post('/mock/pay', authenticate, requireRole('CUSTOMER'), validate(mockPaySchema), ctrl.mockPay);
