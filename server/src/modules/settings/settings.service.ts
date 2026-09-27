import { env } from '../../config/env.js';
import { prisma, type Db } from '../../lib/prisma.js';

export const COMMISSION_KEY = 'commission_rate_bps';

/** Platform commission in basis points (1000 = 10%). Falls back to DEFAULT_COMMISSION_BPS. */
export async function getCommissionBps(db: Db = prisma): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: COMMISSION_KEY } });
  const parsed = row ? Number.parseInt(row.value, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : env.DEFAULT_COMMISSION_BPS;
}

export async function setCommissionBps(bps: number) {
  await prisma.setting.upsert({
    where: { key: COMMISSION_KEY },
    create: { key: COMMISSION_KEY, value: String(bps) },
    update: { value: String(bps) },
  });
  return bps;
}
