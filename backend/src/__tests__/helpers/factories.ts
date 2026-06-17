// ============================================================
// MPloyChek v4.0 — Test Data Factories
// Consistent test data for all test suites
// ============================================================
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env['JWT_SECRET']!;

// ── Token factory ─────────────────────────────────────────────
export const makeToken = (overrides: Partial<{
  sub: string; userId: string; role: string; expiresIn: number;
}> = {}): string => {
  const payload = {
    sub:    overrides.sub    ?? 'user-uuid-admin-0001',
    userId: overrides.userId ?? 'admin001',
    role:   overrides.role   ?? 'Admin',
  };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: overrides.expiresIn ?? 28800,
  });
};

export const ADMIN_TOKEN   = makeToken({ sub: 'user-uuid-admin-0001', userId: 'admin001',  role: 'Admin'        });
export const MANAGER_TOKEN = makeToken({ sub: 'user-uuid-mgr-000001', userId: 'john001',   role: 'Manager'      });
export const VERIFIER_TOKEN= makeToken({ sub: 'user-uuid-ver-000001', userId: 'priya001',  role: 'Verifier'     });
export const USER_TOKEN    = makeToken({ sub: 'user-uuid-usr-000001', userId: 'mohit001',  role: 'General User' });
export const EXPIRED_TOKEN = makeToken({ expiresIn: -1 });

// ── User factories ────────────────────────────────────────────
export const makeDbUser = (overrides: Partial<any> = {}) => ({
  id:           'user-uuid-admin-0001',
  userId:       'admin001',
  firstName:    'Melody',
  lastName:     'Fernandez',
  email:        'melody@mploychek.com',
  passwordHash: '$2a$10$xJ7GTgBfLBRa8yL.N8vbMOD6x9U7LM1eSE2Z3z4pQGHL3qnXQ0sPO', // Admin@123
  role:         'ADMIN' as const,
  department:   'Administration',
  phone:        '+91-9876500001',
  bio:          null,
  joinDate:     new Date('2020-01-15'),
  status:       'ACTIVE' as const,
  lastLogin:    new Date(),
  emailNotifications: true,
  smsNotifications:   false,
  language:     'en',
  theme:        'dark',
  createdAt:    new Date('2020-01-15'),
  updatedAt:    new Date(),
  ...overrides,
});

export const makeSerializedUser = (overrides: Partial<any> = {}) => ({
  id:         'user-uuid-admin-0001',
  userId:     'admin001',
  firstName:  'Melody',
  lastName:   'Fernandez',
  email:      'melody@mploychek.com',
  role:       'Admin',
  department: 'Administration',
  phone:      '+91-9876500001',
  joinDate:   '2020-01-15',
  status:     'Active',
  lastLogin:  new Date().toISOString(),
  preferences: { theme: 'dark', emailNotifications: true, smsNotifications: false, language: 'en' },
  ...overrides,
});

// ── Candidate factories ────────────────────────────────────────
export const makeSerializedCandidate = (overrides: Partial<any> = {}) => ({
  id:              'cand-uuid-arjun-001',
  firstName:       'Arjun',
  lastName:        'Mehta',
  email:           'arjun.mehta@email.com',
  phone:           '+91-9800100001',
  dateOfBirth:     '1992-03-15',
  nationality:     'Indian',
  currentAddress:  '123 MG Road, Bangalore',
  previousAddresses: [],
  education:       [],
  employmentHistory: [],
  riskScore:       15,
  riskLevel:       'Low',
  consentGiven:    true,
  consentDate:     '2024-05-01T00:00:00.000Z',
  documents:       [],
  notes:           '',
  tags:            ['engineering'],
  status:          'Active',
  assignedTo:      null,
  createdBy:       'user-uuid-admin-0001',
  createdAt:       new Date().toISOString(),
  updatedAt:       new Date().toISOString(),
  ...overrides,
});

// ── Record factories ───────────────────────────────────────────
export const makeSerializedRecord = (overrides: Partial<any> = {}) => ({
  id:              'rec-uuid-001',
  candidateId:     'cand-uuid-arjun-001',
  candidateName:   'Arjun Mehta',
  candidateEmail:  'arjun.mehta@email.com',
  ownerId:         'user-uuid-admin-0001',
  type:            'Employment Verification',
  status:          'Pending',
  priority:        'Medium',
  requestedById:   'user-uuid-admin-0001',
  requestedByName: 'Melody Fernandez',
  verifiedBy:      null,
  verifierName:    null,
  submittedDate:   new Date().toISOString(),
  dueDate:         new Date(Date.now() + 7 * 86400000).toISOString(),
  completedDate:   null,
  remarks:         '',
  score:           null,
  details:         {},
  timeline:        [],
  documents:       [],
  tags:            [],
  billingCode:     'BIL-001',
  estimatedCost:   2500,
  actualCost:      null,
  createdAt:       new Date().toISOString(),
  updatedAt:       new Date().toISOString(),
  ...overrides,
});

// ── Document factories ─────────────────────────────────────────
export const makeDocument = (overrides: Partial<any> = {}) => ({
  id:          'doc-uuid-001',
  candidateId: 'cand-uuid-arjun-001',
  name:        'Arjun_Resume.pdf',
  type:        'Resume',
  storagePath: 'uploads/candidates/cand-uuid-arjun-001/abc123.pdf',
  storageUrl:  '/api/documents/file/abc123.pdf?candidateId=cand-uuid-arjun-001',
  mimeType:    'application/pdf',
  sizeBytes:   102400,
  uploadedBy:  'admin001',
  uploadedAt:  new Date().toISOString(),
  ...overrides,
});
