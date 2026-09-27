import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { adminCategoriesRouter } from '../categories/categories.routes.js';

/** Admin API. Every route requires the ADMIN role. */
export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));
adminRouter.use('/categories', adminCategoriesRouter);
