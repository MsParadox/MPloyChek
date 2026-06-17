// MPloyChek — Prisma Client Singleton
// Prevents multiple instances in dev (hot reload)
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaConnectionRetryMiddleware?: boolean;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development'
      ? ['query', 'warn', 'error']
      : ['warn', 'error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

function isClosedConnectionError(err: unknown): boolean {
  const anyErr = err as { code?: string; message?: string };
  const message = anyErr?.message || String(err);
  return (
    anyErr?.code === 'P1017' ||
    message.includes('kind: Closed') ||
    message.includes('Server has closed the connection') ||
    message.includes('Connection terminated unexpectedly')
  );
}

if (!globalForPrisma.prismaConnectionRetryMiddleware) {
  prisma.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (err) {
      if (!isClosedConnectionError(err)) throw err;

      console.warn('[Prisma] PostgreSQL connection was closed; reconnecting and retrying once.');
      await prisma.$disconnect().catch(() => undefined);
      await prisma.$connect();
      return next(params);
    }
  });
  globalForPrisma.prismaConnectionRetryMiddleware = true;
}

export default prisma;
