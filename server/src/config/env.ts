import 'dotenv/config';
import { z } from 'zod';

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  PAYMENT_EXPIRY_MINUTES: z.coerce.number().int().positive().default(30),

  DEFAULT_COMMISSION_BPS: z.coerce.number().int().min(0).max(5000).default(1000),
  RETURN_WINDOW_DAYS: z.coerce.number().int().min(0).default(7),

  STORAGE_DRIVER: z.enum(['local']).default('local'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),

  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
});

const raw = { ...process.env };
if (isTest) {
  // Tests always run against the dedicated test database, never the dev database.
  raw.NODE_ENV = 'test';
  if (process.env.TEST_DATABASE_URL) raw.DATABASE_URL = process.env.TEST_DATABASE_URL;
  raw.BCRYPT_ROUNDS ??= '4';
  raw.AUTH_RATE_LIMIT_MAX = process.env.TEST_AUTH_RATE_LIMIT_MAX ?? '100000';
  raw.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-long-enough-123456';
  // Force the mock provider in tests so no network calls are made.
  raw.RAZORPAY_KEY_ID = '';
  raw.RAZORPAY_KEY_SECRET = '';
  raw.RAZORPAY_WEBHOOK_SECRET = '';
}

const parsed = envSchema.safeParse(raw);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTestEnv = env.NODE_ENV === 'test';
export const allowedOrigins = env.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean);
