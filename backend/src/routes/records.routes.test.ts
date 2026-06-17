// ============================================================
// MPloyChek v4.0 — Records Routes Integration Tests
// Priority: workflow state machine (the core business logic)
// ============================================================
jest.mock('../repositories/index');
jest.mock('../repositories/user.repository');
jest.mock('../lib/email');
jest.mock('../lib/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../lib/ws-notify', () => ({ notifyUser: jest.fn() }));

import express      from 'express';
import supertest    from 'supertest';
import recordsRouter from './records.routes';
import { recordRepo, auditRepo } from '../repositories/index';
import { userRepo }               from '../repositories/user.repository';
import {
  ADMIN_TOKEN, MANAGER_TOKEN, USER_TOKEN,
  makeSerializedRecord, makeSerializedUser,
} from '../__tests__/helpers/factories';

const app = express();
app.use(express.json());
app.use('/api/records', recordsRouter);
const request = supertest(app);

const mockRecordRepo = recordRepo as jest.Mocked<typeof recordRepo>;
const mockAudit      = auditRepo  as jest.Mocked<typeof auditRepo>;
const mockUserRepo   = userRepo   as jest.Mocked<typeof userRepo>;

describe('GET /api/records', () => {
  beforeEach(() => {
    (mockRecordRepo.findAll as jest.Mock).mockResolvedValue([makeSerializedRecord()]);
  });

  it('200 — admin can list all records', async () => {
    const res = await request.get('/api/records').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('200 — general user only sees their own records', async () => {
    await request.get('/api/records').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(mockRecordRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'user-uuid-usr-000001' })
    );
  });

  it('401 — rejects unauthenticated request', async () => {
    const res = await request.get('/api/records');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/records', () => {
  const body = {
    candidateId: '550e8400-e29b-41d4-a716-446655440000',
    type: 'Employment Verification',
    priority: 'High',
    dueDate: '2025-12-31',
  };

  beforeEach(() => {
    (mockRecordRepo.create as jest.Mock).mockResolvedValue(makeSerializedRecord());
    (mockAudit.create      as jest.Mock).mockResolvedValue({});
  });

  it('201 — creates record with valid payload', async () => {
    const res = await request.post('/api/records')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('Pending');
  });

  it('400 — rejects invalid record type', async () => {
    const res = await request.post('/api/records')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send({ ...body, type: 'Fake Check' });
    expect(res.status).toBe(400);
    expect(mockRecordRepo.create).not.toHaveBeenCalled();
  });

  it('400 — rejects non-UUID candidateId', async () => {
    const res = await request.post('/api/records')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send({ ...body, candidateId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('writes CREATE_RECORD audit event', async () => {
    await request.post('/api/records')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send(body);
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_RECORD' })
    );
  });
});

// ── WORKFLOW STATE MACHINE TESTS ──────────────────────────────
// This is the most critical business logic in the entire project
describe('PATCH /api/records/:id — Verification Workflow', () => {
  beforeEach(() => {
    (mockAudit.create   as jest.Mock).mockResolvedValue({});
    (mockUserRepo.findById as jest.Mock).mockResolvedValue(makeSerializedUser());
  });

  // ── Valid transitions ──────────────────────────────────────
  const validTransitions: [string, string][] = [
    ['Pending',              'In Review'],
    ['Pending',              'Cancelled'],
    ['In Review',            'Verification Running'],
    ['In Review',            'On Hold'],
    ['Verification Running', 'Approved'],
    ['Verification Running', 'Rejected'],
    ['On Hold',              'In Review'],
    ['In Progress',          'Completed'],
  ];

  validTransitions.forEach(([from, to]) => {
    it(`200 — allows transition: "${from}" → "${to}"`, async () => {
      (mockRecordRepo.findById as jest.Mock).mockResolvedValue(
        makeSerializedRecord({ status: from, ownerId: 'user-uuid-admin-0001' })
      );
      (mockRecordRepo.update as jest.Mock).mockResolvedValue(
        makeSerializedRecord({ status: to })
      );
      const res = await request.patch('/api/records/rec-uuid-001')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: to });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(to);
    });
  });

  // ── Invalid transitions ────────────────────────────────────
  const invalidTransitions: [string, string][] = [
    ['Pending',  'Approved'],        // must go through In Review first
    ['Pending',  'Completed'],       // must go through workflow
    ['In Review','Rejected'],        // must run verification first
    ['Approved', 'In Review'],       // terminal — cannot leave
    ['Rejected', 'Pending'],         // terminal — cannot leave
    ['Completed','In Progress'],     // terminal — cannot leave
  ];

  invalidTransitions.forEach(([from, to]) => {
    it(`400 — blocks invalid transition: "${from}" → "${to}"`, async () => {
      (mockRecordRepo.findById as jest.Mock).mockResolvedValue(
        makeSerializedRecord({ status: from, ownerId: 'user-uuid-admin-0001' })
      );
      const res = await request.patch('/api/records/rec-uuid-001')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: to });
      expect(res.status).toBe(400);
      expect(mockRecordRepo.update).not.toHaveBeenCalled();
    });
  });

  it('400 — cannot update a terminal (Approved) record', async () => {
    (mockRecordRepo.findById as jest.Mock).mockResolvedValue(
      makeSerializedRecord({ status: 'Approved', ownerId: 'user-uuid-admin-0001' })
    );
    const res = await request.patch('/api/records/rec-uuid-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ remarks: 'Trying to update terminal record' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('terminal');
  });

  it('writes CANDIDATE_APPROVED audit event when status → Approved', async () => {
    (mockRecordRepo.findById as jest.Mock).mockResolvedValue(
      makeSerializedRecord({ status: 'Verification Running', ownerId: 'user-uuid-admin-0001' })
    );
    (mockRecordRepo.update as jest.Mock).mockResolvedValue(
      makeSerializedRecord({ status: 'Approved' })
    );
    await request.patch('/api/records/rec-uuid-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ status: 'Approved' });
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CANDIDATE_APPROVED' })
    );
  });

  it('writes CANDIDATE_REJECTED audit event when status → Rejected', async () => {
    (mockRecordRepo.findById as jest.Mock).mockResolvedValue(
      makeSerializedRecord({ status: 'Verification Running', ownerId: 'user-uuid-admin-0001' })
    );
    (mockRecordRepo.update as jest.Mock).mockResolvedValue(
      makeSerializedRecord({ status: 'Rejected' })
    );
    await request.patch('/api/records/rec-uuid-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ status: 'Rejected', remarks: 'Criminal record found' });
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CANDIDATE_REJECTED' })
    );
  });

  it('403 — general user cannot update another user\'s record', async () => {
    (mockRecordRepo.findById as jest.Mock).mockResolvedValue(
      makeSerializedRecord({ status: 'Pending', ownerId: 'other-user-id' })
    );
    const res = await request.patch('/api/records/rec-uuid-001')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send({ status: 'In Review' });
    expect(res.status).toBe(403);
  });

  it('404 — returns 404 for non-existent record', async () => {
    (mockRecordRepo.findById as jest.Mock).mockResolvedValue(null);
    const res = await request.patch('/api/records/ghost-id')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ status: 'In Review' });
    expect(res.status).toBe(404);
  });
});
