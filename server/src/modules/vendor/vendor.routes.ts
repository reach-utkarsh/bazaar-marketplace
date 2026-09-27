import { Router } from 'express';
import { authenticate, requireApprovedVendor } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { vendorProductsRouter } from '../products/products.routes.js';
import * as orders from './vendorOrders.controller.js';
import { getVendorOrderSchema, listVendorOrdersSchema, updateVendorOrderStatusSchema } from './vendorOrders.schemas.js';

/** Vendor dashboard API. Every route requires an APPROVED vendor account. */
export const vendorRouter = Router();
vendorRouter.use(authenticate, requireApprovedVendor);
vendorRouter.use('/products', vendorProductsRouter);
vendorRouter.get('/orders', validate(listVendorOrdersSchema), orders.list);
vendorRouter.get('/orders/:id', validate(getVendorOrderSchema), orders.get);
vendorRouter.patch('/orders/:id/status', validate(updateVendorOrderStatusSchema), orders.updateStatus);
