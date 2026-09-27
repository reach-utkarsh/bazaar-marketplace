import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as ctrl from './categories.controller.js';
import { createCategorySchema, deleteCategorySchema, listCategoriesSchema, updateCategorySchema } from './categories.schemas.js';

export const categoriesRouter = Router();
categoriesRouter.get('/', validate(listCategoriesSchema), ctrl.list);

/** Mounted under /admin (auth + ADMIN role applied by the admin router). */
export const adminCategoriesRouter = Router();
adminCategoriesRouter.post('/', validate(createCategorySchema), ctrl.create);
adminCategoriesRouter.patch('/:id', validate(updateCategorySchema), ctrl.update);
adminCategoriesRouter.delete('/:id', validate(deleteCategorySchema), ctrl.remove);
