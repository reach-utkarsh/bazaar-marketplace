import type { Request, Response } from 'express';
import { valid } from '../../middleware/validate.js';
import { createCategorySchema, deleteCategorySchema, updateCategorySchema } from './categories.schemas.js';
import * as service from './categories.service.js';

export async function list(_req: Request, res: Response) {
  res.json({ items: await service.listCategories() });
}

export async function create(req: Request, res: Response) {
  const { body } = valid(req, createCategorySchema);
  res.status(201).json(await service.createCategory(body.name));
}

export async function update(req: Request, res: Response) {
  const { params, body } = valid(req, updateCategorySchema);
  res.json(await service.updateCategory(params.id, body.name));
}

export async function remove(req: Request, res: Response) {
  const { params } = valid(req, deleteCategorySchema);
  await service.deleteCategory(params.id);
  res.status(204).end();
}
