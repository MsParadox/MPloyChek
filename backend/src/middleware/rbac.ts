// ============================================================
// MPloyChek — Central RBAC Middleware & Permission System
// Single source of truth for all access control
// Author: Mohit Sharma
// ============================================================
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// ── Permission constants ──────────────────────────────────────
export const PERMISSIONS = {
  // User management
  USER_READ_ALL:    'user:read:all',
  USER_READ_SELF:   'user:read:self',
  USER_CREATE:      'user:create',
  USER_UPDATE_ALL:  'user:update:all',
  USER_UPDATE_SELF: 'user:update:self',
  USER_DELETE:      'user:delete',
  USER_VIEW_STATS:  'user:view:stats',

  // Candidate management
  CANDIDATE_READ_ALL:    'candidate:read:all',
  CANDIDATE_READ_ASSIGNED: 'candidate:read:assigned',
  CANDIDATE_CREATE:      'candidate:create',
  CANDIDATE_UPDATE:      'candidate:update',
  CANDIDATE_DELETE:      'candidate:delete',

  // Records
  RECORD_READ_ALL:   'record:read:all',
  RECORD_READ_OWN:   'record:read:own',
  RECORD_CREATE:     'record:create',
  RECORD_UPDATE_ALL: 'record:update:all',
  RECORD_UPDATE_OWN: 'record:update:own',

  // Analytics
  ANALYTICS_VIEW:    'analytics:view',
  AUDIT_VIEW:        'audit:view',
  AUDIT_EXPORT:      'audit:export',

  // Export
  EXPORT_OWN:        'export:own',
  EXPORT_ALL:        'export:all',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ── Role → Permission mapping ─────────────────────────────────
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  'Admin': [
    PERMISSIONS.USER_READ_ALL,    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE_ALL,  PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_VIEW_STATS,  PERMISSIONS.USER_READ_SELF,
    PERMISSIONS.USER_UPDATE_SELF,

    PERMISSIONS.CANDIDATE_READ_ALL,    PERMISSIONS.CANDIDATE_CREATE,
    PERMISSIONS.CANDIDATE_UPDATE,      PERMISSIONS.CANDIDATE_DELETE,

    PERMISSIONS.RECORD_READ_ALL,  PERMISSIONS.RECORD_CREATE,
    PERMISSIONS.RECORD_UPDATE_ALL,

    PERMISSIONS.ANALYTICS_VIEW,   PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,     PERMISSIONS.EXPORT_ALL,
    PERMISSIONS.EXPORT_OWN,
  ],

  'Manager': [
    PERMISSIONS.USER_READ_ALL,    PERMISSIONS.USER_VIEW_STATS,
    PERMISSIONS.USER_READ_SELF,   PERMISSIONS.USER_UPDATE_SELF,

    PERMISSIONS.CANDIDATE_READ_ALL,  PERMISSIONS.CANDIDATE_CREATE,
    PERMISSIONS.CANDIDATE_UPDATE,

    PERMISSIONS.RECORD_READ_ALL,  PERMISSIONS.RECORD_CREATE,
    PERMISSIONS.RECORD_UPDATE_ALL,

    PERMISSIONS.ANALYTICS_VIEW,   PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.EXPORT_ALL,       PERMISSIONS.EXPORT_OWN,
  ],

  'Verifier': [
    PERMISSIONS.USER_READ_SELF,   PERMISSIONS.USER_UPDATE_SELF,

    PERMISSIONS.CANDIDATE_READ_ASSIGNED, PERMISSIONS.CANDIDATE_UPDATE,

    PERMISSIONS.RECORD_READ_ALL,  PERMISSIONS.RECORD_CREATE,
    PERMISSIONS.RECORD_UPDATE_ALL,

    PERMISSIONS.ANALYTICS_VIEW,   PERMISSIONS.EXPORT_OWN,
  ],

  'General User': [
    PERMISSIONS.USER_READ_SELF,   PERMISSIONS.USER_UPDATE_SELF,

    PERMISSIONS.CANDIDATE_READ_ASSIGNED, PERMISSIONS.CANDIDATE_CREATE,

    PERMISSIONS.RECORD_READ_OWN,  PERMISSIONS.RECORD_CREATE,
    PERMISSIONS.RECORD_UPDATE_OWN,

    PERMISSIONS.EXPORT_OWN,
  ],
};

// ── Check if a role has a permission ─────────────────────────
export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// ── Middleware factory ────────────────────────────────────────
export function requirePermission(permission: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role || !hasPermission(role, permission)) {
      res.status(403).json({
        success:   false,
        error:     'Insufficient permissions',
        required:  permission,
        yourRole:  role || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next();
  };
}

// ── Convenience wrappers (used in routes) ─────────────────────
export const canReadAllUsers      = requirePermission(PERMISSIONS.USER_READ_ALL);
export const canCreateUser        = requirePermission(PERMISSIONS.USER_CREATE);
export const canUpdateAllUsers    = requirePermission(PERMISSIONS.USER_UPDATE_ALL);
export const canDeleteUser        = requirePermission(PERMISSIONS.USER_DELETE);
export const canViewStats         = requirePermission(PERMISSIONS.USER_VIEW_STATS);
export const canReadAllCandidates = requirePermission(PERMISSIONS.CANDIDATE_READ_ALL);
export const canDeleteCandidate   = requirePermission(PERMISSIONS.CANDIDATE_DELETE);
export const canReadAllRecords    = requirePermission(PERMISSIONS.RECORD_READ_ALL);
export const canUpdateAllRecords  = requirePermission(PERMISSIONS.RECORD_UPDATE_ALL);
export const canViewAnalytics     = requirePermission(PERMISSIONS.ANALYTICS_VIEW);
export const canViewAudit         = requirePermission(PERMISSIONS.AUDIT_VIEW);
export const canExportAll         = requirePermission(PERMISSIONS.EXPORT_ALL);
