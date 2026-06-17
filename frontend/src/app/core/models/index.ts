// ============================================================
// MPloyChek v4.0 — Frontend TypeScript Models
// Single source of truth for all shared types
// Author: Mohit Sharma
// ============================================================

// ── Primitive types ───────────────────────────────────────────
export type UserRole     = 'General User' | 'Admin' | 'Verifier' | 'Manager';
export type UserStatus   = 'Active' | 'Inactive' | 'Suspended' | 'Pending';
export type Priority     = 'Low' | 'Medium' | 'High' | 'Critical';
export type RiskLevel    = 'Low' | 'Medium' | 'High' | 'Critical';
export type RecordType   =
  | 'Employment Verification' | 'Education Verification' | 'Criminal Check'
  | 'Credit Check' | 'Reference Check' | 'Address Verification'
  | 'Drug Test' | 'Social Media Check' | 'Professional License Check';

// Single RecordStatus definition — all v4.0 workflow states
export type RecordStatus =
  | 'Pending'
  | 'In Review'
  | 'Verification Running'
  | 'In Progress'
  | 'Completed'
  | 'Approved'
  | 'Rejected'
  | 'Failed'
  | 'On Hold'
  | 'Cancelled';

export type DocumentType =
  | 'PAN' | 'Aadhaar' | 'Passport' | 'Voter ID' | 'Driving Licence'
  | 'Resume' | 'Degree Certificate' | 'Mark Sheet' | 'Experience Letter'
  | 'Offer Letter' | 'Salary Slip' | 'Police Clearance' | 'Address Proof'
  | 'Bank Statement' | 'Photo' | 'General';

// ── Workflow state machine (mirrors backend VALID_TRANSITIONS) ─
export const RECORD_WORKFLOW: Record<RecordStatus, RecordStatus[]> = {
  'Pending':              ['In Review', 'Cancelled', 'On Hold'],
  'In Review':            ['Verification Running', 'On Hold', 'Cancelled'],
  'Verification Running': ['Approved', 'Rejected', 'Failed', 'On Hold'],
  'In Progress':          ['Approved', 'Rejected', 'Completed', 'Failed', 'On Hold'],
  'On Hold':              ['In Review', 'Pending', 'Cancelled'],
  'Approved': [], 'Rejected': [], 'Completed': [], 'Failed': [], 'Cancelled': [],
};

export const TERMINAL_STATUSES: RecordStatus[] = ['Approved', 'Rejected', 'Completed', 'Failed', 'Cancelled'];

export const STATUS_COLORS: Record<RecordStatus, string> = {
  'Pending':              'status-pending',
  'In Review':            'status-review',
  'Verification Running': 'status-running',
  'In Progress':          'status-progress',
  'Completed':            'status-completed',
  'Approved':             'status-approved',
  'Rejected':             'status-rejected',
  'Failed':               'status-failed',
  'On Hold':              'status-hold',
  'Cancelled':            'status-cancelled',
};

// ── Entity interfaces ─────────────────────────────────────────
export interface UserPreferences {
  theme: 'dark' | 'light';
  emailNotifications: boolean;
  smsNotifications: boolean;
  language: string;
}

export interface User {
  id: string; userId: string;
  firstName: string; lastName: string;
  email: string; role: UserRole;
  department: string; phone: string;
  bio?: string; joinDate: string;
  status: UserStatus; lastLogin: string | null;
  preferences: UserPreferences;
}

export interface Candidate {
  id: string; firstName: string; lastName: string;
  email: string; phone: string; dateOfBirth: string;
  nationality: string; currentAddress: string;
  previousAddresses: string[]; education: any[];
  employmentHistory: any[]; riskScore: number;
  riskLevel: RiskLevel; consentGiven: boolean;
  consentDate: string | null; documents: Document[];
  notes: string; tags: string[];
  status: 'Active' | 'Archived' | 'Flagged';
  assignedTo: string; createdBy: string;
  createdAt: string; updatedAt: string;
}

export interface Document {
  id: string; candidateId: string;
  name: string; type: DocumentType;
  storageUrl: string; mimeType: string;
  sizeBytes: number; uploadedBy: string; uploadedAt: string;
}

export interface TimelineEvent {
  id: string; date: string; event: string;
  description: string; performedBy: string;
  status: RecordStatus; icon: string;
}

export interface VerificationRecord {
  id: string; candidateId: string;
  candidateName: string; candidateEmail: string;
  ownerId: string; type: RecordType;
  status: RecordStatus; priority: Priority;
  requestedById: string; requestedByName: string;
  verifiedBy: string | null; verifierName: string | null;
  submittedDate: string; dueDate: string;
  completedDate: string | null; remarks: string;
  score: number | null; details: any;
  timeline: TimelineEvent[]; documents: string[];
  tags: string[]; billingCode: string;
  estimatedCost: number; actualCost: number | null;
  createdAt: string; updatedAt: string;
}

export interface Notification {
  id: string; userId: string;
  title: string; message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean; link: string | null; createdAt: string;
}

export interface AuditLog {
  id: string; action: string;
  performedBy: string; performedByName: string;
  targetId: string; targetType: string;
  details: string; ipAddress: string;
  userAgent: string; timestamp: string; success: boolean;
}

export interface DashboardStats {
  totalUsers: number; activeUsers: number; adminUsers: number;
  totalRecords: number; pendingRecords: number;
  completedRecords: number; inProgressRecords: number;
  failedRecords: number; totalCandidates?: number;
}

export interface AnalyticsOverview {
  summary: any;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPriority: any; byRisk: any;
  monthlyTrends: any[]; recentActivity: AuditLog[];
}

// ── API wrapper ───────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean; data?: T; message?: string;
  error?: string; timestamp: string;
  processingTime?: number; total?: number; unread?: number;
}

// ── Auth payloads ─────────────────────────────────────────────
// FIXED: role removed — role is loaded from DB server-side, never from client
export interface LoginRequest { userId: string; password: string; }

export interface RegisterRequest {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  department?: string;
  phone?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface CreateUserPayload {
  userId: string; firstName: string; lastName: string;
  email: string; password: string;
  role: UserRole; department: string; phone: string;
}

export interface UpdateUserPayload {
  firstName?: string; lastName?: string;
  email?: string; role?: UserRole;
  department?: string; phone?: string;
  status?: UserStatus; bio?: string;
  preferences?: Partial<UserPreferences>;
}

// ── Constants ─────────────────────────────────────────────────
export const DEPARTMENTS = [
  'Administration', 'Engineering', 'Human Resources', 'Finance',
  'Operations', 'Sales', 'Marketing', 'Legal', 'Compliance', 'IT Security',
];
export const USER_ROLES: UserRole[] = ['General User', 'Admin', 'Verifier', 'Manager'];
export const RECORD_TYPES: RecordType[] = [
  'Employment Verification', 'Education Verification', 'Criminal Check',
  'Credit Check', 'Reference Check', 'Address Verification',
  'Drug Test', 'Social Media Check', 'Professional License Check',
];
export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
