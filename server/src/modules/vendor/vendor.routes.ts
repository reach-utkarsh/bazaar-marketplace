import { Router } from 'express';
import { authenticate, requireApprovedVendor } from '../../middleware/auth.js';
import { vendorProductsRouter } from '../products/products.routes.js';

/** Vendor dashboard API. Every route requires an APPROVED vendor account. */
export const vendorRouter = Router();
vendorRouter.use(authenticate, requireApprovedVendor);
vendorRouter.use('/products', vendorProductsRouter);
