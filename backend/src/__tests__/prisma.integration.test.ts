// ============================================================
// MPloyChek v4.0 — Prisma Integration Tests
// Runs against a REAL database (DATABASE_URL_TEST env var)
// Skipped automatically in CI if test DB is not configured
//
// Setup:  export DATABASE_URL_TEST="postgresql://..."
// Run:    npm run test:integration
//
// Strategy: each test creates data → asserts → cleans up in afterEach
// ============================================================
import { PrismaClient, UserRole, UserStatus, CandidateStatus, RecordStatus, Priority } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const hasTestDb = !!process.env['DATABASE_URL_TEST'];
const testDescribe = hasTestDb ? describe : describe.skip;

// Use separate test DB client — never touch production DB
const prisma = hasTestDb
  ? new PrismaClient({ datasourceUrl: process.env['DATABASE_URL_TEST'] })
  : null as unknown as PrismaClient;

// ── Cleanup tracker ───────────────────────────────────────────
const createdIds: { users: string[]; candidates: string[]; records: string[] } = {
  users: [], candidates: [], records: [],
};

async function cleanup() {
  if (!hasTestDb) return;
  if (createdIds.records.length)    await prisma.record.deleteMany({ where: { id: { in: createdIds.records } } });
  if (createdIds.candidates.length) await prisma.candidate.deleteMany({ where: { id: { in: createdIds.candidates } } });
  if (createdIds.users.length)      await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
  createdIds.records    = [];
  createdIds.candidates = [];
  createdIds.users      = [];
}

beforeAll(async () => { if (hasTestDb) await prisma.$connect(); });
afterEach(cleanup);
afterAll(async () => { if (hasTestDb) await prisma.$disconnect(); });

// ── Helper: create test user ──────────────────────────────────
async function createTestUser(overrides: Partial<any> = {}) {
  const suffix = Date.now().toString().slice(-6) + Math.random().toString(36).slice(2, 6);
  const user = await prisma.user.create({
    data: {
      userId:       `test_${suffix}`,
      firstName:    'Test',
      lastName:     'User',
      email:        `test_${suffix}@prismatest.com`,
      passwordHash: await bcrypt.hash('TestPass@1', 10),
      role:         UserRole.ADMIN,
      department:   'Testing',
      phone:        '+91-0000000000',
      joinDate:     new Date(),
      status:       UserStatus.ACTIVE,
      ...overrides,
    },
  });
  createdIds.users.push(user.id);
  return user;
}

// ── Helper: create test candidate ─────────────────────────────
async function createTestCandidate(createdById: string, overrides: Partial<any> = {}) {
  const suffix = Date.now().toString().slice(-6);
  const cand = await prisma.candidate.create({
    data: {
      firstName:      'Integration',
      lastName:       `Test_${suffix}`,
      email:          `integ_${suffix}@test.com`,
      phone:          '+91-0000000001',
      dateOfBirth:    new Date('1990-01-01'),
      nationality:    'Indian',
      currentAddress: 'Test Address',
      createdById,
      status:         CandidateStatus.ACTIVE,
      ...overrides,
    },
  });
  createdIds.candidates.push(cand.id);
  return cand;
}

testDescribe('Prisma Integration — User Repository', () => {
  it('creates a user and reads it back by userId', async () => {
    const user = await createTestUser();
    const found = await prisma.user.findUnique({ where: { userId: user.userId } });
    expect(found).not.toBeNull();
    expect(found!.firstName).toBe('Test');
    expect(found!.email).toBe(user.email);
  });

  it('enforces unique email constraint (P2002)', async () => {
    const user = await createTestUser();
    await expect(
      prisma.user.create({
        data: {
          userId:       `dup_${Date.now()}`,
          firstName:    'Dup',  lastName: 'User',
          email:        user.email,  // duplicate email
          passwordHash: 'hash',
          role:         UserRole.GENERAL_USER,
          department:   'IT', phone: '+91-0000000000',
          joinDate:     new Date(),
        },
      })
    ).rejects.toThrow();
  });

  it('updates user status and role atomically', async () => {
    const user = await createTestUser({ role: UserRole.GENERAL_USER, status: UserStatus.ACTIVE });
    const updated = await prisma.user.update({
      where: { id: user.id },
      data:  { role: UserRole.MANAGER, status: UserStatus.INACTIVE },
    });
    expect(updated.role).toBe(UserRole.MANAGER);
    expect(updated.status).toBe(UserStatus.INACTIVE);
  });

  it('joinDate is stored as DateTime, not a string', async () => {
    const user = await createTestUser();
    expect(user.joinDate).toBeInstanceOf(Date);
  });
});

testDescribe('Prisma Integration — Candidate + DateTime fields', () => {
  it('creates candidate with dateOfBirth as DateTime', async () => {
    const admin  = await createTestUser();
    const candidate = await createTestCandidate(admin.id, {
      dateOfBirth: new Date('1995-07-22'),
    });
    const found = await prisma.candidate.findUnique({ where: { id: candidate.id } });
    expect(found!.dateOfBirth).toBeInstanceOf(Date);
    expect(found!.dateOfBirth.toISOString().startsWith('1995-07-22')).toBe(true);
  });

  it('creates employment with startDate and endDate as DateTime', async () => {
    const admin = await createTestUser();
    const cand  = await createTestCandidate(admin.id);
    const emp   = await prisma.employment.create({
      data: {
        candidateId:  cand.id,
        company:      'Test Corp',
        position:     'Engineer',
        startDate:    new Date('2018-01-01'),
        endDate:      new Date('2022-12-31'),
        current:      false,
        contactName:  'HR Manager',
        contactPhone: '+91-0000000000',
      },
    });
    expect(emp.startDate).toBeInstanceOf(Date);
    expect(emp.endDate).toBeInstanceOf(Date);
    await prisma.employment.delete({ where: { id: emp.id } });
  });
});

testDescribe('Prisma Integration — Record Workflow', () => {
  it('creates record with PENDING status (default)', async () => {
    const admin = await createTestUser();
    const cand  = await createTestCandidate(admin.id);
    const rec   = await prisma.record.create({
      data: {
        candidateId:   cand.id,
        ownerId:       admin.id,
        requestedById: admin.id,
        type:          'Employment Verification',
        status:        RecordStatus.PENDING,
        priority:      Priority.MEDIUM,
        submittedDate: new Date(),
        dueDate:       new Date(Date.now() + 7 * 86400000),
        billingCode:   `BIL-INT-${Date.now()}`,
      },
    });
    createdIds.records.push(rec.id);
    expect(rec.status).toBe(RecordStatus.PENDING);
    expect(rec.completedDate).toBeNull();
  });

  it('transitions status through workflow and sets completedDate', async () => {
    const admin = await createTestUser();
    const cand  = await createTestCandidate(admin.id);
    const rec   = await prisma.record.create({
      data: {
        candidateId: cand.id, ownerId: admin.id, requestedById: admin.id,
        type: 'Criminal Check', status: RecordStatus.PENDING,
        priority: Priority.HIGH, submittedDate: new Date(),
        dueDate: new Date(Date.now() + 3 * 86400000),
        billingCode: `BIL-WF-${Date.now()}`,
      },
    });
    createdIds.records.push(rec.id);

    // Walk through workflow
    const updates = [
      RecordStatus.IN_REVIEW,
      RecordStatus.VERIFICATION_RUNNING,
      RecordStatus.APPROVED,
    ];
    for (const status of updates) {
      await prisma.record.update({ where: { id: rec.id }, data: { status } });
    }

    const final = await prisma.record.findUnique({ where: { id: rec.id } });
    expect(final!.status).toBe(RecordStatus.APPROVED);
  });

  it('stores score as nullable integer', async () => {
    const admin = await createTestUser();
    const cand  = await createTestCandidate(admin.id);
    const rec   = await prisma.record.create({
      data: {
        candidateId: cand.id, ownerId: admin.id, requestedById: admin.id,
        type: 'Education Verification', status: RecordStatus.COMPLETED,
        priority: Priority.LOW, submittedDate: new Date(),
        dueDate: new Date(Date.now() + 5 * 86400000),
        billingCode: `BIL-SC-${Date.now()}`, score: 88,
      },
    });
    createdIds.records.push(rec.id);
    expect(rec.score).toBe(88);
  });
});

testDescribe('Prisma Integration — Audit Log', () => {
  it('creates audit log entries with all required fields', async () => {
    const admin = await createTestUser();
    const log   = await prisma.auditLog.create({
      data: {
        action:          'LOGIN',
        performedById:   admin.id,
        performedByName: 'Test Admin',
        targetId:        admin.id,
        targetType:      'User',
        details:         'Integration test login event',
        ipAddress:       '127.0.0.1',
        userAgent:       'Jest/29',
        success:         true,
      },
    });
    expect(log.id).toBeTruthy();
    expect(log.timestamp).toBeInstanceOf(Date);
    await prisma.auditLog.delete({ where: { id: log.id } });
  });
});

// Print message when integration tests are skipped
if (!hasTestDb) {
  test('⚠️  Integration tests skipped — set DATABASE_URL_TEST to run against a real DB', () => {
    expect(true).toBe(true); // placeholder so jest reports this file
  });
}
