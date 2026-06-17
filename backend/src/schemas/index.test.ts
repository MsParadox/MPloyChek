// ============================================================
// MPloyChek v4.0 — Schema Validation Unit Tests
// FIX: loginSchema tests updated — role field removed from schema.
//   Role is now loaded from DB after authentication, never from client.
// Pure unit tests — no mocks needed (Zod has no side effects)
// ============================================================
import {
  loginSchema, changePasswordSchema, createUserSchema, updateUserSchema,
  createCandidateSchema, updateCandidateSchema,
  createRecordSchema, updateRecordSchema,
  searchSchema, uploadDocumentSchema,
} from './index';

describe('loginSchema', () => {
  // FIXED: valid payload has no role — only userId + password
  const valid = { userId: 'admin001', password: 'Admin@123' };

  it('accepts valid credentials (userId + password only)', () => {
    expect(loginSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects userId shorter than 4 chars', () => {
    const r = loginSchema.safeParse({ ...valid, userId: 'ab' });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain('4 characters');
  });

  it('rejects missing password', () => {
    const r = loginSchema.safeParse({ userId: 'admin001' });
    expect(r.success).toBe(false);
  });

  it('rejects missing userId', () => {
    const r = loginSchema.safeParse({ password: 'Admin@123' });
    expect(r.success).toBe(false);
  });

  it('trims whitespace from userId', () => {
    const r = loginSchema.safeParse({ ...valid, userId: '  admin001  ' });
    expect(r.success).toBe(true);
    expect((r as any).data.userId).toBe('admin001');
  });

  it('does not include role in parsed output (role removed from schema)', () => {
    // Even if someone sneaks role into the payload, it should be stripped
    const r = loginSchema.safeParse({ ...valid, role: 'Admin' });
    expect(r.success).toBe(true);
    expect((r as any).data).not.toHaveProperty('role');
  });
});

describe('changePasswordSchema', () => {
  const valid = { currentPassword: 'OldPass@1', newPassword: 'NewPass@1' };

  it('accepts valid password change', () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects new password without uppercase', () => {
    const r = changePasswordSchema.safeParse({ ...valid, newPassword: 'newpass@1' });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain('uppercase');
  });

  it('rejects new password without a number', () => {
    const r = changePasswordSchema.safeParse({ ...valid, newPassword: 'NewPass@@' });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain('number');
  });

  it('rejects new password without a special character', () => {
    const r = changePasswordSchema.safeParse({ ...valid, newPassword: 'NewPass12' });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain('special');
  });

  it('rejects new password shorter than 8 chars', () => {
    const r = changePasswordSchema.safeParse({ ...valid, newPassword: 'N@1abcd' });
    expect(r.success).toBe(false);
  });
});

describe('createUserSchema', () => {
  const valid = {
    userId: 'user001', firstName: 'Test', lastName: 'User',
    email: 'test@example.com', password: 'TestPass@1',
    role: 'General User' as const, department: 'Engineering', phone: '+91-1234567',
  };

  it('accepts a fully valid user payload', () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects userId with spaces', () => {
    const r = createUserSchema.safeParse({ ...valid, userId: 'user 001' });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain('spaces');
  });

  it('rejects invalid email format', () => {
    const r = createUserSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(r.success).toBe(false);
  });

  it('lowercases the email', () => {
    const r = createUserSchema.safeParse({ ...valid, email: 'TEST@EXAMPLE.COM' });
    expect(r.success).toBe(true);
    expect((r as any).data.email).toBe('test@example.com');
  });
});

describe('updateRecordSchema — v4.0 workflow statuses', () => {
  const workflowStatuses = [
    'Pending', 'In Review', 'Verification Running', 'In Progress',
    'Completed', 'Approved', 'Rejected', 'Failed', 'On Hold', 'Cancelled',
  ] as const;

  workflowStatuses.forEach(status => {
    it(`accepts status "${status}"`, () => {
      expect(updateRecordSchema.safeParse({ status }).success).toBe(true);
    });
  });

  it('rejects an unknown status string', () => {
    const r = updateRecordSchema.safeParse({ status: 'Done' });
    expect(r.success).toBe(false);
  });

  it('rejects score outside 0–100', () => {
    expect(updateRecordSchema.safeParse({ score: 101 }).success).toBe(false);
    expect(updateRecordSchema.safeParse({ score: -1  }).success).toBe(false);
  });

  it('accepts score of 0 and 100', () => {
    expect(updateRecordSchema.safeParse({ score: 0   }).success).toBe(true);
    expect(updateRecordSchema.safeParse({ score: 100 }).success).toBe(true);
  });

  it('rejects empty object (at least one field required)', () => {
    const r = updateRecordSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe('createRecordSchema', () => {
  const valid = {
    candidateId: '550e8400-e29b-41d4-a716-446655440000',
    type: 'Employment Verification' as const,
    priority: 'High' as const,
    dueDate: '2024-12-31',
  };

  it('accepts a valid record creation payload', () => {
    expect(createRecordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid candidateId (not a UUID)', () => {
    const r = createRecordSchema.safeParse({ ...valid, candidateId: 'not-a-uuid' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid record type', () => {
    const r = createRecordSchema.safeParse({ ...valid, type: 'Fake Check' });
    expect(r.success).toBe(false);
  });

  it('rejects badly formatted dueDate', () => {
    const r = createRecordSchema.safeParse({ ...valid, dueDate: '31-12-2024' });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain('YYYY-MM-DD');
  });
});

describe('searchSchema', () => {
  it('rejects query shorter than 2 characters', () => {
    const r = searchSchema.safeParse({ q: 'a' });
    expect(r.success).toBe(false);
  });

  it('coerces limit to a number', () => {
    const r = searchSchema.safeParse({ q: 'arjun', limit: '10' });
    expect(r.success).toBe(true);
    expect((r as any).data.limit).toBe(10);
  });

  it('defaults limit to 5', () => {
    const r = searchSchema.safeParse({ q: 'arjun' });
    expect((r as any).data.limit).toBe(5);
  });
});

describe('uploadDocumentSchema', () => {
  it('defaults type to General when not provided', () => {
    const r = uploadDocumentSchema.safeParse({});
    expect(r.success).toBe(true);
    expect((r as any).data.type).toBe('General');
  });

  it('rejects an invalid document type', () => {
    const r = uploadDocumentSchema.safeParse({ type: 'DriverLicense' });
    expect(r.success).toBe(false);
  });

  it('accepts all valid document types', () => {
    ['PAN', 'Aadhaar', 'Passport', 'Resume', 'Degree Certificate'].forEach(type => {
      expect(uploadDocumentSchema.safeParse({ type }).success).toBe(true);
    });
  });
});
