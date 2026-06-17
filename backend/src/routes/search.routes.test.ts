// ============================================================
// MPloyChek v4.0 — Search Routes Integration Tests
// Verifies privilege-scoped results across records/candidates/users.
// ============================================================
jest.mock('../repositories/index');
jest.mock('../repositories/user.repository');
jest.mock('../lib/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import express from 'express';
import supertest from 'supertest';
import searchRouter from './search.routes';
import { recordRepo, candidateRepo } from '../repositories/index';
import { userRepo } from '../repositories/user.repository';
import { ADMIN_TOKEN, USER_TOKEN, makeSerializedRecord, makeSerializedCandidate, makeSerializedUser } from '../__tests__/helpers/factories';

const app = express();
app.use(express.json());
app.use('/api/search', searchRouter);
const request = supertest(app);

const mockRecord = recordRepo    as jest.Mocked<typeof recordRepo>;
const mockCand   = candidateRepo as jest.Mocked<typeof candidateRepo>;
const mockUser   = userRepo      as jest.Mocked<typeof userRepo>;

beforeEach(() => {
  (mockRecord.findAll as jest.Mock).mockResolvedValue([makeSerializedRecord({ candidateName: 'Arjun Mehta' })]);
  (mockCand.findAll   as jest.Mock).mockResolvedValue([makeSerializedCandidate({ firstName: 'Arjun', lastName: 'Mehta' })]);
  (mockUser.findAll   as jest.Mock).mockResolvedValue([makeSerializedUser({ firstName: 'Arjun', lastName: 'Admin' })]);
});

describe('GET /api/search', () => {
  it('400 — rejects queries shorter than 2 characters', async () => {
    const res = await request.get('/api/search?q=a').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(400);
  });

  it('200 — admin search includes users group', async () => {
    const res = await request.get('/api/search?q=arjun').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.records.length).toBeGreaterThan(0);
    expect(res.body.data.candidates.length).toBeGreaterThan(0);
    expect(res.body.data.users.length).toBeGreaterThan(0);
  });

  it('200 — non-privileged search never returns users', async () => {
    const res = await request.get('/api/search?q=arjun').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([]);
    expect(mockUser.findAll).not.toHaveBeenCalled();
  });

  it('non-privileged search scopes records/candidates to the caller', async () => {
    await request.get('/api/search?q=arjun').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(mockRecord.findAll).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'user-uuid-usr-000001' }));
    expect(mockCand.findAll).toHaveBeenCalledWith(expect.objectContaining({ createdById: 'user-uuid-usr-000001' }));
  });

  it('200 — filters out non-matching results', async () => {
    const res = await request.get('/api/search?q=zzzznomatch').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});
