// ============================================================
// MPloyChek v4.0 — Candidates Routes
// FIX: Use AUDIT_ACTIONS constants (not hardcoded strings)
// Author: Mohit Sharma
// ============================================================
import { Router, Response } from 'express';
import { authenticate, AuthRequest, withDelay } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { canDeleteCandidate } from '../middleware/rbac';
import { createCandidateSchema, updateCandidateSchema } from '../schemas/index';
import { candidateRepo, auditRepo, AUDIT_ACTIONS } from '../repositories/index';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

// ── GET /api/candidates ───────────────────────────────────────
router.get('/', withDelay, async (req: AuthRequest, res: Response): Promise<void> => {
  const start  = Date.now();
  const isPriv = req.user?.role === 'Admin' || req.user?.role === 'Manager';
  try {
    const candidates = await candidateRepo.findAll(
      isPriv ? undefined : { createdById: req.user!.sub }
    );
    res.json({
      success: true, data: candidates, total: candidates.length,
      timestamp: new Date().toISOString(), processingTime: Date.now() - start,
    });
  } catch (err) {
    logger.error('GET /candidates', { error: err });
    res.status(500).json({ success: false, error: 'Failed to fetch candidates', timestamp: new Date().toISOString() });
  }
});

// ── GET /api/candidates/:id ───────────────────────────────────
router.get('/:id', withDelay, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const c = await candidateRepo.findById(req.params['id']);
    if (!c) { res.status(404).json({ success: false, error: 'Candidate not found', timestamp: new Date().toISOString() }); return; }
    res.json({ success: true, data: c, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('GET /candidates/:id', { error: err });
    res.status(500).json({ success: false, error: 'Failed to fetch candidate', timestamp: new Date().toISOString() });
  }
});

// ── POST /api/candidates ──────────────────────────────────────
router.post('/', validate(createCandidateSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const c = await candidateRepo.create(req.body, req.user!.sub);
    // FIX 6: Use AUDIT_ACTIONS.CANDIDATE_CREATED (not hardcoded 'CREATE_CANDIDATE')
    await auditRepo.create({
      action:          AUDIT_ACTIONS.CANDIDATE_CREATED,
      performedById:   req.user!.sub,
      performedByName: req.user!.userId,
      targetId:        c.id,
      targetType:      'Candidate',
      details:         `Created candidate: ${c.firstName} ${c.lastName} (${c.email})`,
      ipAddress:       req.ip || '',
      userAgent:       req.headers['user-agent'] || '',
      success:         true,
    });
    res.status(201).json({ success: true, data: c, message: 'Candidate created', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('POST /candidates', { error: err });
    res.status(500).json({ success: false, error: 'Failed to create candidate', timestamp: new Date().toISOString() });
  }
});

// ── PATCH /api/candidates/:id ─────────────────────────────────
router.patch('/:id', validate(updateCandidateSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await candidateRepo.findById(req.params['id']);
    if (!existing) { res.status(404).json({ success: false, error: 'Candidate not found', timestamp: new Date().toISOString() }); return; }

    const updated = await candidateRepo.update(req.params['id'], req.body);

    // FIX 6: Use AUDIT_ACTIONS.CANDIDATE_UPDATED
    await auditRepo.create({
      action:          AUDIT_ACTIONS.CANDIDATE_UPDATED,
      performedById:   req.user!.sub,
      performedByName: req.user!.userId,
      targetId:        req.params['id'],
      targetType:      'Candidate',
      details:         `Updated fields: ${Object.keys(req.body).join(', ')}`,
      ipAddress:       req.ip || '',
      userAgent:       req.headers['user-agent'] || '',
      success:         true,
    });
    res.json({ success: true, data: updated, message: 'Candidate updated', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('PATCH /candidates/:id', { error: err });
    res.status(500).json({ success: false, error: 'Failed to update candidate', timestamp: new Date().toISOString() });
  }
});

// ── DELETE /api/candidates/:id ────────────────────────────────
router.delete('/:id', canDeleteCandidate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await candidateRepo.findById(req.params['id']);
    if (!existing) { res.status(404).json({ success: false, error: 'Candidate not found', timestamp: new Date().toISOString() }); return; }

    const deleted = await candidateRepo.delete(req.params['id']);
    if (!deleted) { res.status(500).json({ success: false, error: 'Delete failed', timestamp: new Date().toISOString() }); return; }

    // FIX 6: Use AUDIT_ACTIONS.CANDIDATE_DELETED
    await auditRepo.create({
      action:          AUDIT_ACTIONS.CANDIDATE_DELETED,
      performedById:   req.user!.sub,
      performedByName: req.user!.userId,
      targetId:        req.params['id'],
      targetType:      'Candidate',
      details:         `Deleted candidate: ${existing.firstName} ${existing.lastName}`,
      ipAddress:       req.ip || '',
      userAgent:       req.headers['user-agent'] || '',
      success:         true,
    });
    res.json({ success: true, message: 'Candidate deleted', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('DELETE /candidates/:id', { error: err });
    res.status(500).json({ success: false, error: 'Failed to delete candidate', timestamp: new Date().toISOString() });
  }
});

export default router;
