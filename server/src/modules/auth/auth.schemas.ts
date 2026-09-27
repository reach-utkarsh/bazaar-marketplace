import { z } from 'zod';
import { requestSchema } from '../../middleware/validate.js';

const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = requestSchema({
  body: z.object({ name: z.string().trim().min(2).max(80), email, password }),
});

export const loginSchema = requestSchema({
  body: z.object({ email, password: z.string().min(1, 'Password is required').max(128) }),
});

export const emptySchema = requestSchema({});
