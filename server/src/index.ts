import { env } from './config/env.js';
import { createApp } from './app.js';
import { startOrderExpiryJob } from './jobs/expireOrders.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 API listening on http://localhost:${env.PORT}/api`);
});
startOrderExpiryJob();

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
