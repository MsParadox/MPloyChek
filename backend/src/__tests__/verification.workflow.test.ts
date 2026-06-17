// ============================================================
// MPloyChek v4.0 — Verification Workflow E2E Test
// Walks the full lifecycle: Pending → In Review →
//   Verification Running → Approved (happy path)
//   and Pending → In Review → Verification Running → Rejected
// ============================================================
jest.mock('../repositories/index');
jest.mock('../repositories/user.repository');
jest.mock('../lib/email');
jest.mock('../lib/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../lib/ws-notify', () => ({ notifyUser: jest.fn() }));

import express      from 'express';
import supertest    from 'supertest';
import recordsRouter from '../routes/records.routes';
import { recordRepo, auditRepo } from '../repositories/index';
import { userRepo }               from '../repositories/user.repository';
import { ADMIN_TOKEN, makeSerializedRecord, makeSerializedUser } from './helpers/factories';

const app = express();
app.use(express.json());
app.use('/api/records', recordsRouter);
const request = supertest(app);

const mock = {
  find:   recordRepo.findById  as jest.Mock,
  update: recordRepo.update    as jest.Mock,
  audit:  auditRepo.create     as jest.Mock,
  user:   userRepo.findById    as jest.Mock,
};

const AUTH = { Authorization: `Bearer ${ADMIN_TOKEN}` };

function setupRecord(status: string) {
  mock.find.mockResolvedValue(
    makeSerializedRecord({ status, ownerId: 'user-uuid-admin-0001' })
  );
  mock.update.mockImplementation(async (_id, data) =>
    makeSerializedRecord({ status: data.status, ownerId: 'user-uuid-admin-0001' })
  );
  mock.user.mockResolvedValue(makeSerializedUser());
  mock.audit.mockResolvedValue({});
}

async function transition(to: string) {
  return request.patch('/api/records/rec-uuid-001').set(AUTH).send({ status: to });
}

describe('Happy Path — Pending → Approved', () => {
  it('Stage 1: Pending → In Review', async () => {
    setupRecord('Pending');
    const res = await transition('In Review');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('In Review');
  });

  it('Stage 2: In Review → Verification Running', async () => {
    setupRecord('In Review');
    const res = await transition('Verification Running');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Verification Running');
  });

  it('Stage 3: Verification Running → Approved', async () => {
    setupRecord('Verification Running');
    const res = await transition('Approved');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Approved');
  });

  it('Stage 4: Approved is terminal — all further updates blocked', async () => {
    setupRecord('Approved');
    const res = await transition('In Review');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('terminal');
    expect(mock.update).not.toHaveBeenCalled();
  });

  it('Stage 4b: Approved — even score updates are blocked', async () => {
    setupRecord('Approved');
    const res = await request.patch('/api/records/rec-uuid-001')
      .set(AUTH).send({ score: 95, remarks: 'Excellent profile' });
    expect(res.status).toBe(400);
  });
});

describe('Rejection Path — Pending → Rejected', () => {
  it('Pending → In Review → Verification Running → Rejected', async () => {
    // Stage 1
    setupRecord('Pending');
    let res = await transition('In Review');
    expect(res.status).toBe(200);

    // Stage 2
    setupRecord('In Review');
    res = await transition('Verification Running');
    expect(res.status).toBe(200);

    // Stage 3 — reject
    setupRecord('Verification Running');
    res = await request.patch('/api/records/rec-uuid-001')
      .set(AUTH)
      .send({ status: 'Rejected', remarks: 'Criminal record found during check', score: 12 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Rejected');
  });

  it('Rejection emits CANDIDATE_REJECTED audit event', async () => {
    setupRecord('Verification Running');
    await request.patch('/api/records/rec-uuid-001')
      .set(AUTH).send({ status: 'Rejected', remarks: 'Failed background check' });
    expect(mock.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CANDIDATE_REJECTED', success: true })
    );
  });
});

describe('Hold and Resume Path', () => {
  it('In Review → On Hold → In Review (resume)', async () => {
    setupRecord('In Review');
    let res = await transition('On Hold');
    expect(res.status).toBe(200);

    setupRecord('On Hold');
    res = await transition('In Review');
    expect(res.status).toBe(200);
  });

  it('Pending → Cancelled (terminate without processing)', async () => {
    setupRecord('Pending');
    const res = await transition('Cancelled');
    expect(res.status).toBe(200);

    // Cancelled is terminal
    setupRecord('Cancelled');
    const r2 = await transition('Pending');
    expect(r2.status).toBe(400);
  });
});

describe('Concurrent update protection', () => {
  it('returns 404 when record is deleted mid-workflow', async () => {
    mock.find.mockResolvedValue(null);
    const res = await transition('In Review');
    expect(res.status).toBe(404);
  });
});
