// ============================================================
// MPloyChek v4.0 — Auth Routes Integration Tests
// FIX: Removed role from login body (role now comes from DB)
//   - Deleted stale "401 — role does not match" test case
//   - Login body is now { userId, password } only
// ============================================================
// Mock only userRepo (the DB-backed parts); keep the pure role-mapping
// helpers (enumRoleToApi/apiRoleToEnum) real so the login route can convert
// 'ADMIN' → 'Admin' for the JWT exactly as it does in production.
jest.mock('../repositories/user.repository', () => {
  const actual = jest.requireActual('../repositories/user.repository');
  return {
    ...actual,
    userRepo: {
      findByUserId: jest.fn(), findById: jest.fn(), findByEmail: jest.fn(),
      findAll: jest.fn(), create: jest.fn(), update: jest.fn(),
      delete: jest.fn(), getStats: jest.fn(),
    },
  };
});
jest.mock('../repositories/index');
jest.mock('../services/auth.service');
jest.mock('../lib/email');
jest.mock('../lib/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import express     from 'express';
import supertest   from 'supertest';
import authRouter  from './auth.routes';
import { userRepo }                   from '../repositories/user.repository';
import { refreshTokenRepo, auditRepo } from '../repositories/index';
import { authService }                from '../services/auth.service';
import { makeDbUser, makeSerializedUser, ADMIN_TOKEN, EXPIRED_TOKEN } from '../__tests__/helpers/factories';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
const request = supertest(app);

const mockUserRepo = userRepo         as jest.Mocked<typeof userRepo>;
const mockRTRepo   = refreshTokenRepo as jest.Mocked<typeof refreshTokenRepo>;
const mockAudit    = auditRepo        as jest.Mocked<typeof auditRepo>;
const mockAuthSvc  = authService      as jest.Mocked<typeof authService>;

// FIXED: body no longer contains role
const VALID_LOGIN = { userId: 'admin001', password: 'Admin@123' };

describe('POST /api/auth/login', () => {
  const dbUser = makeDbUser();

  beforeEach(() => {
    (mockUserRepo.findByUserId as jest.Mock).mockResolvedValue(dbUser);
    (mockAuthSvc.verifyPassword as jest.Mock).mockResolvedValue(true);
    (mockUserRepo.update       as jest.Mock).mockResolvedValue({});
    (mockRTRepo.create         as jest.Mock).mockResolvedValue({});
    (mockAudit.create          as jest.Mock).mockResolvedValue({});
    (mockUserRepo.findById     as jest.Mock).mockResolvedValue(makeSerializedUser());
  });

  it('200 — returns accessToken, refreshToken and user on valid login', async () => {
    const res = await request.post('/api/auth/login').send(VALID_LOGIN);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user).toHaveProperty('userId', 'admin001');
  });

  it('200 — role in JWT comes from DB, not from request body', async () => {
    const res = await request.post('/api/auth/login').send(VALID_LOGIN);
    expect(res.status).toBe(200);
    // Role must come from the DB, never the client — and must be the DISPLAY
    // role ('Admin') that RBAC + the frontend expect, NOT the raw enum ('ADMIN').
    const payload = JSON.parse(Buffer.from(res.body.data.accessToken.split('.')[1], 'base64').toString());
    expect(payload.role).toBe('Admin');
  });

  it('200 — response has no passwordHash in user object', async () => {
    const res = await request.post('/api/auth/login').send(VALID_LOGIN);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('401 — returns error when user not found', async () => {
    (mockUserRepo.findByUserId as jest.Mock).mockResolvedValue(null);
    const res = await request.post('/api/auth/login').send(VALID_LOGIN);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('401 — returns error on wrong password', async () => {
    (mockAuthSvc.verifyPassword as jest.Mock).mockResolvedValue(false);
    const res = await request.post('/api/auth/login').send({ ...VALID_LOGIN, password: 'WrongPass' });
    expect(res.status).toBe(401);
  });

  it('400 — returns validation error when userId is missing', async () => {
    const res = await request.post('/api/auth/login').send({ password: 'pass' });
    expect(res.status).toBe(400);
  });

  it('400 — returns validation error when password is missing', async () => {
    const res = await request.post('/api/auth/login').send({ userId: 'admin001' });
    expect(res.status).toBe(400);
  });

  it('writes LOGIN audit log on success', async () => {
    await request.post('/api/auth/login').send(VALID_LOGIN);
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN', success: true })
    );
  });

  it('writes LOGIN_FAILED audit log on bad password', async () => {
    (mockAuthSvc.verifyPassword as jest.Mock).mockResolvedValue(false);
    await request.post('/api/auth/login').send({ ...VALID_LOGIN, password: 'wrongpass' });
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_FAILED', success: false })
    );
  });
});

describe('POST /api/auth/register', () => {
  const VALID = {
    userId: 'newuser1', firstName: 'Arjun', lastName: 'Mehta',
    email: 'arjun.new@test.com', password: 'NewPass@1',
    department: 'Engineering', phone: '+91-9000000000',
  };

  beforeEach(() => {
    (mockAuthSvc.registerUser as jest.Mock).mockResolvedValue(
      makeSerializedUser({ userId: 'newuser1', role: 'General User' })
    );
    (mockRTRepo.create as jest.Mock).mockResolvedValue({});
    (mockAudit.create  as jest.Mock).mockResolvedValue({});
  });

  it('201 — registers a new user and returns a token pair', async () => {
    const res = await request.post('/api/auth/register').send(VALID);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user).toHaveProperty('userId', 'newuser1');
  });

  it('always registers as General User (role never taken from client)', async () => {
    await request.post('/api/auth/register').send({ ...VALID, role: 'Admin' } as any);
    const arg = (mockAuthSvc.registerUser as jest.Mock).mock.calls[0][0];
    expect(arg.role).toBe('General User');
  });

  it('400 — rejects a weak password', async () => {
    const res = await request.post('/api/auth/register').send({ ...VALID, password: 'weak' });
    expect(res.status).toBe(400);
    expect(mockAuthSvc.registerUser).not.toHaveBeenCalled();
  });

  it('409 — surfaces a duplicate userId/email', async () => {
    (mockAuthSvc.registerUser as jest.Mock).mockRejectedValue(new Error('User ID is already taken'));
    const res = await request.post('/api/auth/register').send(VALID);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    (mockRTRepo.isValid    as jest.Mock).mockResolvedValue('user-uuid-admin-0001');
    (mockUserRepo.findById as jest.Mock).mockResolvedValue(makeSerializedUser());
    (mockRTRepo.findByToken as jest.Mock).mockResolvedValue({ id: 'rt-id' });
    (mockRTRepo.revoke     as jest.Mock).mockResolvedValue({});
    (mockRTRepo.create     as jest.Mock).mockResolvedValue({});
    (mockAudit.create      as jest.Mock).mockResolvedValue({});
  });

  it('200 — issues new token pair on valid refresh token', async () => {
    const res = await request.post('/api/auth/refresh').send({ refreshToken: 'valid-rt' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
  });

  it('401 — rejects invalid or expired refresh token', async () => {
    (mockRTRepo.isValid as jest.Mock).mockResolvedValue(null);
    const res = await request.post('/api/auth/refresh').send({ refreshToken: 'bad-rt' });
    expect(res.status).toBe(401);
  });

  it('revokes the old refresh token (rotation)', async () => {
    await request.post('/api/auth/refresh').send({ refreshToken: 'valid-rt' });
    expect(mockRTRepo.revoke).toHaveBeenCalledWith('rt-id');
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    (mockRTRepo.revokeAllForUser as jest.Mock).mockResolvedValue({});
    (mockAudit.create            as jest.Mock).mockResolvedValue({});
  });

  it('200 — logs out with a valid token', async () => {
    const res = await request
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('401 — rejects request without token', async () => {
    const res = await request.post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('401 — rejects expired token', async () => {
    const res = await request
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${EXPIRED_TOKEN}`);
    expect(res.status).toBe(401);
  });

  it('revokes all sessions for the user', async () => {
    await request
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(mockRTRepo.revokeAllForUser).toHaveBeenCalledWith('user-uuid-admin-0001');
  });
});

describe('GET /api/auth/me', () => {
  it('200 — returns current user profile', async () => {
    (mockUserRepo.findById as jest.Mock).mockResolvedValue(makeSerializedUser());
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('userId', 'admin001');
  });

  it('401 — rejects unauthenticated request', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    (mockAuthSvc.changePassword as jest.Mock).mockResolvedValue(true);
    (mockUserRepo.findByUserId  as jest.Mock).mockResolvedValue(makeDbUser());
    (mockAudit.create           as jest.Mock).mockResolvedValue({});
  });

  it('200 — changes password successfully', async () => {
    const res = await request
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ currentPassword: 'Admin@123', newPassword: 'NewPass@1' });
    expect(res.status).toBe(200);
  });

  it('400 — returns error when current password is wrong', async () => {
    (mockAuthSvc.changePassword as jest.Mock).mockRejectedValue(
      new Error('Current password is incorrect')
    );
    const res = await request
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ currentPassword: 'WrongOld', newPassword: 'NewPass@1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('incorrect');
  });

  it('400 — rejects weak new password (no special char)', async () => {
    const res = await request
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ currentPassword: 'Admin@123', newPassword: 'NewPass12' });
    expect(res.status).toBe(400);
  });
});
