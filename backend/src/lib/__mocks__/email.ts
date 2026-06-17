// ============================================================
// MPloyChek v4.0 — Manual Jest mock for the email module.
// Every sender returns a resolved Promise so production code that
// chains `.catch()` / `await` behaves exactly as it does at runtime.
// Activated by `jest.mock('../lib/email')`.
// ============================================================
export const sendWelcomeEmail = jest.fn().mockResolvedValue(undefined);
export const sendPasswordChangedEmail = jest.fn().mockResolvedValue(undefined);
export const sendVerificationCompleteEmail = jest.fn().mockResolvedValue(undefined);
export const sendPasswordResetEmail = jest.fn().mockResolvedValue(undefined);
export const sendLoginAlertEmail = jest.fn().mockResolvedValue(undefined);
