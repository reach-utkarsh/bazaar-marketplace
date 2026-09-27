import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth.js';
import { valid } from '../../middleware/validate.js';
import { eligibilitySchema, listReviewsSchema, upsertReviewSchema } from './reviews.schemas.js';
import * as service from './reviews.service.js';

export async function list(req: Request, res: Response) {
  const { params, query } = valid(req, listReviewsSchema);
  res.json(await service.listReviews(params.id, query.page, query.limit));
}

export async function eligibility(req: Request, res: Response) {
  const { params } = valid(req, eligibilitySchema);
  res.json(await service.eligibility(currentUser(req).id, params.id));
}

export async function upsert(req: Request, res: Response) {
  const { params, body } = valid(req, upsertReviewSchema);
  res.status(201).json(await service.upsertReview(currentUser(req).id, params.id, body));
}
