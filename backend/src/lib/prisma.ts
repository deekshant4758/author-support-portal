import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __bookleafPrisma: PrismaClient | undefined;
}

/** Reuse a single Prisma client across hot reloads (tsx watch) in development. */
export const prisma =
  global.__bookleafPrisma ??
  new PrismaClient({
    log: env.isProduction ? ['error'] : ['error', 'warn'],
  });

if (!env.isProduction) {
  global.__bookleafPrisma = prisma;
}
