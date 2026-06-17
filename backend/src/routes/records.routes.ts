// ============================================================
// MPloyChek v4.0 — Records Routes
// Priority 6: Added CANDIDATE_APPROVED/REJECTED audit events
// Priority 8: Verification workflow (Pending→In Review→Running→Approved/Rejected)
// Author: Mohit Sharma
// ============================================================
import { Router, Response } from 'express';
import { authenticate, AuthRequest, withDelay } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { canReadAllRecords } from '../middleware/rbac';
import { createRecordSchema, updateRecordSchema, paginationSchema } from '../schemas/index';
import { recordRepo, auditRepo, notifRepo, AUDIT_ACTIONS } from '../repositories/index';
import { notifyUser } from '../lib/ws-notify';
import { userRepo } from '../repositories/user.repository';
import { sendVerificationCompleteEmail } from '../lib/email';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

// ── Verification workflow: valid transitions ──────────────────
// Priority 8: Strict status machine
const VALID_TRANSITIONS: Record<string, string[]> = {
  'Pending':              ['In Review', 'Cancelled', 'On Hold'],
  'In Review':            ['Verification Running', 'On Hold', 'Cancelled'],
  'Verification Running': ['Approved', 'Rejected', 'Failed', 'On Hold'],
  'In Progress':          ['Approved', 'Rejected', 'Completed', 'Failed', 'On Hold'],
  'On Hold':              ['In Review', 'Pending', 'Cancelled'],
  // Terminal states — no further transitions
  'Approved': [], 'Rejected': [], 'Completed': [], 'Failed': [], 'Cancelled': [],
};

const TERMINAL_STATUSES = new Set(['Approved', 'Rejected', 'Completed', 'Failed', 'Cancelled']);

// ── GET /api/records ──────────────────────────────────────────
router.get('/', withDelay, validate(paginationSchema, 'query'), async (req: AuthRequest, res: Response): Promise<void> => {
  const start  = Date.now();
  const isPriv = ['Admin', 'Manager', 'Verifier'].includes(req.user?.role || '');
  const { status, type, priority } = req.query as any;
  try {
    const records = await recordRepo.findAll({
      ownerId:     isPriv ? undefined : req.user!.sub,
      candidateId: req.query['candidateId'] as string,
      status, type, priority,
    });
    res.json({ success: true, data: records, total: records.length, timestamp: new Date().toISOString(), processingTime: Date.now() - start });
  } catch (err) {
    logger.error('GET /records', { error: err });
    res.status(500).json({ success: false, error: 'Failed to fetch records', timestamp: new Date().toISOString() });
  }
});

// ── GET /api/records/summary ──────────────────────────────────
router.get('/summary', canReadAllRecords, async (_req: AuthRequest, res: Response): Promise<void> => {
  const summary = await recordRepo.getSummary();
  res.json({ success: true, data: summary, timestamp: new Date().toISOString() });
});

// ── GET /api/records/:id ──────────────────────────────────────
router.get('/:id', withDelay, async (req: AuthRequest, res: Response): Promise<void> => {
  const record = await recordRepo.findById(req.params['id']);
  if (!record) { res.status(404).json({ success: false, error: 'Record not found', timestamp: new Date().toISOString() }); return; }
  const isPriv = ['Admin', 'Manager', 'Verifier'].includes(req.user?.role || '');
  if (!isPriv && record.ownerId !== req.user?.sub) {
    res.status(403).json({ success: false, error: 'Forbidden', timestamp: new Date().toISOString() }); return;
  }
  res.json({ success: true, data: record, timestamp: new Date().toISOString() });
});

// ── POST /api/records ─────────────────────────────────────────
router.post('/', validate(createRecordSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const start = Date.now();
  try {
    const record = await recordRepo.create(req.body, req.user!.sub, req.user!.sub);

    await auditRepo.create({
      action: AUDIT_ACTIONS.CREATE_RECORD, performedById: req.user!.sub,
      performedByName: req.user!.userId, targetId: record.id, targetType: 'Record',
      details: `New ${req.body.type} for candidate ${req.body.candidateId}`,
      ipAddress: req.ip || '', userAgent: req.headers['user-agent'] || '', success: true,
    });

    res.status(201).json({ success: true, data: record, message: 'Record created', timestamp: new Date().toISOString(), processingTime: Date.now() - start });
  } catch (err) {
    logger.error('POST /records', { error: err });
    res.status(500).json({ success: false, error: 'Failed to create record', timestamp: new Date().toISOString() });
  }
});

// ── PATCH /api/records/:id ────────────────────────────────────
router.patch('/:id', validate(updateRecordSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await recordRepo.findById(req.params['id']);
    if (!existing) { res.status(404).json({ success: false, error: 'Record not found', timestamp: new Date().toISOString() }); return; }

    const isPriv = ['Admin', 'Manager', 'Verifier'].includes(req.user?.role || '');
    if (!isPriv && existing.ownerId !== req.user?.sub) {
      res.status(403).json({ success: false, error: 'Forbidden', timestamp: new Date().toISOString() }); return;
    }

    const currentStatus = existing.status;

    // Priority 8: Terminal records are COMPLETELY immutable — block all updates
    if (TERMINAL_STATUSES.has(currentStatus)) {
      res.status(400).json({
        success: false,
        error: `Record is in terminal status "${currentStatus}" and cannot be updated`,
        allowedNext: [],
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Priority 8: Validate workflow transition (only when status is changing)
    if (req.body.status) {
      const nextStatus = req.body.status;
      const allowed    = VALID_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(nextStatus)) {
        res.status(400).json({
          success: false,
          error: `Invalid transition: "${currentStatus}" → "${nextStatus}"`,
          allowedNext: allowed,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    const updated = await recordRepo.update(req.params['id'], req.body);

    // Priority 6: Specific audit events for Approved / Rejected
    const newStatus  = req.body.status;
    const auditAction = newStatus === 'Approved'  ? AUDIT_ACTIONS.CANDIDATE_APPROVED
                      : newStatus === 'Rejected'  ? AUDIT_ACTIONS.CANDIDATE_REJECTED
                      : AUDIT_ACTIONS.UPDATE_RECORD;

    const auditDetail = newStatus
      ? `Status: ${existing.status} → ${newStatus}${req.body.remarks ? ` | Remarks: ${req.body.remarks}` : ''}`
      : `Updated fields: ${Object.keys(req.body).join(', ')}`;

    await auditRepo.create({
      action: auditAction, performedById: req.user!.sub,
      performedByName: req.user!.userId, targetId: req.params['id'],
      targetType: 'Record', details: auditDetail,
      ipAddress: req.ip || '', userAgent: req.headers['user-agent'] || '', success: true,
    });

    // ── Notification: DB save first, then WS push ──────────────
    // Always save to DB before pushing WS — prevents inconsistent state
    // if DB save fails, WS event is never sent.
    if (newStatus) {
      try {
        const notifTitle   = `Verification ${newStatus}`;
        const notifMessage = `${existing.type} for ${existing.candidateName} is now ${newStatus}.`;
        const notifType    = ['Approved', 'Completed'].includes(newStatus) ? 'success'
                           : ['Rejected', 'Failed'].includes(newStatus)    ? 'error'
                           : 'info';

        // 1. Save to DB first
        await notifRepo.create({
          userId:  existing.ownerId,
          title:   notifTitle,
          message: notifMessage,
          type:    notifType,
          link:    `/records/${existing.id}`,
        });

        // 2. Only after DB save succeeds, push via WebSocket
        notifyUser(existing.ownerId, {
          type:    'notification',
          title:   notifTitle,
          message: notifMessage,
          notifType,
          link:    `/records/${existing.id}`,
        });
      } catch (notifErr) {
        // Non-fatal — log but don't fail the request
        logger.warn('Failed to create notification', { error: notifErr });
      }
    }

    // Email notification for terminal statuses (non-blocking, after WS)
    if (newStatus && ['Completed', 'Approved', 'Rejected', 'Failed'].includes(newStatus)) {
      const owner = await userRepo.findById(existing.ownerId);
      if (owner) {
        sendVerificationCompleteEmail(owner.email, owner.firstName, existing.candidateName, existing.type, newStatus, updated.score).catch(() => {});
      }
    }

    res.json({ success: true, data: updated, message: 'Record updated', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('PATCH /records/:id', { error: err });
    res.status(500).json({ success: false, error: 'Failed to update record', timestamp: new Date().toISOString() });
  }
});

export default router;
