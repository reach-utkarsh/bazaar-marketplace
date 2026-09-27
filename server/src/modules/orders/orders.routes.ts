import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as ctrl from './orders.controller.js';
import { checkoutSchema, orderIdSchema } from './orders.schemas.js';

export const ordersRouter = Router();
ordersRouter.use(authenticate, requireRole('CUSTOMER'));
ordersRouter.post('/checkout', validate(checkoutSchema), ctrl.checkout);
ordersRouter.get('/:id', validate(orderIdSchema), ctrl.get);
ordersRouter.post('/:id/payment', validate(orderIdSchema), ctrl.payment);
ordersRouter.post('/:id/cancel', validate(orderIdSchema), ctrl.cancel);
