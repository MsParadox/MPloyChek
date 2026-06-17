// ============================================================
// MPloyChek v4.0 — Analytics Routes Integration Tests
// Covers overview aggregation + audit-log access control.
// ============================================================
jest.mock('../repositories/index');
jest.mock('../repositories/user.repository');
jest.mock('../lib/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: { record: { findMany: jest.fn().mockResolvedValue([]) } },
}));

import express from 'express';
import supertest from 'supertest';
import analyticsRouter from './analytics.routes';
import { recordRepo, candidateRepo, auditRepo } from '../repositories/index';
import { userRepo } from '../repositories/user.repository';
import { ADMIN_TOKEN, VERIFIER_TOKEN, USER_TOKEN, makeSerializedRecord, makeSerializedCandidate } from '../__tests__/helpers/factories';

const app = express();
app.use(express.json());
app.use('/api/analytics', analyticsRouter);
const request = supertest(app);

const mockRecord = recordRepo    as jest.Mocked<typeof recordRepo>;
const mockCand   = candidateRepo as jest.Mocked<typeof candidateRepo>;
const mockAudit  = auditRepo     as jest.Mocked<typeof auditRepo>;
const mockUser   = userRepo      as jest.Mocked<typeof userRepo>;

beforeEach(() => {
  (mockUser.getStats as jest.Mock).mockResolvedValue({ totalUsers: 4, activeUsers: 4, adminUsers: 1, totalRecords: 2, totalCandidates: 1 });
  (mockRecord.findAll as jest.Mock).mockResolvedValue([
    makeSerializedRecord({ status: 'Completed', score: 90, type: 'Employment Verification', priority: 'High', estimatedCost: 1000 }),
    makeSerializedRecord({ id: 'rec2', status: 'Pending', score: null, type: 'Criminal Check', priority: 'Low', estimatedCost: 2000 }),
  ]);
  (mockCand.findAll as jest.Mock).mockResolvedValue([makeSerializedCandidate({ riskLevel: 'High', status: 'Flagged' })]);
  (mockAudit.findAll as jest.Mock).mockResolvedValue([{ id: 'a1', action: 'LOGIN' }]);
});

describe('GET /api/analytics/overview', () => {
  it('200 — returns a full analytics overview for admin', async () => {
    const res = await request.get('/api/analytics/overview').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary.completionRate).toBe(50);   // 1 of 2 completed
    expect(res.body.data.summary.avgScore).toBe(90);          // only the scored record
    expect(res.body.data.summary.highRisk).toBe(1);
    expect(res.body.data.byStatus).toEqual(expect.objectContaining({ Completed: 1, Pending: 1 }));
    expect(res.body.data.monthlyTrends).toHaveLength(6);
  });

  it('200 — verifier can view analytics', async () => {
    const res = await request.get('/api/analytics/overview').set('Authorization', `Bearer ${VERIFIER_TOKEN}`);
    expect(res.status).toBe(200);
  });

  it('403 — general user cannot view analytics', async () => {
    const res = await request.get('/api/analytics/overview').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/analytics/audit-logs', () => {
  it('200 — admin can read the audit log', async () => {
    const res = await request.get('/api/analytics/audit-logs').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('403 — verifier cannot read the audit log', async () => {
    const res = await request.get('/api/analytics/audit-logs').set('Authorization', `Bearer ${VERIFIER_TOKEN}`);
    expect(res.status).toBe(403);
  });
});
