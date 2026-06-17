// ============================================================
// MPloyChek v4.0 — Users Routes
// Priority 6: Added ROLE_CHANGED audit event
// Priority 4: Use AuthService for password hashing
// Author: Mohit Sharma
// ============================================================
import { Router, Response } from 'express';
import { authenticate, AuthRequest, withDelay } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { canCreateUser, canDeleteUser, canViewStats } from '../middleware/rbac';
import { createUserSchema, updateUserSchema } from '../schemas/index';
import { userRepo } from '../repositories/user.repository';
import { auditRepo, AUDIT_ACTIONS } from '../repositories/index';
import { authService } from '../services/auth.service';
import { sendWelcomeEmail } from '../lib/email';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

// ── GET /api/users ────────────────────────────────────────────
router.get('/', withDelay, async (req: AuthRequest, res: Response): Promise<void> => {
  const start = Date.now();
  try {
    if (req.user?.role === 'Admin' || req.user?.role === 'Manager') {
      const users = await userRepo.findAll();
      res.json({ success: true, data: users, total: users.length, timestamp: new Date().toISOString(), processingTime: Date.now() - start });
    } else {
      const user = await userRepo.findById(req.user!.sub);
      res.json({ success: true, data: user ? [user] : [], total: 1, timestamp: new Date().toISOString(), processingTime: Date.now() - start });
    }
  } catch (err) {
    logger.error('GET /users', { error: err });
    res.status(500).json({ success: false, error: 'Failed to fetch users', timestamp: new Date().toISOString() });
  }
});

// ── GET /api/users/stats ──────────────────────────────────────
router.get('/stats', canViewStats, async (_req: AuthRequest, res: Response): Promise<void> => {
  const stats = await userRepo.getStats();
  res.json({ success: true, data: stats, timestamp: new Date().toISOString() });
});

// ── GET /api/users/:id ────────────────────────────────────────
router.get('/:id', withDelay, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const isAdmin   = req.user?.role === 'Admin';
  const isManager = req.user?.role === 'Manager';
  const isSelf    = req.user?.sub  === id;
  if (!isAdmin && !isManager && !isSelf) {
    res.status(403).json({ success: false, error: 'Forbidden', timestamp: new Date().toISOString() }); return;
  }
  const user = await userRepo.findById(id);
  if (!user) { res.status(404).json({ success: false, error: 'User not found', timestamp: new Date().toISOString() }); return; }
  res.json({ success: true, data: user, timestamp: new Date().toISOString() });
});

// ── POST /api/users ───────────────────────────────────────────
router.post('/', canCreateUser, validate(createUserSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const start = Date.now();
  try {
    const { userId, firstName, lastName, email, password, role, department, phone } = req.body;

    // Priority 4: Password hashing via AuthService (not inline bcrypt)
    const passwordHash = await authService.hashPassword(password);
    const user         = await userRepo.create({ userId, firstName, lastName, email, passwordHash, role, department, phone });

    await auditRepo.create({
      action: AUDIT_ACTIONS.USER_CREATED, performedById: req.user!.sub,
      performedByName: req.user!.userId, targetId: user.id, targetType: 'User',
      details: `Created user ${userId} with role ${role}`,
      ipAddress: req.ip || '', userAgent: req.headers['user-agent'] || '', success: true,
    });

    // Non-blocking welcome email
    sendWelcomeEmail(email, firstName, userId).catch(() => {});

    res.status(201).json({ success: true, data: user, message: 'User created successfully', timestamp: new Date().toISOString(), processingTime: Date.now() - start });
  } catch (err: any) {
    // Prisma P2002 = unique constraint violation (duplicate userId or email)
    if (err?.code === 'P2002' || err.message?.includes('already') || err.message?.includes('Unique')) {
      const field = err?.meta?.target?.includes('email') ? 'Email' : 'User ID';
      res.status(409).json({ success: false, error: `${field} is already taken`, timestamp: new Date().toISOString() }); return;
    }
    logger.error('POST /users', { error: err });
    res.status(500).json({ success: false, error: 'Failed to create user', timestamp: new Date().toISOString() });
  }
});

// ── PATCH /api/users/:id ──────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id }  = req.params;
  const isSelf  = req.user?.sub  === id;
  const isAdmin = req.user?.role === 'Admin';

  if (!isSelf && !isAdmin) {
    res.status(403).json({ success: false, error: 'Forbidden', timestamp: new Date().toISOString() }); return;
  }

  // Capture old role before update (for ROLE_CHANGED audit)
  const oldUser = await userRepo.findById(id);
  const oldRole = oldUser?.role;

  // Non-admins cannot elevate their own role/status
  if (!isAdmin) { delete req.body.role; delete req.body.status; }

  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    // FIX: Normalize to same format as validate() middleware ({ field, message } objects)
    const details = result.error.errors.map((e: any) => ({
      field:   e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({ success: false, error: 'Validation failed', details, timestamp: new Date().toISOString() }); return;
  }

  try {
    const updated = await userRepo.update(id, result.data);

    // Priority 6: ROLE_CHANGED is a distinct audit event from USER_UPDATED
    const roleChanged = result.data.role && result.data.role !== oldRole;
    const auditAction = roleChanged ? AUDIT_ACTIONS.ROLE_CHANGED : AUDIT_ACTIONS.USER_UPDATED;
    const auditDetail = roleChanged
      ? `Role changed: ${oldRole} → ${result.data.role}`
      : `Updated: ${Object.keys(result.data).join(', ')}`;

    await auditRepo.create({
      action: auditAction, performedById: req.user!.sub,
      performedByName: req.user!.userId, targetId: id, targetType: 'User',
      details: auditDetail, ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '', success: true,
    });

    res.json({ success: true, data: updated, message: 'User updated', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('PATCH /users/:id', { error: err });
    res.status(500).json({ success: false, error: 'Failed to update user', timestamp: new Date().toISOString() });
  }
});

// ── DELETE /api/users/:id ─────────────────────────────────────
router.delete('/:id', canDeleteUser, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  if (req.user?.sub === id) {
    res.status(400).json({ success: false, error: 'Cannot delete your own account', timestamp: new Date().toISOString() }); return;
  }
  try {
    const deleted = await userRepo.delete(id);
    if (!deleted) { res.status(404).json({ success: false, error: 'User not found', timestamp: new Date().toISOString() }); return; }

    await auditRepo.create({
      action: AUDIT_ACTIONS.USER_DELETED, performedById: req.user!.sub,
      performedByName: req.user!.userId, targetId: id, targetType: 'User',
      details: 'User account deleted', ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '', success: true,
    });

    res.json({ success: true, message: 'User deleted', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('DELETE /users/:id', { error: err });
    res.status(500).json({ success: false, error: 'Failed to delete user', timestamp: new Date().toISOString() });
  }
});

export default router;
