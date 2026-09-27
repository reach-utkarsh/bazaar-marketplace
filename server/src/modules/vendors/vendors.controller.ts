import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth.js';
import { valid } from '../../middleware/validate.js';
import { applySchema, storeSchema } from './vendors.schemas.js';
import * as service from './vendors.service.js';

export async function apply(req: Request, res: Response) {
  const { body } = valid(req, applySchema);
  res.status(201).json(await service.apply(currentUser(req).id, body));
}

export async function mine(req: Request, res: Response) {
  res.json({ vendor: await service.getMine(currentUser(req).id) });
}

export async function store(req: Request, res: Response) {
  const { params } = valid(req, storeSchema);
  res.json(await service.getStore(params.slug));
}
