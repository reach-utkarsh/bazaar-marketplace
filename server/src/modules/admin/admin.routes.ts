import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { adminCategoriesRouter } from '../categories/categories.routes.js';
import * as c from './admin.controller.js';
import * as s from './admin.schemas.js';

/** Admin API. Every route requires the ADMIN role. */
export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));

adminRouter.get('/dashboard', validate(s.dashboardSchema), c.dashboard);
adminRouter.use('/categories', adminCategoriesRouter);

adminRouter.get('/vendors', validate(s.listVendorsSchema), c.listVendors);
adminRouter.post('/vendors/:id/approve', validate(s.approveVendorSchema), c.approveVendor);
adminRouter.post('/vendors/:id/reject', validate(s.rejectVendorSchema), c.rejectVendor);

adminRouter.get('/orders', validate(s.listOrdersSchema), c.listOrders);
adminRouter.get('/orders/:id', validate(s.getOrderSchema), c.getOrder);

adminRouter.get('/settings', validate(s.getSettingsSchema), c.getSettings);
adminRouter.patch('/settings/commission', validate(s.setCommissionSchema), c.setCommission);

adminRouter.get('/payouts', validate(s.listPayoutsSchema), c.listPayouts);
adminRouter.post('/payouts/generate', validate(s.generatePayoutsSchema), c.generatePayouts);
adminRouter.post('/payouts/:id/mark-paid', validate(s.markPayoutPaidSchema), c.markPayoutPaid);

adminRouter.get('/refunds', validate(s.listRefundsSchema), c.listRefunds);
adminRouter.post('/refunds/:id/approve', validate(s.approveRefundSchema), c.approveRefund);
adminRouter.post('/refunds/:id/reject', validate(s.rejectRefundSchema), c.rejectRefund);
