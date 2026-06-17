// ============================================================
// MPloyChek v4.0 — Analytics Routes
// FIX: getMonthlyTrends used display strings on raw Prisma enums → always 0
//      Date range query ternary was logically broken
// Author: Mohit Sharma
// ============================================================
import { Router, Response } from 'express';
import { authenticate, AuthRequest, withDelay } from '../middleware/auth';
import { canViewAnalytics, canViewAudit } from '../middleware/rbac';
import { recordRepo, auditRepo, candidateRepo } from '../repositories/index';
import { userRepo } from '../repositories/user.repository';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate, canViewAnalytics);

// ── Prisma raw enum values (what the DB stores) ───────────────
// FIX: analytics queries Prisma directly, so must use UPPERCASE enum values
const COMPLETED_STATUSES  = ['COMPLETED', 'APPROVED'];
const IN_PROGRESS_STATUSES = ['PENDING', 'IN_REVIEW', 'VERIFICATION_RUNNING', 'IN_PROGRESS', 'ON_HOLD'];
const FAILED_STATUSES     = ['FAILED', 'REJECTED', 'CANCELLED'];

// ── GET /api/analytics/overview ───────────────────────────────
router.get('/overview', withDelay, async (_req: AuthRequest, res: Response): Promise<void> => {
  const start = Date.now();
  try {
    const [stats, records, candidates, trends, recentActivity] = await Promise.all([
      userRepo.getStats(),
      recordRepo.findAll(),       // uses repository → serialized display strings
      candidateRepo.findAll(),    // uses repository → serialized display strings
      getMonthlyTrends(6),
      auditRepo.findAll(10),
    ]);

    const scored = records.filter((r: any) => r.score !== null);
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, r: any) => s + (r.score || 0), 0) / scored.length)
      : 0;

    // These use REPOSITORY output (display strings like 'Completed', 'Approved')
    const byStatus = records.reduce((a: any, r: any) => {
      a[r.status] = (a[r.status] || 0) + 1; return a;
    }, {} as Record<string, number>);

    const byType = records.reduce((a: any, r: any) => {
      a[r.type] = (a[r.type] || 0) + 1; return a;
    }, {} as Record<string, number>);

    const byPriority = records.reduce((a: any, r: any) => {
      a[r.priority] = (a[r.priority] || 0) + 1; return a;
    }, {} as Record<string, number>);

    const byRisk = candidates.reduce((a: any, c: any) => {
      a[c.riskLevel] = (a[c.riskLevel] || 0) + 1; return a;
    }, {} as Record<string, number>);

    const completionRate = records.length
      ? Math.round(
          (records.filter((r: any) => ['Completed', 'Approved'].includes(r.status)).length / records.length) * 100
        )
      : 0;

    const totalRevenue = records.reduce((s, r: any) => s + (r.actualCost || r.estimatedCost || 0), 0);

    res.json({
      success: true,
      data: {
        summary: {
          ...stats, avgScore, completionRate, totalRevenue,
          flaggedCandidates: candidates.filter((c: any) => c.status === 'Flagged').length,
          highRisk: candidates.filter((c: any) => ['High', 'Critical'].includes(c.riskLevel)).length,
        },
        byStatus, byType, byPriority, byRisk,
        monthlyTrends: trends,
        recentActivity,
      },
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - start,
    });
  } catch (err) {
    logger.error('GET /analytics/overview', { error: err });
    res.status(500).json({ success: false, error: 'Analytics failed', timestamp: new Date().toISOString() });
  }
});

// ── GET /api/analytics/audit-logs ────────────────────────────
router.get('/audit-logs', canViewAudit, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const logs = await auditRepo.findAll(200);
    res.json({ success: true, data: logs, total: logs.length, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('GET /analytics/audit-logs', { error: err });
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs', timestamp: new Date().toISOString() });
  }
});

// ── getMonthlyTrends ──────────────────────────────────────────
// FIX: 
//  1. Date range was broken — ternary condition was comparing dates (returned boolean, not a date)
//  2. Status comparisons used display strings on raw Prisma enum values
//     e.g. r.status === 'Completed' never matched 'COMPLETED' from DB
async function getMonthlyTrends(months: number) {
  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    // FIX: Simple, correct date range calculation (no ternary)
    const gte = new Date(now.getFullYear(), now.getMonth() - i,     1);
    const lt  = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

    const recs = await prisma.record.findMany({
      where: { createdAt: { gte, lt } },
      select: { status: true, score: true },
    });

    const scored = recs.filter(r => r.score !== null);

    // FIX: Use raw Prisma enum values (COMPLETED not 'Completed')
    result.push({
      month:     gte.toLocaleString('default', { month: 'short', year: '2-digit' }),
      total:     recs.length,
      completed: recs.filter(r => COMPLETED_STATUSES.includes(r.status as string)).length,
      pending:   recs.filter(r => IN_PROGRESS_STATUSES.includes(r.status as string)).length,
      failed:    recs.filter(r => FAILED_STATUSES.includes(r.status as string)).length,
      avgScore:  scored.length
        ? Math.round(scored.reduce((s, r) => s + (r.score || 0), 0) / scored.length)
        : 0,
    });
  }
  return result;
}

export default router;
