// ============================================================
// MPloyChek v4.0 — Export Routes Integration Tests
// Covers CSV/JSON output, RBAC, and audit logging of exports.
// ============================================================
jest.mock('../repositories/index');
jest.mock('../repositories/user.repository');
jest.mock('../lib/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import express from 'express';
import supertest from 'supertest';
import exportRouter from './export.routes';
import { recordRepo, candidateRepo, auditRepo } from '../repositories/index';
import { ADMIN_TOKEN, USER_TOKEN, makeSerializedRecord, makeSerializedCandidate } from '../__tests__/helpers/factories';

const app = express();
app.use(express.json());
app.use('/api/export', exportRouter);
const request = supertest(app);

const mockRecord = recordRepo    as jest.Mocked<typeof recordRepo>;
const mockCand   = candidateRepo as jest.Mocked<typeof candidateRepo>;
const mockAudit  = auditRepo     as jest.Mocked<typeof auditRepo>;

beforeEach(() => {
  (mockAudit.create   as jest.Mock).mockResolvedValue({});
  (mockRecord.findAll as jest.Mock).mockResolvedValue([makeSerializedRecord({ remarks: 'has "quotes" inside' })]);
  (mockCand.findAll   as jest.Mock).mockResolvedValue([makeSerializedCandidate()]);
  (mockAudit.findAll  as jest.Mock).mockResolvedValue([{ id: 'a1', action: 'LOGIN', performedByName: 'X', targetType: 'User', targetId: 'u', details: 'd', success: true, timestamp: new Date().toISOString() }]);
});

describe('GET /api/export/records', () => {
  it('200 — JSON export by default', async () => {
    const res = await request.get('/api/export/records').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockAudit.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'EXPORT_CREATED' }));
  });

  it('200 — CSV export sets the right headers and escapes quotes', async () => {
    const res = await request.get('/api/export/records?format=csv').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('mploychek-records.csv');
    // embedded double-quotes are doubled per RFC 4180
    expect(res.text).toContain('""quotes""');
  });

  it('non-privileged user only exports their own records', async () => {
    await request.get('/api/export/records').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(mockRecord.findAll).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'user-uuid-usr-000001' }));
  });
});

describe('GET /api/export/candidates', () => {
  it('200 — admin can export candidates as CSV', async () => {
    const res = await request.get('/api/export/candidates?format=csv').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('403 — general user cannot export all candidates', async () => {
    const res = await request.get('/api/export/candidates').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/export/audit-logs', () => {
  it('200 — admin exports the audit log as CSV', async () => {
    const res = await request.get('/api/export/audit-logs').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('403 — general user cannot export the audit log', async () => {
    const res = await request.get('/api/export/audit-logs').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(403);
  });
});
