import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as ctrl from './cart.controller.js';
import { addItemSchema, clearCartSchema, getCartSchema, removeItemSchema, updateItemSchema } from './cart.schemas.js';

export const cartRouter = Router();
cartRouter.use(authenticate, requireRole('CUSTOMER'));
cartRouter.get('/', validate(getCartSchema), ctrl.get);
cartRouter.post('/items', validate(addItemSchema), ctrl.add);
cartRouter.patch('/items/:productId', validate(updateItemSchema), ctrl.update);
cartRouter.delete('/items/:productId', validate(removeItemSchema), ctrl.remove);
cartRouter.delete('/', validate(clearCartSchema), ctrl.clear);
