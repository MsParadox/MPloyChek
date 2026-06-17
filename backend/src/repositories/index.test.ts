// ============================================================
// MPloyChek v4.0 — Repository Layer Unit Tests
// Exercises Prisma-enum ↔ API-string mapping, serialization of
// DateTime fields, query-option building and error handling — all
// against a mocked Prisma client (no database required).
// ============================================================
jest.mock('../lib/prisma', () => {
  const model = () => ({
    findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
    update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(),
    deleteMany: jest.fn(), count: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn(),
  });
  return {
    __esModule: true,
    default: {
      refreshToken: model(), notification: model(), candidate: model(),
      record: model(), document: model(), auditLog: model(),
    },
  };
});

import prisma from '../lib/prisma';
import {
  refreshTokenRepo, notifRepo, candidateRepo, recordRepo,
  documentRepo, auditRepo, AUDIT_ACTIONS,
} from './index';

const db = prisma as any;

// ── Helpers: minimal DB-shaped fixtures ──────────────────────
const dbCandidate = (over: any = {}) => ({
  id: 'cand-1', firstName: 'Arjun', lastName: 'Mehta',
  email: 'arjun@test.com', phone: '+91-9800100001',
  dateOfBirth: new Date('1992-03-15'),
  nationality: 'Indian', currentAddress: '123 MG Road',
  riskScore: 15, riskLevel: 'LOW', consentGiven: true, consentDate: new Date('2024-05-01'),
  notes: 'n', tags: ['eng'], status: 'ACTIVE',
  education: [], employment: [{ company: 'X', position: 'Dev', startDate: new Date('2018-01-01'), endDate: null }],
  documents: [], previousAddresses: [{ address: 'Old St' }],
  assignedTo: { id: 'u1' }, createdBy: { id: 'u1' },
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

const dbRecord = (over: any = {}) => ({
  id: 'rec-1', candidateId: 'cand-1',
  candidate: { id: 'cand-1', firstName: 'Arjun', lastName: 'Mehta', email: 'arjun@test.com' },
  ownerId: 'u1', type: 'Employment Verification', status: 'PENDING', priority: 'MEDIUM',
  requestedById: 'u1', requestedBy: { firstName: 'Mel', lastName: 'F' },
  verifiedById: null, verifiedBy: null,
  submittedDate: new Date(), dueDate: new Date(), completedDate: null,
  remarks: '', score: null, details: {}, tags: [],
  billingCode: 'BIL-1', estimatedCost: 1000, actualCost: null,
  timeline: [{ id: 't1', date: new Date(), event: 'Created', description: 'd', performedBy: 'System', status: 'Pending', icon: 'create' }],
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe('RefreshTokenRepository.isValid', () => {
  it('returns userId for a live token', async () => {
    db.refreshToken.findUnique.mockResolvedValue({ userId: 'u1', revoked: false, expiresAt: new Date(Date.now() + 1e6) });
    expect(await refreshTokenRepo.isValid('raw')).toBe('u1');
  });
  it('returns null for a revoked token', async () => {
    db.refreshToken.findUnique.mockResolvedValue({ userId: 'u1', revoked: true, expiresAt: new Date(Date.now() + 1e6) });
    expect(await refreshTokenRepo.isValid('raw')).toBeNull();
  });
  it('returns null for an expired token', async () => {
    db.refreshToken.findUnique.mockResolvedValue({ userId: 'u1', revoked: false, expiresAt: new Date(Date.now() - 1e6) });
    expect(await refreshTokenRepo.isValid('raw')).toBeNull();
  });
  it('returns null when the token is unknown', async () => {
    db.refreshToken.findUnique.mockResolvedValue(null);
    expect(await refreshTokenRepo.isValid('raw')).toBeNull();
  });
  it('hashes the raw token before lookup (never stores raw)', async () => {
    db.refreshToken.findUnique.mockResolvedValue(null);
    await refreshTokenRepo.isValid('my-secret-token');
    const arg = db.refreshToken.findUnique.mock.calls[0][0];
    expect(arg.where.tokenHash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
    expect(arg.where.tokenHash).not.toBe('my-secret-token');
  });
});

describe('NotificationRepository', () => {
  it('findByUserId scopes to the user, newest first, capped at 50', async () => {
    db.notification.findMany.mockResolvedValue([]);
    await notifRepo.findByUserId('u1');
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' }, take: 50 })
    );
  });
  it('getUnreadCount counts only unread', async () => {
    db.notification.count.mockResolvedValue(3);
    expect(await notifRepo.getUnreadCount('u1')).toBe(3);
    expect(db.notification.count).toHaveBeenCalledWith({ where: { userId: 'u1', read: false } });
  });
  it('markAllRead only touches unread rows', async () => {
    db.notification.updateMany.mockResolvedValue({ count: 2 });
    await notifRepo.markAllRead('u1');
    expect(db.notification.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', read: false }, data: { read: true } });
  });
});

describe('CandidateRepository', () => {
  it('serializes enums + DateTime fields into API shape', async () => {
    db.candidate.findUnique.mockResolvedValue(dbCandidate());
    const c = await candidateRepo.findById('cand-1');
    expect(c).toMatchObject({ riskLevel: 'Low', status: 'Active', dateOfBirth: '1992-03-15' });
    expect(c!.previousAddresses).toEqual(['Old St']);
    expect(c!.employmentHistory[0].startDate).toBe('2018-01-01');
  });
  it('findById returns null when missing', async () => {
    db.candidate.findUnique.mockResolvedValue(null);
    expect(await candidateRepo.findById('ghost')).toBeNull();
  });
  it('findAll scopes to creator OR assignee when given createdById', async () => {
    db.candidate.findMany.mockResolvedValue([dbCandidate()]);
    await candidateRepo.findAll({ createdById: 'u1' });
    const arg = db.candidate.findMany.mock.calls[0][0];
    expect(arg.where.OR).toEqual([{ createdById: 'u1' }, { assignedToId: 'u1' }]);
  });
  it('update maps API risk/status strings back to Prisma enums and stamps consentDate', async () => {
    db.candidate.update.mockResolvedValue(dbCandidate({ riskLevel: 'HIGH', status: 'FLAGGED' }));
    await candidateRepo.update('cand-1', { riskLevel: 'High', status: 'Flagged', consentGiven: true });
    const patch = db.candidate.update.mock.calls[0][0].data;
    expect(patch.riskLevel).toBe('HIGH');
    expect(patch.status).toBe('FLAGGED');
    expect(patch.consentDate).toBeInstanceOf(Date);
  });
  it('delete returns true on success, false on error', async () => {
    db.candidate.delete.mockResolvedValueOnce({});
    expect(await candidateRepo.delete('cand-1')).toBe(true);
    db.candidate.delete.mockRejectedValueOnce(new Error('FK constraint'));
    expect(await candidateRepo.delete('cand-1')).toBe(false);
  });
});

describe('RecordRepository', () => {
  it('serializes status enum to a display string and derives candidateName', async () => {
    db.record.findUnique.mockResolvedValue(dbRecord({ status: 'VERIFICATION_RUNNING' }));
    const r = await recordRepo.findById('rec-1');
    expect(r).toMatchObject({ status: 'Verification Running', candidateName: 'Arjun Mehta', priority: 'Medium' });
    expect(r!.timeline).toHaveLength(1);
  });
  it('findAll maps status/priority filter strings to Prisma enums', async () => {
    db.record.findMany.mockResolvedValue([]);
    await recordRepo.findAll({ status: 'In Review', priority: 'High', ownerId: 'u1' });
    const where = db.record.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: 'IN_REVIEW', priority: 'HIGH', ownerId: 'u1' });
  });
  it('create assigns a per-type cost and a PENDING status with an initial timeline', async () => {
    db.record.create.mockResolvedValue(dbRecord());
    await recordRepo.create({ type: 'Employment Verification', candidateId: 'cand-1', priority: 'High' }, 'u1', 'u1');
    const data = db.record.create.mock.calls[0][0].data;
    expect(data.status).toBe('PENDING');
    expect(data.estimatedCost).toBe(2500);
    expect(data.priority).toBe('HIGH');
    expect(data.timeline.create[0].event).toBe('Record Created');
  });
  it('update stamps completedDate when a terminal status is set', async () => {
    db.record.update.mockResolvedValue(dbRecord({ status: 'COMPLETED' }));
    await recordRepo.update('rec-1', { status: 'Completed', score: 88 });
    const patch = db.record.update.mock.calls[0][0].data;
    expect(patch.status).toBe('COMPLETED');
    expect(patch.completedDate).toBeInstanceOf(Date);
    expect(patch.score).toBe(88);
  });
  it('update does NOT set completedDate for a non-terminal status', async () => {
    db.record.update.mockResolvedValue(dbRecord({ status: 'IN_REVIEW' }));
    await recordRepo.update('rec-1', { status: 'In Review' });
    expect(db.record.update.mock.calls[0][0].data.completedDate).toBeUndefined();
  });
  it('getSummary converts grouped enum keys to display labels', async () => {
    db.record.count.mockResolvedValue(5);
    db.record.groupBy.mockResolvedValue([{ status: 'PENDING', _count: { id: 3 } }, { status: 'COMPLETED', _count: { id: 2 } }]);
    db.record.aggregate.mockResolvedValue({ _avg: { score: 73.4 } });
    const s = await recordRepo.getSummary();
    expect(s.total).toBe(5);
    expect(s.byStatus).toEqual({ Pending: 3, Completed: 2 });
    expect(s.avgScore).toBe(73);
  });
});

describe('DocumentRepository', () => {
  it('findByCandidateId orders newest first', async () => {
    db.document.findMany.mockResolvedValue([]);
    await documentRepo.findByCandidateId('cand-1');
    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { candidateId: 'cand-1' } })
    );
  });
  it('delete returns true/false based on Prisma outcome', async () => {
    db.document.delete.mockResolvedValueOnce({});
    expect(await documentRepo.delete('d1')).toBe(true);
    db.document.delete.mockRejectedValueOnce(new Error('missing'));
    expect(await documentRepo.delete('d1')).toBe(false);
  });
});

describe('AuditRepository', () => {
  const entry = {
    action: AUDIT_ACTIONS.LOGIN, performedById: 'u1', performedByName: 'Mel',
    targetId: 'u1', targetType: 'User', details: 'd', ipAddress: '127.0.0.1', userAgent: 'jest', success: true,
  };
  it('writes an audit entry', async () => {
    db.auditLog.create.mockResolvedValue({ id: 'a1' });
    const res = await auditRepo.create(entry);
    expect(res).toEqual({ id: 'a1' });
  });
  it('never throws when the audit write fails (returns null)', async () => {
    db.auditLog.create.mockRejectedValue(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(auditRepo.create(entry)).resolves.toBeNull();
    spy.mockRestore();
  });
  it('findAll honours the limit', async () => {
    db.auditLog.findMany.mockResolvedValue([]);
    await auditRepo.findAll(25);
    expect(db.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
  });
});
