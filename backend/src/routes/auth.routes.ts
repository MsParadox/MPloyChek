// ============================================================
// MPloyChek v4.0 — Auth Routes
// FIX CRITICAL-1: Removed role from login payload.
//   Role is now always loaded from the database — the client
//   never decides or supplies the role.
// Author: Mohit Sharma
// ============================================================
import { Router, Request, Response } from 'express';
import * as jwt    from 'jsonwebtoken';
import * as crypto from 'crypto';
import { authenticate, AuthRequest, withDelay, JWT_SECRET, JWT_EXPIRES_IN, RT_EXPIRES_DAYS } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema, changePasswordSchema, refreshTokenSchema } from '../schemas/index';
import { userRepo, enumRoleToApi } from '../repositories/user.repository';
import { refreshTokenRepo, auditRepo } from '../repositories/index';
import { AUDIT_ACTIONS } from '../repositories/index';
import { authService } from '../services/auth.service';
import { sendWelcomeEmail, sendLoginAlertEmail, sendPasswordChangedEmail } from '../lib/email';
import logger from '../lib/logger';

const router = Router();

// ── Helper: issue access + refresh token pair ─────────────────
async function issueTokens(userId: string, userDbId: string, role: string) {
  const accessToken = jwt.sign({ sub: userDbId, userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const rawRefresh  = crypto.randomBytes(64).toString('hex');
  const expiresAt   = new Date(Date.now() + RT_EXPIRES_DAYS * 86_400_000);
  await refreshTokenRepo.create(userDbId, rawRefresh, expiresAt);
  return { accessToken, refreshToken: rawRefresh, expiresIn: JWT_EXPIRES_IN };
}

// ── POST /api/auth/login ──────────────────────────────────────
// FIXED: role is no longer accepted from the client.
// Flow: userId + password → DB lookup → load role → issue JWT
router.post('/login', withDelay, validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const start = Date.now();
  const { userId, password } = req.body;   // ← role removed from destructure

  try {
    // 1. Look up user
    const user = await userRepo.findByUserId(userId);
    if (!user) {
      await auditRepo.create({
        action: AUDIT_ACTIONS.LOGIN_FAILED, performedById: '00000000-0000-0000-0000-000000000000',
        performedByName: 'Unknown', targetId: 'auth', targetType: 'Auth',
        details: `Unknown userId: ${userId}`, ipAddress: req.ip || '', userAgent: req.headers['user-agent'] || '', success: false,
      });
      res.status(401).json({ success: false, error: 'Invalid credentials', timestamp: new Date().toISOString() });
      return;
    }

    // 2. Verify password (role check removed — role comes from DB only)
    const isValid = await authService.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      await auditRepo.create({
        action: AUDIT_ACTIONS.LOGIN_FAILED, performedById: user.id,
        performedByName: `${user.firstName} ${user.lastName}`, targetId: user.id,
        targetType: 'User', details: 'Wrong password', ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '', success: false,
      });
      res.status(401).json({ success: false, error: 'Invalid credentials', timestamp: new Date().toISOString() });
      return;
    }

    // 3. Load role from DB record — client never decides this.
    // Convert the raw Prisma enum ('ADMIN') to the display role ('Admin') the
    // JWT must carry, so RBAC middleware and the frontend agree on the value.
    const roleFromDb = enumRoleToApi(user.role);   // always trusted source

    // 4. Update lastLogin + issue tokens with DB role
    await userRepo.update(user.id, { lastLogin: new Date() });
    const tokens     = await issueTokens(user.userId, user.id, roleFromDb);
    const publicUser = await userRepo.findById(user.id);

    await auditRepo.create({
      action: AUDIT_ACTIONS.LOGIN, performedById: user.id,
      performedByName: `${user.firstName} ${user.lastName}`, targetId: user.id,
      targetType: 'User', details: `Login as ${roleFromDb}`, ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '', success: true,
    });

    // Non-blocking email alert
    sendLoginAlertEmail(user.email, user.firstName, req.ip || '', req.headers['user-agent'] || '').catch(() => {});

    res.status(200).json({
      success: true,
      data: { ...tokens, user: publicUser },
      message: `Welcome back, ${user.firstName}!`,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - start,
    });
  } catch (err) {
    logger.error('Login error', { error: err });
    res.status(500).json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() });
  }
});

// ── POST /api/auth/register ───────────────────────────────────
// Public self-registration. Always creates a General User (role is set by the
// server, never the client) and logs the new user in immediately.
router.post('/register', withDelay, validate(registerSchema), async (req: Request, res: Response): Promise<void> => {
  const start = Date.now();
  const { userId, firstName, lastName, email, password, department, phone } = req.body;
  try {
    const user = await authService.registerUser({
      userId, firstName, lastName, email, password,
      role: 'General User',          // forced — clients cannot self-assign privileges
      department: department || 'General',
      phone: phone || '',
    });

    const tokens = await issueTokens(user.userId, user.id, user.role);

    await auditRepo.create({
      action: AUDIT_ACTIONS.USER_CREATED, performedById: user.id,
      performedByName: `${user.firstName} ${user.lastName}`, targetId: user.id,
      targetType: 'User', details: `Self-registered account: ${userId}`,
      ipAddress: req.ip || '', userAgent: req.headers['user-agent'] || '', success: true,
    });

    sendWelcomeEmail(user.email, user.firstName, user.userId).catch(() => {});

    res.status(201).json({
      success: true,
      data: { ...tokens, user },
      message: `Welcome to MPloyChek, ${user.firstName}!`,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - start,
    });
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('already registered') || msg.includes('already taken')) {
      res.status(409).json({ success: false, error: msg, timestamp: new Date().toISOString() });
      return;
    }
    logger.error('Register error', { error: err });
    res.status(500).json({ success: false, error: 'Registration failed', timestamp: new Date().toISOString() });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────
router.post('/refresh', validate(refreshTokenSchema), async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  try {
    const userId = await refreshTokenRepo.isValid(refreshToken);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token', timestamp: new Date().toISOString() });
      return;
    }
    const user = await userRepo.findById(userId);
    if (!user) { res.status(401).json({ success: false, error: 'User not found', timestamp: new Date().toISOString() }); return; }

    // Revoke old token (rotation — prevents reuse attacks)
    const old = await refreshTokenRepo.findByToken(refreshToken);
    if (old) await refreshTokenRepo.revoke(old.id);

    const tokens = await issueTokens(user.userId, user.id, user.role);

    await auditRepo.create({
      action: AUDIT_ACTIONS.TOKEN_REFRESHED, performedById: user.id,
      performedByName: user.userId, targetId: user.id,
      targetType: 'User', details: 'Refresh token rotated',
      ipAddress: req.ip || '', userAgent: req.headers['user-agent'] || '', success: true,
    });

    res.status(200).json({ success: true, data: tokens, message: 'Token refreshed', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Refresh token error', { error: err });
    res.status(500).json({ success: false, error: 'Token refresh failed', timestamp: new Date().toISOString() });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await refreshTokenRepo.revokeAllForUser(req.user!.sub);
    await auditRepo.create({
      action: AUDIT_ACTIONS.LOGOUT, performedById: req.user!.sub,
      performedByName: req.user!.userId, targetId: req.user!.sub,
      targetType: 'User', details: 'User logged out — all sessions revoked',
      ipAddress: req.ip || '', userAgent: req.headers['user-agent'] || '', success: true,
    });
    res.status(200).json({ success: true, message: 'Logged out successfully', timestamp: new Date().toISOString() });
  } catch {
    res.status(200).json({ success: true, message: 'Logged out', timestamp: new Date().toISOString() });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authenticate, withDelay, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await userRepo.findById(req.user!.sub);
  if (!user) { res.status(404).json({ success: false, error: 'User not found', timestamp: new Date().toISOString() }); return; }
  res.status(200).json({ success: true, data: user, timestamp: new Date().toISOString() });
});

// ── POST /api/auth/change-password ───────────────────────────
router.post('/change-password', authenticate, validate(changePasswordSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  try {
    await authService.changePassword(req.user!.sub, req.user!.userId, currentPassword, newPassword);

    await auditRepo.create({
      action: AUDIT_ACTIONS.CHANGE_PASSWORD, performedById: req.user!.sub,
      performedByName: req.user!.userId, targetId: req.user!.sub,
      targetType: 'User', details: 'Password changed — all sessions revoked',
      ipAddress: req.ip || '', userAgent: req.headers['user-agent'] || '', success: true,
    });

    const user = await userRepo.findByUserId(req.user!.userId);
    if (user) sendPasswordChangedEmail(user.email, user.firstName).catch(() => {});

    res.status(200).json({ success: true, message: 'Password changed. Please log in again.', timestamp: new Date().toISOString() });
  } catch (err: any) {
    if (err.message === 'Current password is incorrect') {
      res.status(400).json({ success: false, error: err.message, timestamp: new Date().toISOString() });
    } else {
      logger.error('Change password error', { error: err });
      res.status(500).json({ success: false, error: 'Failed to change password', timestamp: new Date().toISOString() });
    }
  }
});

export default router;
