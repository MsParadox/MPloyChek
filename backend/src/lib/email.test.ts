// ============================================================
// MPloyChek v4.0 — Email Service Unit Tests
// Two scenarios:
//   1. No SMTP creds  → transporter is null, every send is skipped gracefully
//   2. SMTP creds set → transporter.sendMail is invoked with rendered HTML
// nodemailer + logger are mocked; no network is touched.
// ============================================================
jest.mock('./logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

describe('email service — no SMTP configured', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env['BREVO_SMTP_LOGIN'];
    delete process.env['BREVO_SMTP_PASSWORD'];
    mockSendMail.mockReset();
  });

  it('skips sending (no throw) for every template when creds are absent', async () => {
    const email = require('./email');
    await expect(email.sendWelcomeEmail('a@test.com', 'Arjun', 'arjun001')).resolves.toBeUndefined();
    await expect(email.sendPasswordChangedEmail('a@test.com', 'Arjun')).resolves.toBeUndefined();
    await expect(email.sendVerificationCompleteEmail('a@test.com', 'Arjun', 'Cand', 'Employment Verification', 'Completed', 88)).resolves.toBeUndefined();
    await expect(email.sendPasswordResetEmail('a@test.com', 'Arjun', 'tok')).resolves.toBeUndefined();
    await expect(email.sendLoginAlertEmail('a@test.com', 'Arjun', '127.0.0.1', 'jest-agent')).resolves.toBeUndefined();
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

describe('email service — SMTP configured', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env['BREVO_SMTP_LOGIN']    = 'login';
    process.env['BREVO_SMTP_PASSWORD'] = 'password';
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({ messageId: 'mid-1' });
  });

  afterAll(() => {
    delete process.env['BREVO_SMTP_LOGIN'];
    delete process.env['BREVO_SMTP_PASSWORD'];
  });

  it('sends a welcome email with the recipient + rendered body', async () => {
    const email = require('./email');
    await email.sendWelcomeEmail('arjun@test.com', 'Arjun', 'arjun001');
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const arg = mockSendMail.mock.calls[0][0];
    expect(arg.to).toBe('arjun@test.com');
    expect(arg.subject).toContain('Welcome');
    expect(arg.html).toContain('Arjun');
    expect(arg.html).toContain('arjun001');
  });

  it('renders the verification score only when provided', async () => {
    const email = require('./email');
    await email.sendVerificationCompleteEmail('a@test.com', 'A', 'Cand', 'Criminal Check', 'Completed', 91);
    expect(mockSendMail.mock.calls[0][0].html).toContain('91/100');
  });

  it('does not crash if the transport rejects (returns gracefully)', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP 535'));
    const email = require('./email');
    await expect(email.sendLoginAlertEmail('a@test.com', 'A', '127.0.0.1', 'agent')).resolves.toBeUndefined();
  });
});
