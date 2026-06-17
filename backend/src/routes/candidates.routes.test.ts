// ============================================================
// MPloyChek v4.0 — Candidates Routes Integration Tests
// ============================================================
jest.mock('../repositories/index');
jest.mock('../repositories/user.repository');
jest.mock('../lib/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import express        from 'express';
import supertest      from 'supertest';
import candidatesRouter from './candidates.routes';
import { candidateRepo, auditRepo } from '../repositories/index';
import {
  ADMIN_TOKEN, MANAGER_TOKEN, USER_TOKEN,
  makeSerializedCandidate,
} from '../__tests__/helpers/factories';

const app = express();
app.use(express.json());
app.use('/api/candidates', candidatesRouter);
const request = supertest(app);

const mockCandRepo = candidateRepo as jest.Mocked<typeof candidateRepo>;
const mockAudit    = auditRepo     as jest.Mocked<typeof auditRepo>;

describe('GET /api/candidates', () => {
  beforeEach(() => {
    (mockCandRepo.findAll as jest.Mock).mockResolvedValue([makeSerializedCandidate()]);
  });

  it('200 — admin sees all candidates', async () => {
    const res = await request.get('/api/candidates').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('200 — general user only queries their own candidates', async () => {
    await request.get('/api/candidates').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(mockCandRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: 'user-uuid-usr-000001' })
    );
  });

  it('401 — returns 401 without auth token', async () => {
    const res = await request.get('/api/candidates');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/candidates/:id', () => {
  it('200 — returns a single candidate', async () => {
    (mockCandRepo.findById as jest.Mock).mockResolvedValue(makeSerializedCandidate());
    const res = await request.get('/api/candidates/cand-uuid-arjun-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.firstName).toBe('Arjun');
  });

  it('404 — returns 404 for unknown candidate', async () => {
    (mockCandRepo.findById as jest.Mock).mockResolvedValue(null);
    const res = await request.get('/api/candidates/ghost')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/candidates', () => {
  const valid = {
    firstName: 'New', lastName: 'Candidate',
    email: 'new.cand@test.com',
  };

  beforeEach(() => {
    (mockCandRepo.create as jest.Mock).mockResolvedValue(makeSerializedCandidate({ ...valid }));
    (mockAudit.create    as jest.Mock).mockResolvedValue({});
  });

  it('201 — creates a candidate with minimum required fields', async () => {
    const res = await request.post('/api/candidates')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send(valid);
    expect(res.status).toBe(201);
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CANDIDATE_CREATED' })
    );
  });

  it('400 — rejects invalid email', async () => {
    const res = await request.post('/api/candidates')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send({ ...valid, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(mockCandRepo.create).not.toHaveBeenCalled();
  });

  it('400 — rejects missing required fields', async () => {
    const res = await request.post('/api/candidates')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send({ email: 'missing@name.com' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/candidates/:id', () => {
  beforeEach(() => {
    (mockCandRepo.findById as jest.Mock).mockResolvedValue(makeSerializedCandidate());
    (mockCandRepo.update   as jest.Mock).mockResolvedValue(makeSerializedCandidate({ status: 'Flagged' }));
    (mockAudit.create      as jest.Mock).mockResolvedValue({});
  });

  it('200 — updates candidate fields', async () => {
    const res = await request.patch('/api/candidates/cand-uuid-arjun-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ status: 'Flagged' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Flagged');
  });

  it('400 — rejects invalid risk level', async () => {
    const res = await request.patch('/api/candidates/cand-uuid-arjun-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ riskLevel: 'Extreme' });
    expect(res.status).toBe(400);
  });

  it('400 — rejects empty update body', async () => {
    const res = await request.patch('/api/candidates/cand-uuid-arjun-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('404 — returns 404 for unknown candidate', async () => {
    (mockCandRepo.findById as jest.Mock).mockResolvedValue(null);
    const res = await request.patch('/api/candidates/ghost')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ notes: 'test' });
    expect(res.status).toBe(404);
  });

  it('writes CANDIDATE_UPDATED audit event with updated fields', async () => {
    await request.patch('/api/candidates/cand-uuid-arjun-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ notes: 'Updated notes', riskScore: 50 });
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CANDIDATE_UPDATED' })
    );
  });
});

describe('DELETE /api/candidates/:id', () => {
  beforeEach(() => {
    (mockCandRepo.findById as jest.Mock).mockResolvedValue(makeSerializedCandidate());
    (mockCandRepo.delete   as jest.Mock).mockResolvedValue(true);
    (mockAudit.create      as jest.Mock).mockResolvedValue({});
  });

  it('200 — admin can delete a candidate', async () => {
    const res = await request.delete('/api/candidates/cand-uuid-arjun-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CANDIDATE_DELETED' })
    );
  });

  it('403 — general user cannot delete a candidate', async () => {
    const res = await request.delete('/api/candidates/cand-uuid-arjun-001')
      .set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(403);
    expect(mockCandRepo.delete).not.toHaveBeenCalled();
  });
});
