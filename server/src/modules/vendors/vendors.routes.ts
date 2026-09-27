import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as ctrl from './vendors.controller.js';
import { applySchema, myVendorSchema, storeSchema } from './vendors.schemas.js';

export const vendorsRouter = Router();
vendorsRouter.post('/apply', authenticate, requireRole('CUSTOMER'), validate(applySchema), ctrl.apply);
vendorsRouter.get('/me', authenticate, validate(myVendorSchema), ctrl.mine);
vendorsRouter.get('/:slug', validate(storeSchema), ctrl.store);
