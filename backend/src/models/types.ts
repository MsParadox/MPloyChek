// ============================================================
// MPloyChek v4.0 — Reference Type Definitions
// NOTE: This file is a reference/documentation aid — NOT imported by any module.
// Authoritative types are derived from prisma/schema.prisma (backend) and
// frontend/src/app/core/models/index.ts (frontend).
// ============================================================

export type UserRole     = 'General User' | 'Admin' | 'Verifier' | 'Manager';
export type UserStatus   = 'Active' | 'Inactive' | 'Suspended' | 'Pending';
export type RecordType   = 'Employment Verification' | 'Education Verification' | 'Criminal Check' | 'Credit Check' | 'Reference Check' | 'Address Verification' | 'Drug Test' | 'Social Media Check' | 'Professional License Check';
export type RecordStatus = 'Pending' | 'In Review' | 'Verification Running' | 'In Progress' | 'Completed' | 'Approved' | 'Rejected' | 'Failed' | 'On Hold' | 'Cancelled';
export type Priority     = 'Low' | 'Medium' | 'High' | 'Critical';
export type RiskLevel    = 'Low' | 'Medium' | 'High' | 'Critical';
export type NotifType    = 'info' | 'success' | 'warning' | 'error';
export type AuditAction  = 'LOGIN' | 'LOGOUT' | 'CREATE_USER' | 'UPDATE_USER' | 'DELETE_USER' | 'CREATE_RECORD' | 'UPDATE_RECORD' | 'CREATE_CANDIDATE' | 'UPDATE_CANDIDATE' | 'EXPORT_DATA' | 'VIEW_REPORT' | 'CHANGE_PASSWORD' | 'BULK_ACTION';

export interface User {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  department: string;
  phone: string;
  avatar?: string;
  bio?: string;
  joinDate: string;
  status: UserStatus;
  lastLogin: string | null;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  emailNotifications: boolean;
  smsNotifications: boolean;
  language: string;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  nationality: string;
  currentAddress: string;
  previousAddresses: string[];
  education: EducationEntry[];
  employmentHistory: EmploymentEntry[];
  riskScore: number;        // 0–100 (higher = more risk)
  riskLevel: RiskLevel;
  consentGiven: boolean;
  consentDate: string | null;
  documents: Document[];
  notes: string;
  tags: string[];
  status: 'Active' | 'Archived' | 'Flagged';
  assignedTo: string;       // userId
  createdBy: string;        // userId
  createdAt: string;
  updatedAt: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  startYear: number;
  endYear: number | null;
  verified: boolean;
}

export interface EmploymentEntry {
  company: string;
  position: string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  verified: boolean;
  contactName: string;
  contactPhone: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  size: number;
  url: string;
}

export interface VerificationRecord {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  ownerId: string;
  type: RecordType;
  status: RecordStatus;
  priority: Priority;
  requestedById: string;
  requestedByName: string;
  verifiedBy: string | null;
  verifierName: string | null;
  submittedDate: string;
  dueDate: string;
  completedDate: string | null;
  remarks: string;
  score: number | null;
  details: RecordDetails;
  timeline: TimelineEvent[];
  documents: string[];
  tags: string[];
  billingCode: string;
  estimatedCost: number;
  actualCost: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecordDetails {
  institution?: string;
  position?: string;
  duration?: string;
  result?: string;
  findings?: string;
  additionalNotes?: string;
  referenceContact?: string;
  verificationMethod?: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  event: string;
  description: string;
  performedBy: string;
  status: RecordStatus;
  icon: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotifType;
  read: boolean;
  link: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  performedBy: string;
  performedByName: string;
  targetId: string;
  targetType: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  success: boolean;
}

export interface MonthlyTrend {
  month: string;
  total: number;
  completed: number;
  pending: number;
  failed: number;
  avgScore: number;
}

export interface Database {
  users: User[];
  candidates: Candidate[];
  records: VerificationRecord[];
  notifications: Notification[];
  auditLogs: AuditLog[];
}

// ── API Shapes ─────────────────────────────────────────────
// FIXED: role removed — server loads role from DB, never from client
export interface LoginRequest   { userId: string; password: string; }
export interface LoginResponse  { accessToken: string; refreshToken: string; user: PublicUser; expiresIn: number; }
export interface ApiResponse<T = unknown> { success: boolean; data?: T; message?: string; error?: string; timestamp: string; processingTime?: number; total?: number; }
export interface JwtPayload     { sub: string; userId: string; role: UserRole; iat?: number; exp?: number; }

export interface PublicUser {
  id: string; userId: string; firstName: string; lastName: string;
  email: string; role: UserRole; department: string; phone: string;
  bio?: string; joinDate: string; status: UserStatus; lastLogin: string | null;
  preferences: UserPreferences;
}

export interface CreateUserRequest    { userId: string; firstName: string; lastName: string; email: string; password: string; role: UserRole; department: string; phone: string; }
export interface UpdateUserRequest    { firstName?: string; lastName?: string; email?: string; role?: UserRole; department?: string; phone?: string; status?: UserStatus; bio?: string; preferences?: Partial<UserPreferences>; }
export interface CreateCandidateRequest { firstName: string; lastName: string; email: string; phone: string; dateOfBirth: string; nationality: string; currentAddress: string; notes?: string; tags?: string[]; }
export interface CreateRecordRequest  { candidateId: string; type: RecordType; priority: Priority; dueDate: string; notes?: string; }

export const DEPARTMENTS = ['Administration', 'Engineering', 'Human Resources', 'Finance', 'Operations', 'Sales', 'Marketing', 'Legal', 'Compliance', 'IT Security'];
export const USER_ROLES: UserRole[] = ['General User', 'Admin', 'Verifier', 'Manager'];
