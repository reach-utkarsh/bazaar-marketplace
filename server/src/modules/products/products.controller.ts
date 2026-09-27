import type { Request, Response } from 'express';
import { currentVendor } from '../../middleware/auth.js';
import { valid } from '../../middleware/validate.js';
import {
  createProductSchema,
  deleteImageSchema,
  deleteProductSchema,
  listProductsSchema,
  productBySlugSchema,
  updateProductSchema,
  uploadImagesSchema,
  vendorGetProductSchema,
  vendorListProductsSchema,
} from './products.schemas.js';
import * as service from './products.service.js';

export async function list(req: Request, res: Response) {
  const { query } = valid(req, listProductsSchema);
  res.json(await service.listCatalog(query));
}

export async function bySlug(req: Request, res: Response) {
  const { params } = valid(req, productBySlugSchema);
  res.json(await service.getBySlug(params.slug));
}

export async function vendorList(req: Request, res: Response) {
  const { query } = valid(req, vendorListProductsSchema);
  res.json(await service.vendorList(currentVendor(req).id, query));
}

export async function vendorGet(req: Request, res: Response) {
  const { params } = valid(req, vendorGetProductSchema);
  res.json(await service.vendorGet(currentVendor(req).id, params.id));
}

export async function create(req: Request, res: Response) {
  const { body } = valid(req, createProductSchema);
  res.status(201).json(await service.create(currentVendor(req).id, body));
}

export async function update(req: Request, res: Response) {
  const { params, body } = valid(req, updateProductSchema);
  res.json(await service.update(currentVendor(req).id, params.id, body));
}

export async function remove(req: Request, res: Response) {
  const { params } = valid(req, deleteProductSchema);
  res.json(await service.remove(currentVendor(req).id, params.id));
}

export async function uploadImages(req: Request, res: Response) {
  const { params } = valid(req, uploadImagesSchema);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  res.status(201).json(await service.addImages(currentVendor(req).id, params.id, files));
}

export async function removeImage(req: Request, res: Response) {
  const { params } = valid(req, deleteImageSchema);
  res.json(await service.removeImage(currentVendor(req).id, params.id, params.imageId));
}
