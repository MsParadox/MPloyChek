// ============================================================
// MPloyChek v4.0 — Zod Validation Schemas
// FIX CRITICAL-1: Removed role from loginSchema
//   Role must come from DB, never from the client payload.
// Author: Mohit Sharma
// ============================================================
import { z } from 'zod';

// ── Auth ──────────────────────────────────────────────────────
// FIXED: role removed — backend reads role from DB after password validation
export const loginSchema = z.object({
  userId:   z.string().min(4, 'User ID must be at least 4 characters').max(50).trim(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Public self-registration. Role is NOT accepted from the client — every
// self-registered account is created as a General User by the server.
export const registerSchema = z.object({
  userId:     z.string().min(4, 'User ID must be at least 4 characters').max(50).trim().regex(/^\S+$/, 'No spaces allowed in User ID'),
  firstName:  z.string().min(1).max(100).trim(),
  lastName:   z.string().min(1).max(100).trim(),
  email:      z.string().email('Invalid email address').toLowerCase(),
  password:   z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  department: z.string().min(1).max(100).trim().default('General'),
  phone:      z.union([z.string().trim().min(7).max(20), z.literal('')]).optional().default(''),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8,  'Password must be at least 8 characters')
    .regex(/[A-Z]/,         'Must contain at least one uppercase letter')
    .regex(/[0-9]/,         'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
});

// ── Users ─────────────────────────────────────────────────────
export const createUserSchema = z.object({
  userId:     z.string().min(4).max(50).trim().regex(/^\S+$/, 'No spaces allowed in User ID'),
  firstName:  z.string().min(1).max(100).trim(),
  lastName:   z.string().min(1).max(100).trim(),
  email:      z.string().email('Invalid email address').toLowerCase(),
  password:   z.string().min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  role:       z.enum(['Admin', 'Manager', 'Verifier', 'General User']),
  department: z.string().min(1).max(100).trim(),
  phone:      z.string().min(7).max(20).trim(),
});

export const updateUserSchema = z.object({
  firstName:  z.string().min(1).max(100).trim().optional(),
  lastName:   z.string().min(1).max(100).trim().optional(),
  email:      z.string().email().toLowerCase().optional(),
  role:       z.enum(['Admin', 'Manager', 'Verifier', 'General User']).optional(),
  department: z.string().min(1).max(100).trim().optional(),
  phone:      z.string().min(7).max(20).trim().optional(),
  status:     z.enum(['Active', 'Inactive', 'Suspended', 'Pending']).optional(),
  bio:        z.string().max(500).optional(),
  preferences: z.object({
    emailNotifications: z.boolean().optional(),
    smsNotifications:   z.boolean().optional(),
    language:           z.string().max(10).optional(),
    theme:              z.enum(['dark', 'light']).optional(),
  }).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

// ── Candidates ────────────────────────────────────────────────
export const createCandidateSchema = z.object({
  firstName:      z.string().min(1).max(100).trim(),
  lastName:       z.string().min(1).max(100).trim(),
  email:          z.string().email().toLowerCase(),
  phone:          z.union([z.string().trim().min(7).max(20), z.literal('')]).optional().default(''),
  dateOfBirth:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional().default('1990-01-01'),
  nationality:    z.string().max(100).optional().default('Indian'),
  currentAddress: z.string().max(500).optional().default(''),
  notes:          z.string().max(1000).optional(),
  tags:           z.array(z.string().max(50)).max(20).optional().default([]),
});

export const updateCandidateSchema = z.object({
  firstName:      z.string().min(1).max(100).trim().optional(),
  lastName:       z.string().min(1).max(100).trim().optional(),
  email:          z.string().email().toLowerCase().optional(),
  phone:          z.string().min(7).max(20).trim().optional(),
  nationality:    z.string().max(100).optional(),
  currentAddress: z.string().max(500).optional(),
  notes:          z.string().max(1000).optional(),
  tags:           z.array(z.string().max(50)).max(20).optional(),
  riskScore:      z.number().int().min(0).max(100).optional(),
  riskLevel:      z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  status:         z.enum(['Active', 'Archived', 'Flagged']).optional(),
  consentGiven:   z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

// ── Records ───────────────────────────────────────────────────
const RECORD_TYPES = [
  'Employment Verification', 'Education Verification', 'Criminal Check',
  'Credit Check', 'Reference Check', 'Address Verification',
  'Drug Test', 'Social Media Check', 'Professional License Check',
] as const;

export const createRecordSchema = z.object({
  candidateId: z.string().uuid('Invalid candidate ID'),
  type:        z.enum(RECORD_TYPES, { errorMap: () => ({ message: 'Invalid verification type' }) }),
  priority:    z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  dueDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  notes:       z.string().max(1000).optional(),
});

export const updateRecordSchema = z.object({
  status: z.enum([
    'Pending',
    'In Review',
    'Verification Running',
    'In Progress',
    'Completed',
    'Approved',
    'Rejected',
    'Failed',
    'Cancelled',
    'On Hold',
  ]).optional(),
  score:        z.number().int().min(0).max(100).nullable().optional(),
  remarks:      z.string().max(2000).optional(),
  verifiedById: z.string().uuid().optional(),
  details:      z.record(z.unknown()).optional(),
  actualCost:   z.number().int().positive().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

// ── Search ────────────────────────────────────────────────────
export const searchSchema = z.object({
  q:     z.string().min(2, 'Query must be at least 2 characters').max(100).trim(),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

// ── Pagination ────────────────────────────────────────────────
export const paginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy:   z.string().max(50).optional(),
  sortDir:  z.enum(['asc', 'desc']).default('desc'),
  status:   z.string().optional(),
  type:     z.string().optional(),
  priority: z.string().optional(),
  delay:    z.coerce.number().int().min(0).max(10000).default(0),
});

// ── Documents ─────────────────────────────────────────────────
export const documentTypeValues = [
  'PAN', 'Aadhaar', 'Passport', 'Voter ID', 'Driving Licence',
  'Resume', 'Degree Certificate', 'Mark Sheet', 'Experience Letter',
  'Offer Letter', 'Salary Slip', 'Police Clearance', 'Address Proof',
  'Bank Statement', 'Photo', 'General',
] as const;

export const documentTypeSchema = z.enum(documentTypeValues);

export const uploadDocumentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: documentTypeSchema.optional().default('General'),
});
