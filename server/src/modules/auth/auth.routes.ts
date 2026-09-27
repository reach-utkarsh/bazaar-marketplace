import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authRateLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as ctrl from './auth.controller.js';
import { emptySchema, loginSchema, registerSchema } from './auth.schemas.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validate(registerSchema), ctrl.register);
authRouter.post('/login', authRateLimiter, validate(loginSchema), ctrl.login);
authRouter.post('/refresh', authRateLimiter, validate(emptySchema), ctrl.refresh);
authRouter.post('/logout', validate(emptySchema), ctrl.logout);
authRouter.get('/me', authenticate, validate(emptySchema), ctrl.me);
