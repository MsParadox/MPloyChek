// ============================================================
// MPloyChek v4.0 — Prisma Mock (unit tests)
// Replaces the real PrismaClient with jest.fn() stubs
// Usage: jest.mock('../lib/prisma')  → auto-routes here
// ============================================================
const createMockMethod = () => jest.fn().mockResolvedValue(null);

const prismaMock = {
  user:         { findMany: createMockMethod(), findUnique: createMockMethod(), create: createMockMethod(), update: createMockMethod(), delete: createMockMethod(), count: createMockMethod(), aggregate: createMockMethod(), groupBy: createMockMethod() },
  candidate:    { findMany: createMockMethod(), findUnique: createMockMethod(), create: createMockMethod(), update: createMockMethod(), delete: createMockMethod(), count: createMockMethod() },
  record:       { findMany: createMockMethod(), findUnique: createMockMethod(), create: createMockMethod(), update: createMockMethod(), delete: createMockMethod(), count: createMockMethod(), aggregate: createMockMethod(), groupBy: createMockMethod() },
  document:     { findMany: createMockMethod(), findUnique: createMockMethod(), create: createMockMethod(), delete: createMockMethod() },
  notification: { findMany: createMockMethod(), create: createMockMethod(), createMany: createMockMethod(), update: createMockMethod(), updateMany: createMockMethod(), count: createMockMethod() },
  auditLog:     { create: createMockMethod(), findMany: createMockMethod(), createMany: createMockMethod() },
  refreshToken: { create: createMockMethod(), findUnique: createMockMethod(), update: createMockMethod(), updateMany: createMockMethod(), deleteMany: createMockMethod() },
  timelineEvent:{ create: createMockMethod(), findMany: createMockMethod() },
  education:    { create: createMockMethod(), findMany: createMockMethod() },
  employment:   { create: createMockMethod(), findMany: createMockMethod() },
  $connect:     jest.fn().mockResolvedValue(undefined),
  $disconnect:  jest.fn().mockResolvedValue(undefined),
  $transaction: jest.fn().mockImplementation((arg: any) => {
    if (typeof arg === 'function') return arg(prismaMock);
    return Promise.all(arg);
  }),
};

// Reset all mocks between tests
beforeEach(() => {
  Object.values(prismaMock).forEach((model: any) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((fn: any) => {
        if (jest.isMockFunction(fn)) fn.mockResolvedValue(null);
      });
    }
  });
});

export default prismaMock;
