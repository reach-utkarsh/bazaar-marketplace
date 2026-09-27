import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

let tables: string[] | null = null;

beforeEach(async () => {
  tables ??= (
    await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  ).map((t) => `"public"."${t.tablename}"`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
