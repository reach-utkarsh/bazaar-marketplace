import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth.js';
import { valid } from '../../middleware/validate.js';
import { addItemSchema, removeItemSchema, updateItemSchema } from './cart.schemas.js';
import * as service from './cart.service.js';

export async function get(req: Request, res: Response) {
  res.json(await service.getCart(currentUser(req).id));
}

export async function add(req: Request, res: Response) {
  const { body } = valid(req, addItemSchema);
  res.status(201).json(await service.addItem(currentUser(req).id, body.productId, body.quantity));
}

export async function update(req: Request, res: Response) {
  const { params, body } = valid(req, updateItemSchema);
  res.json(await service.updateItem(currentUser(req).id, params.productId, body.quantity));
}

export async function remove(req: Request, res: Response) {
  const { params } = valid(req, removeItemSchema);
  res.json(await service.removeItem(currentUser(req).id, params.productId));
}

export async function clear(req: Request, res: Response) {
  res.json(await service.clear(currentUser(req).id));
}
