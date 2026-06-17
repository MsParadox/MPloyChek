// ============================================================
// MPloyChek v4.0 — All Repositories
// FIX Priority 1: Import enums directly from @prisma/client
// Author: Mohit Sharma
// ============================================================
import prisma from '../lib/prisma';
import * as crypto from 'crypto';
// FIX: Import all enums from Prisma instead of defining manually
import { CandidateStatus, RiskLevel, Priority, RecordStatus } from '@prisma/client';

// ============================================================
// Repository: RefreshToken
// ============================================================
export class RefreshTokenRepository {
  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async create(userId: string, rawToken: string, expiresAt: Date) {
    return prisma.refreshToken.create({
      data: { userId, tokenHash: this.hash(rawToken), expiresAt },
    });
  }

  async findByToken(rawToken: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash: this.hash(rawToken) } });
  }

  async revoke(id: string) {
    return prisma.refreshToken.update({ where: { id }, data: { revoked: true } });
  }

  async revokeAllForUser(userId: string) {
    return prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
  }

  async deleteExpired() {
    return prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  async isValid(rawToken: string): Promise<string | null> {
    const record = await this.findByToken(rawToken);
    if (!record || record.revoked || record.expiresAt < new Date()) return null;
    return record.userId;
  }
}
export const refreshTokenRepo = new RefreshTokenRepository();

// ============================================================
// Repository: Notification
// ============================================================
export class NotificationRepository {
  async findByUserId(userId: string) {
    return prisma.notification.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(id: string) {
    return prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }

  async create(data: { userId: string; title: string; message: string; type: string; link?: string }) {
    return prisma.notification.create({ data });
  }
}
export const notifRepo = new NotificationRepository();

// ============================================================
// Repository: Candidate
// FIX: Using imported Prisma enums instead of manual const objects
// ============================================================

// API ↔ Enum maps (now type-safe with Prisma types)
const riskMap: Record<string, RiskLevel> = {
  'Low': RiskLevel.LOW, 'Medium': RiskLevel.MEDIUM,
  'High': RiskLevel.HIGH, 'Critical': RiskLevel.CRITICAL,
};
const riskApiMap: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'Low', [RiskLevel.MEDIUM]: 'Medium',
  [RiskLevel.HIGH]: 'High', [RiskLevel.CRITICAL]: 'Critical',
};
const statusMap: Record<string, CandidateStatus> = {
  'Active': CandidateStatus.ACTIVE, 'Archived': CandidateStatus.ARCHIVED,
  'Flagged': CandidateStatus.FLAGGED,
};
const statusApiMap: Record<CandidateStatus, string> = {
  [CandidateStatus.ACTIVE]: 'Active', [CandidateStatus.ARCHIVED]: 'Archived',
  [CandidateStatus.FLAGGED]: 'Flagged',
};

const CANDIDATE_INCLUDE = {
  education: true, employment: true,
  documents: true, previousAddresses: true,
  assignedTo: { select: { id: true, firstName: true, lastName: true, userId: true } },
  createdBy:  { select: { id: true, firstName: true, lastName: true, userId: true } },
};

function serializeCandidate(c: any) {
  return {
    id: c.id, firstName: c.firstName, lastName: c.lastName,
    email: c.email, phone: c.phone,
    // FIX Priority 2: dateOfBirth is now DateTime — return ISO date string
    dateOfBirth: c.dateOfBirth instanceof Date
      ? c.dateOfBirth.toISOString().split('T')[0]
      : c.dateOfBirth,
    nationality: c.nationality, currentAddress: c.currentAddress,
    previousAddresses: c.previousAddresses?.map((p: any) => p.address) ?? [],
    education: c.education ?? [],
    employmentHistory: (c.employment ?? []).map((e: any) => ({
      ...e,
      // FIX Priority 2: serialize DateTime dates in employment
      startDate: e.startDate instanceof Date ? e.startDate.toISOString().split('T')[0] : e.startDate,
      endDate:   e.endDate   instanceof Date ? e.endDate.toISOString().split('T')[0]   : e.endDate,
    })),
    riskScore: c.riskScore, riskLevel: riskApiMap[c.riskLevel as RiskLevel],
    consentGiven: c.consentGiven, consentDate: c.consentDate?.toISOString() ?? null,
    documents: c.documents ?? [], notes: c.notes ?? '', tags: c.tags,
    status: statusApiMap[c.status as CandidateStatus],
    assignedTo: c.assignedTo?.id ?? null, createdBy: c.createdBy?.id ?? null,
    createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
  };
}

export class CandidateRepository {
  async findAll(options?: { createdById?: string; assignedToId?: string }) {
    const where: any = {};
    if (options?.createdById)  where.OR = [{ createdById: options.createdById }, { assignedToId: options.createdById }];
    if (options?.assignedToId) where.assignedToId = options.assignedToId;
    const candidates = await prisma.candidate.findMany({
      where, include: CANDIDATE_INCLUDE, orderBy: { createdAt: 'desc' },
    });
    return candidates.map(serializeCandidate);
  }

  async findById(id: string) {
    const c = await prisma.candidate.findUnique({ where: { id }, include: CANDIDATE_INCLUDE });
    return c ? serializeCandidate(c) : null;
  }

  async create(data: any, createdById: string) {
    const c = await prisma.candidate.create({
      data: {
        firstName: data.firstName, lastName: data.lastName,
        email: data.email, phone: data.phone || '',
        // FIX Priority 2: parse string date to DateTime
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : new Date('1990-01-01'),
        nationality: data.nationality || 'Indian',
        currentAddress: data.currentAddress || '',
        notes: data.notes || '', tags: data.tags || [],
        assignedToId: createdById, createdById,
      },
      include: CANDIDATE_INCLUDE,
    });
    return serializeCandidate(c);
  }

  async update(id: string, data: any) {
    const patch: any = {};
    if (data.firstName      !== undefined) patch.firstName      = data.firstName;
    if (data.lastName       !== undefined) patch.lastName       = data.lastName;
    if (data.email          !== undefined) patch.email          = data.email;
    if (data.phone          !== undefined) patch.phone          = data.phone;
    if (data.nationality    !== undefined) patch.nationality    = data.nationality;
    if (data.currentAddress !== undefined) patch.currentAddress = data.currentAddress;
    if (data.notes          !== undefined) patch.notes          = data.notes;
    if (data.tags           !== undefined) patch.tags           = data.tags;
    if (data.riskScore      !== undefined) patch.riskScore      = data.riskScore;
    if (data.riskLevel      !== undefined) patch.riskLevel      = riskMap[data.riskLevel] ?? RiskLevel.LOW;
    if (data.status         !== undefined) patch.status         = statusMap[data.status] ?? CandidateStatus.ACTIVE;
    if (data.consentGiven   !== undefined) {
      patch.consentGiven = data.consentGiven;
      if (data.consentGiven) patch.consentDate = new Date();
    }
    const c = await prisma.candidate.update({ where: { id }, data: patch, include: CANDIDATE_INCLUDE });
    return serializeCandidate(c);
  }

  async delete(id: string): Promise<boolean> {
    try { await prisma.candidate.delete({ where: { id } }); return true; } catch { return false; }
  }
}
export const candidateRepo = new CandidateRepository();

// ============================================================
// Repository: Record
// FIX: Using imported Prisma Priority & RecordStatus enums
// ============================================================

// API ↔ Enum maps using Prisma-imported types
const priorityMap: Record<string, Priority> = {
  'Low': Priority.LOW, 'Medium': Priority.MEDIUM,
  'High': Priority.HIGH, 'Critical': Priority.CRITICAL,
};
const priorityApiMap: Record<Priority, string> = {
  [Priority.LOW]: 'Low', [Priority.MEDIUM]: 'Medium',
  [Priority.HIGH]: 'High', [Priority.CRITICAL]: 'Critical',
};

// FIX Priority 8: Proper status mapping with workflow stages
const statusToEnumMap: Record<string, RecordStatus> = {
  'Pending':              RecordStatus.PENDING,
  'In Review':            RecordStatus.IN_REVIEW,
  'Verification Running': RecordStatus.VERIFICATION_RUNNING,
  'In Progress':          RecordStatus.IN_PROGRESS,
  'Completed':            RecordStatus.COMPLETED,
  'Approved':             RecordStatus.APPROVED,
  'Rejected':             RecordStatus.REJECTED,
  'Failed':               RecordStatus.FAILED,
  'On Hold':              RecordStatus.ON_HOLD,
  'Cancelled':            RecordStatus.CANCELLED,
};
const enumToStatusMap: Record<RecordStatus, string> = {
  [RecordStatus.PENDING]:              'Pending',
  [RecordStatus.IN_REVIEW]:            'In Review',
  [RecordStatus.VERIFICATION_RUNNING]: 'Verification Running',
  [RecordStatus.IN_PROGRESS]:          'In Progress',
  [RecordStatus.COMPLETED]:            'Completed',
  [RecordStatus.APPROVED]:             'Approved',
  [RecordStatus.REJECTED]:             'Rejected',
  [RecordStatus.FAILED]:               'Failed',
  [RecordStatus.ON_HOLD]:              'On Hold',
  [RecordStatus.CANCELLED]:            'Cancelled',
};

const RECORD_INCLUDE = {
  candidate:   { select: { id: true, firstName: true, lastName: true, email: true } },
  requestedBy: { select: { id: true, firstName: true, lastName: true } },
  verifiedBy:  { select: { id: true, firstName: true, lastName: true } },
  timeline:    { orderBy: { date: 'asc' as const } },
};

function serializeRecord(r: any) {
  return {
    id: r.id, candidateId: r.candidateId,
    candidateName:  `${r.candidate.firstName} ${r.candidate.lastName}`,
    candidateEmail: r.candidate.email,
    ownerId:     r.ownerId,
    type:        r.type,
    // FIX Priority 8: return display-friendly status string
    status:      enumToStatusMap[r.status as RecordStatus] ?? r.status,
    priority:    priorityApiMap[r.priority as Priority],
    requestedById:   r.requestedById,
    requestedByName: `${r.requestedBy.firstName} ${r.requestedBy.lastName}`,
    verifiedBy:  r.verifiedById ?? null,
    verifierName: r.verifiedBy ? `${r.verifiedBy.firstName} ${r.verifiedBy.lastName}` : null,
    // FIX Priority 2: serialize DateTime date fields
    submittedDate: r.submittedDate instanceof Date ? r.submittedDate.toISOString() : r.submittedDate,
    dueDate:       r.dueDate instanceof Date       ? r.dueDate.toISOString()       : r.dueDate,
    completedDate: r.completedDate instanceof Date ? r.completedDate.toISOString() : (r.completedDate ?? null),
    remarks: r.remarks ?? '', score: r.score ?? null,
    details: r.details ?? {}, tags: r.tags,
    billingCode: r.billingCode, estimatedCost: r.estimatedCost, actualCost: r.actualCost ?? null,
    timeline: r.timeline.map((t: any) => ({
      id: t.id, date: t.date.toISOString(), event: t.event,
      description: t.description, performedBy: t.performedBy,
      status: t.status, icon: t.icon,
    })),
    documents: [], createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

export class RecordRepository {
  async findAll(options?: { ownerId?: string; candidateId?: string; status?: string; type?: string; priority?: string }) {
    const where: any = {};
    if (options?.ownerId)     where.ownerId     = options.ownerId;
    if (options?.candidateId) where.candidateId = options.candidateId;
    if (options?.status)      where.status      = statusToEnumMap[options.status] ?? options.status;
    if (options?.type)        where.type        = options.type;
    if (options?.priority)    where.priority    = priorityMap[options.priority] ?? undefined;
    const records = await prisma.record.findMany({ where, include: RECORD_INCLUDE, orderBy: { createdAt: 'desc' } });
    return records.map(serializeRecord);
  }

  async findById(id: string) {
    const r = await prisma.record.findUnique({ where: { id }, include: RECORD_INCLUDE });
    return r ? serializeRecord(r) : null;
  }

  async create(data: any, requestedById: string, ownerId: string) {
    const billingCode = `BIL-${Date.now().toString().slice(-6)}`;
    const costMap: Record<string, number> = {
      'Employment Verification': 2500, 'Education Verification': 1500,
      'Criminal Check': 1000, 'Credit Check': 800, 'Reference Check': 800,
      'Address Verification': 600, 'Drug Test': 1200, 'Social Media Check': 500,
      'Professional License Check': 1800,
    };
    const r = await prisma.record.create({
      data: {
        candidateId: data.candidateId, ownerId, requestedById,
        type: data.type,
        status: RecordStatus.PENDING,  // FIX: Use enum
        priority: priorityMap[data.priority] ?? Priority.MEDIUM,
        submittedDate: new Date(), // FIX: DateTime, not string
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        remarks: data.notes ?? '', billingCode,
        estimatedCost: costMap[data.type] ?? 1000,
        timeline: {
          create: [{
            event: 'Record Created',
            description: `${data.type} verification request submitted.`,
            performedBy: 'System', status: 'Pending', icon: 'create',
          }],
        },
      },
      include: RECORD_INCLUDE,
    });
    return serializeRecord(r);
  }

  async update(id: string, data: any) {
    const patch: any = {};
    if (data.status !== undefined) {
      patch.status = statusToEnumMap[data.status] ?? data.status;
      // FIX Priority 8: set completedDate when terminal status reached
      if (['Completed', 'Approved', 'Rejected', 'Failed', 'Cancelled'].includes(data.status)) {
        patch.completedDate = new Date();
      }
    }
    if (data.remarks      !== undefined) patch.remarks      = data.remarks;
    if (data.score        !== undefined) patch.score        = data.score;
    if (data.verifiedById !== undefined) patch.verifiedById = data.verifiedById;
    if (data.details      !== undefined) patch.details      = data.details;
    if (data.actualCost   !== undefined) patch.actualCost   = data.actualCost;
    const r = await prisma.record.update({ where: { id }, data: patch, include: RECORD_INCLUDE });
    return serializeRecord(r);
  }

  async getSummary() {
    const [total, byStatus, avgScore] = await Promise.all([
      prisma.record.count(),
      prisma.record.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.record.aggregate({ _avg: { score: true } }),
    ]);
    // Convert enum keys to display labels
    const byStatusDisplay = Object.fromEntries(
      byStatus.map((s: any) => [enumToStatusMap[s.status as RecordStatus] ?? s.status, s._count.id])
    );
    return { total, byStatus: byStatusDisplay, avgScore: Math.round(avgScore._avg.score ?? 0) };
  }
}
export const recordRepo = new RecordRepository();

// ============================================================
// Repository: Document
// Priority 3: Document management
// ============================================================
export class DocumentRepository {
  async findByCandidateId(candidateId: string) {
    return prisma.document.findMany({
      where: { candidateId }, orderBy: { uploadedAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.document.findUnique({ where: { id } });
  }

  async create(data: {
    candidateId: string; name: string; type: string;
    storagePath: string; storageUrl: string; mimeType: string;
    sizeBytes: number; uploadedBy: string;
  }) {
    return prisma.document.create({ data });
  }

  async delete(id: string): Promise<boolean> {
    try { await prisma.document.delete({ where: { id } }); return true; } catch { return false; }
  }
}
export const documentRepo = new DocumentRepository();

// ============================================================
// Repository: AuditLog
// Priority 6: Expanded audit log events
// ============================================================
// All supported audit actions (single source of truth)
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN:             'LOGIN',
  LOGIN_FAILED:      'LOGIN_FAILED',
  LOGOUT:            'LOGOUT',
  CHANGE_PASSWORD:   'CHANGE_PASSWORD',
  TOKEN_REFRESHED:   'TOKEN_REFRESHED',
  // Users
  USER_CREATED:      'USER_CREATED',
  USER_UPDATED:      'USER_UPDATED',
  USER_DELETED:      'USER_DELETED',
  ROLE_CHANGED:      'ROLE_CHANGED',
  // Candidates
  CANDIDATE_CREATED: 'CANDIDATE_CREATED',
  CANDIDATE_UPDATED: 'CANDIDATE_UPDATED',
  CANDIDATE_DELETED: 'CANDIDATE_DELETED',
  CANDIDATE_APPROVED:'CANDIDATE_APPROVED',
  CANDIDATE_REJECTED:'CANDIDATE_REJECTED',
  // Records
  CREATE_RECORD:     'CREATE_RECORD',
  UPDATE_RECORD:     'UPDATE_RECORD',
  // Documents (Priority 3)
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_DELETED:  'DOCUMENT_DELETED',
  // Reports
  EXPORT_CREATED:    'EXPORT_CREATED',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

export class AuditRepository {
  async create(data: {
    action: string; performedById: string; performedByName: string;
    targetId: string; targetType: string; details: string;
    ipAddress: string; userAgent: string; success: boolean;
  }) {
    return prisma.auditLog.create({ data }).catch((err) => {
      // Audit failures must never crash the main request — log only
      console.error('[AuditLog] Failed to write audit entry:', err?.message ?? err);
      return null;
    });
  }

  async findAll(limit = 200) {
    return prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: limit });
  }
}
export const auditRepo = new AuditRepository();
