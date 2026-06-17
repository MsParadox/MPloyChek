// ============================================================
// MPloyChek v4.0 — Users Routes Integration Tests
// Covers RBAC, self-service updates, role-change auditing.
// ============================================================
jest.mock('../repositories/index');
jest.mock('../repositories/user.repository');
jest.mock('../services/auth.service');
jest.mock('../lib/email');
jest.mock('../lib/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import express      from 'express';
import supertest    from 'supertest';
import usersRouter  from './users.routes';
import { userRepo } from '../repositories/user.repository';
import { auditRepo } from '../repositories/index';
import { authService } from '../services/auth.service';
import { ADMIN_TOKEN, MANAGER_TOKEN, USER_TOKEN, makeSerializedUser } from '../__tests__/helpers/factories';

const app = express();
app.use(express.json());
app.use('/api/users', usersRouter);
const request = supertest(app);

const mockUserRepo = userRepo    as jest.Mocked<typeof userRepo>;
const mockAudit    = auditRepo   as jest.Mocked<typeof auditRepo>;
const mockAuthSvc  = authService as jest.Mocked<typeof authService>;

const ADMIN_ID = 'user-uuid-admin-0001';
const USER_ID  = 'user-uuid-usr-000001';

beforeEach(() => {
  (mockAudit.create as jest.Mock).mockResolvedValue({});
});

describe('GET /api/users', () => {
  it('200 — admin gets the full list', async () => {
    (mockUserRepo.findAll as jest.Mock).mockResolvedValue([makeSerializedUser(), makeSerializedUser({ id: 'u2' })]);
    const res = await request.get('/api/users').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(mockUserRepo.findAll).toHaveBeenCalled();
  });

  it('200 — general user only sees themselves', async () => {
    (mockUserRepo.findById as jest.Mock).mockResolvedValue(makeSerializedUser({ id: USER_ID }));
    const res = await request.get('/api/users').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockUserRepo.findById).toHaveBeenCalledWith(USER_ID);
    expect(mockUserRepo.findAll).not.toHaveBeenCalled();
  });

  it('401 — rejects missing token', async () => {
    const res = await request.get('/api/users');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/stats', () => {
  it('200 — manager can view stats', async () => {
    (mockUserRepo.getStats as jest.Mock).mockResolvedValue({ totalUsers: 4, activeUsers: 4, adminUsers: 1 });
    const res = await request.get('/api/users/stats').set('Authorization', `Bearer ${MANAGER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalUsers).toBe(4);
  });

  it('403 — general user cannot view stats', async () => {
    const res = await request.get('/api/users/stats').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/users/:id', () => {
  it('200 — user can read their own record', async () => {
    (mockUserRepo.findById as jest.Mock).mockResolvedValue(makeSerializedUser({ id: USER_ID }));
    const res = await request.get(`/api/users/${USER_ID}`).set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(200);
  });

  it('403 — general user cannot read someone else', async () => {
    const res = await request.get('/api/users/other-id').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('404 — admin reading an unknown user', async () => {
    (mockUserRepo.findById as jest.Mock).mockResolvedValue(null);
    const res = await request.get('/api/users/ghost').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/users', () => {
  const valid = {
    userId: 'newuser1', firstName: 'New', lastName: 'User',
    email: 'new.user@test.com', password: 'NewPass@1',
    role: 'Verifier', department: 'Operations', phone: '+91-9000000000',
  };

  beforeEach(() => {
    (mockAuthSvc.hashPassword as jest.Mock).mockResolvedValue('hashed');
    (mockUserRepo.create as jest.Mock).mockResolvedValue(makeSerializedUser({ userId: 'newuser1' }));
  });

  it('201 — admin creates a user and password is hashed via the service', async () => {
    const res = await request.post('/api/users').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(valid);
    expect(res.status).toBe(201);
    expect(mockAuthSvc.hashPassword).toHaveBeenCalledWith('NewPass@1');
    // repository must receive the hash, never the plaintext password
    const createArg = (mockUserRepo.create as jest.Mock).mock.calls[0][0];
    expect(createArg).toHaveProperty('passwordHash', 'hashed');
    expect(createArg).not.toHaveProperty('password');
    expect(mockAudit.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_CREATED' }));
  });

  it('403 — manager cannot create users', async () => {
    const res = await request.post('/api/users').set('Authorization', `Bearer ${MANAGER_TOKEN}`).send(valid);
    expect(res.status).toBe(403);
  });

  it('400 — rejects a weak password', async () => {
    const res = await request.post('/api/users').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({ ...valid, password: 'weak' });
    expect(res.status).toBe(400);
  });

  it('409 — surfaces duplicate userId/email as conflict', async () => {
    (mockUserRepo.create as jest.Mock).mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });
    const res = await request.post('/api/users').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(valid);
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/users/:id', () => {
  beforeEach(() => {
    (mockUserRepo.findById as jest.Mock).mockResolvedValue(makeSerializedUser({ id: ADMIN_ID, role: 'Verifier' }));
    (mockUserRepo.update   as jest.Mock).mockResolvedValue(makeSerializedUser({ id: ADMIN_ID }));
  });

  it('200 — admin updates a user', async () => {
    const res = await request.patch(`/api/users/${ADMIN_ID}`).set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({ department: 'Risk' });
    expect(res.status).toBe(200);
    expect(mockAudit.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_UPDATED' }));
  });

  it('writes ROLE_CHANGED when the role actually changes', async () => {
    await request.patch(`/api/users/${ADMIN_ID}`).set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({ role: 'Manager' });
    expect(mockAudit.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'ROLE_CHANGED' }));
  });

  it('403 — a user cannot edit someone else', async () => {
    const res = await request.patch('/api/users/another-id').set('Authorization', `Bearer ${USER_TOKEN}`).send({ department: 'X' });
    expect(res.status).toBe(403);
  });

  it('strips role/status when a non-admin edits themselves', async () => {
    (mockUserRepo.findById as jest.Mock).mockResolvedValue(makeSerializedUser({ id: USER_ID, role: 'General User' }));
    await request.patch(`/api/users/${USER_ID}`).set('Authorization', `Bearer ${USER_TOKEN}`).send({ role: 'Admin', department: 'Ops' });
    const updateArg = (mockUserRepo.update as jest.Mock).mock.calls[0][1];
    expect(updateArg).not.toHaveProperty('role');
  });

  it('400 — empty body is rejected', async () => {
    const res = await request.patch(`/api/users/${ADMIN_ID}`).set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/users/:id', () => {
  it('200 — admin deletes another user', async () => {
    (mockUserRepo.delete as jest.Mock).mockResolvedValue(true);
    const res = await request.delete('/api/users/some-other-id').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(mockAudit.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_DELETED' }));
  });

  it('400 — admin cannot delete their own account', async () => {
    const res = await request.delete(`/api/users/${ADMIN_ID}`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(400);
  });

  it('404 — deleting a non-existent user', async () => {
    (mockUserRepo.delete as jest.Mock).mockResolvedValue(false);
    const res = await request.delete('/api/users/ghost').set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(404);
  });

  it('403 — manager cannot delete users', async () => {
    const res = await request.delete('/api/users/x').set('Authorization', `Bearer ${MANAGER_TOKEN}`);
    expect(res.status).toBe(403);
  });
});
