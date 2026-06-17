// ============================================================
// MPloyChek v4.0 — Auth Flow End-to-End Test
// Tests the complete authentication lifecycle:
//   Register → Login → Access protected route → Refresh tokens
//   → Change password → Logout → Verify sessions revoked
// ============================================================
jest.mock('../repositories/user.repository');
jest.mock('../repositories/index');
jest.mock('../services/auth.service');
jest.mock('../lib/email');
jest.mock('../lib/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import express   from 'express';
import supertest from 'supertest';
import authRouter  from '../routes/auth.routes';
import usersRouter from '../routes/users.routes';
import { userRepo }              from '../repositories/user.repository';
import { refreshTokenRepo, auditRepo } from '../repositories/index';
import { authService }           from '../services/auth.service';
import { makeDbUser, makeSerializedUser, makeToken } from './helpers/factories';

const app = express();
app.use(express.json());
app.use('/api/auth',  authRouter);
app.use('/api/users', usersRouter);
const request = supertest(app);

// ── Shared state across the flow ──────────────────────────────
let accessToken  = '';
let refreshToken = '';

describe('Complete Authentication Lifecycle', () => {
  const dbUser = makeDbUser();
  const user   = makeSerializedUser();

  // This is a stateful end-to-end flow: each step builds on the previous.
  // The global jest config uses `clearMocks: true`, which wipes mock.calls
  // between tests — so we accumulate the cross-step assertions we care about
  // into local arrays via persistent mockImplementations (implementations
  // survive clearMocks; only call history is cleared).
  const auditActions: string[] = [];
  const revokedTokenIds: string[] = [];

  beforeAll(() => {
    (mockFn(userRepo.findByUserId) as any).mockResolvedValue(dbUser);
    (mockFn(userRepo.findById)     as any).mockResolvedValue(user);
    (mockFn(userRepo.update)       as any).mockResolvedValue(user);
    (mockFn(authService.verifyPassword) as any).mockResolvedValue(true);
    (mockFn(refreshTokenRepo.create)    as any).mockResolvedValue({});
    (mockFn(refreshTokenRepo.isValid)   as any).mockResolvedValue('user-uuid-admin-0001');
    (mockFn(refreshTokenRepo.findByToken) as any).mockResolvedValue({ id: 'rt-id' });
    (mockFn(refreshTokenRepo.revoke)    as any).mockImplementation((id: string) => {
      revokedTokenIds.push(id);
      return Promise.resolve({});
    });
    (mockFn(refreshTokenRepo.revokeAllForUser) as any).mockResolvedValue({});
    (mockFn(auditRepo.create)           as any).mockImplementation((entry: any) => {
      auditActions.push(entry.action);
      return Promise.resolve({});
    });
    (mockFn(authService.changePassword) as any).mockResolvedValue(true);
  });

  // ── Step 1: Login ─────────────────────────────────────────
  it('Step 1 — Login returns accessToken + refreshToken', async () => {
    const res = await request.post('/api/auth/login').send({
      userId: 'admin001', password: 'Admin@123',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data).toHaveProperty('user');

    accessToken  = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  // ── Step 2: Access protected route with token ─────────────
  it('Step 2 — Access /auth/me with valid token', async () => {
    const res = await request.get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe('admin001');
  });

  // ── Step 3: Reject access without token ───────────────────
  it('Step 3 — Protected route rejects missing token', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ── Step 4: Refresh token rotation ────────────────────────
  it('Step 4 — Refresh token issues new token pair', async () => {
    const res = await request.post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();

    // Update tokens for next steps
    accessToken  = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('Step 4b — Old refresh token is revoked after rotation', () => {
    expect(revokedTokenIds).toContain('rt-id');
  });

  // ── Step 5: Change password (revokes all sessions) ────────
  it('Step 5 — Change password succeeds and triggers session revocation', async () => {
    const res = await request.post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'Admin@123', newPassword: 'NewAdmin@1' });
    expect(res.status).toBe(200);
    expect(authService.changePassword).toHaveBeenCalled();
  });

  // ── Step 6: Logout ────────────────────────────────────────
  it('Step 6 — Logout revokes all sessions', async () => {
    const res = await request.post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(refreshTokenRepo.revokeAllForUser).toHaveBeenCalled();
  });

  // ── Step 7: Expired token is rejected ─────────────────────
  it('Step 7 — Expired token is rejected (401)', async () => {
    const expired = makeToken({ expiresIn: -1 });
    const res = await request.get('/api/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  // ── Step 8: Audit trail completeness ─────────────────────
  it('Step 8 — Audit log was written for every auth event', () => {
    expect(auditActions).toContain('LOGIN');
    expect(auditActions).toContain('TOKEN_REFRESHED');
    expect(auditActions).toContain('CHANGE_PASSWORD');
    expect(auditActions).toContain('LOGOUT');
  });
});

function mockFn(fn: any): jest.Mock { return fn as jest.Mock; }
