import { Router } from 'express';
import { imageUpload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as ctrl from './products.controller.js';
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

export const productsRouter = Router();
productsRouter.get('/', validate(listProductsSchema), ctrl.list);
productsRouter.get('/:slug', validate(productBySlugSchema), ctrl.bySlug);

/** Mounted under /vendor/products (auth + approved-vendor applied by the vendor router). */
export const vendorProductsRouter = Router();
vendorProductsRouter.get('/', validate(vendorListProductsSchema), ctrl.vendorList);
vendorProductsRouter.post('/', validate(createProductSchema), ctrl.create);
vendorProductsRouter.get('/:id', validate(vendorGetProductSchema), ctrl.vendorGet);
vendorProductsRouter.patch('/:id', validate(updateProductSchema), ctrl.update);
vendorProductsRouter.delete('/:id', validate(deleteProductSchema), ctrl.remove);
vendorProductsRouter.post('/:id/images', imageUpload.array('images', 8), validate(uploadImagesSchema), ctrl.uploadImages);
vendorProductsRouter.delete('/:id/images/:imageId', validate(deleteImageSchema), ctrl.removeImage);
