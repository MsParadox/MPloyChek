// ============================================================
// MPloyChek v4.0 — Export Routes
// FIX: Use AUDIT_ACTIONS.EXPORT_CREATED (was 'EXPORT_DATA' — not in constants)
// Author: Mohit Sharma
// ============================================================
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { canExportAll } from '../middleware/rbac';
import { recordRepo, candidateRepo, auditRepo, AUDIT_ACTIONS } from '../repositories/index';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

// ── CSV helper ────────────────────────────────────────────────
const toCSV = (rows: Record<string, any>[], cols: string[]): string => {
  const header = cols.join(',');
  const body = rows.map(r =>
    cols.map(c => {
      const v = r[c] ?? '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [header, ...body].join('\n');
};

// ── GET /api/export/records ───────────────────────────────────
router.get('/records', async (req: AuthRequest, res: Response): Promise<void> => {
  const fmt    = (req.query['format'] as string) || 'json';
  const isPriv = ['Admin', 'Manager'].includes(req.user?.role || '');
  try {
    const records = await recordRepo.findAll(isPriv ? undefined : { ownerId: req.user!.sub });

    // FIX 7: Use AUDIT_ACTIONS.EXPORT_CREATED (not 'EXPORT_DATA')
    await auditRepo.create({
      action:          AUDIT_ACTIONS.EXPORT_CREATED,
      performedById:   req.user!.sub,
      performedByName: req.user!.userId,
      targetId:        'records',
      targetType:      'Report',
      details:         `Exported ${records.length} records as ${fmt.toUpperCase()}`,
      ipAddress:       req.ip || '',
      userAgent:       req.headers['user-agent'] || '',
      success:         true,
    });

    if (fmt === 'csv') {
      const cols = [
        'id', 'candidateName', 'candidateEmail', 'type', 'status', 'priority',
        'score', 'submittedDate', 'dueDate', 'completedDate',
        'remarks', 'billingCode', 'estimatedCost', 'actualCost',
      ];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=mploychek-records.csv');
      res.send(toCSV(records as any[], cols));
    } else {
      res.json({ success: true, data: records, total: records.length, exportedAt: new Date().toISOString() });
    }
  } catch (err) {
    logger.error('GET /export/records', { error: err });
    res.status(500).json({ success: false, error: 'Export failed', timestamp: new Date().toISOString() });
  }
});

// ── GET /api/export/candidates ────────────────────────────────
router.get('/candidates', canExportAll, async (req: AuthRequest, res: Response): Promise<void> => {
  const fmt = (req.query['format'] as string) || 'json';
  try {
    const candidates = await candidateRepo.findAll();

    await auditRepo.create({
      action:          AUDIT_ACTIONS.EXPORT_CREATED,
      performedById:   req.user!.sub,
      performedByName: req.user!.userId,
      targetId:        'candidates',
      targetType:      'Report',
      details:         `Exported ${candidates.length} candidates as ${fmt.toUpperCase()}`,
      ipAddress:       req.ip || '',
      userAgent:       req.headers['user-agent'] || '',
      success:         true,
    });

    if (fmt === 'csv') {
      const cols = [
        'id', 'firstName', 'lastName', 'email', 'phone', 'nationality',
        'dateOfBirth', 'riskScore', 'riskLevel', 'status', 'consentGiven', 'notes',
      ];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=mploychek-candidates.csv');
      res.send(toCSV(candidates as any[], cols));
    } else {
      res.json({ success: true, data: candidates, total: candidates.length, exportedAt: new Date().toISOString() });
    }
  } catch (err) {
    logger.error('GET /export/candidates', { error: err });
    res.status(500).json({ success: false, error: 'Export failed', timestamp: new Date().toISOString() });
  }
});

// ── GET /api/export/audit-logs ────────────────────────────────
router.get('/audit-logs', canExportAll, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const logs = await auditRepo.findAll(500);
    const cols = ['id', 'timestamp', 'action', 'performedByName', 'targetType', 'targetId', 'details', 'success'];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=mploychek-audit.csv');
    res.send(toCSV(logs as any[], cols));
  } catch (err) {
    logger.error('GET /export/audit-logs', { error: err });
    res.status(500).json({ success: false, error: 'Export failed', timestamp: new Date().toISOString() });
  }
});

export default router;
