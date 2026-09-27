import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as ctrl from './reviews.controller.js';
import { eligibilitySchema, listReviewsSchema, upsertReviewSchema } from './reviews.schemas.js';

/** Mounted under /products/:id/reviews */
export const reviewsRouter = Router({ mergeParams: true });
reviewsRouter.get('/', validate(listReviewsSchema), ctrl.list);
reviewsRouter.get('/eligibility', authenticate, validate(eligibilitySchema), ctrl.eligibility);
reviewsRouter.post('/', authenticate, requireRole('CUSTOMER'), validate(upsertReviewSchema), ctrl.upsert);
