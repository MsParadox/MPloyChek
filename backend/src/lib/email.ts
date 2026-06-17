// ============================================================
// MPloyChek — Brevo Email Service (300 free emails/day)
// Author: Mohit Sharma
// Setup: https://brevo.com → Free account → SMTP settings
// ============================================================
import * as nodemailer from 'nodemailer';
import logger from './logger';

// ── Transporter (Brevo SMTP) — lazy singleton ─────────────────
// Created on first use so dotenv has definitely loaded by the time
// we read process.env (module-level evaluation runs before dotenv/config
// in the imports of importing modules).
let _transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined;

function getTransporter() {
  if (_transporter !== undefined) return _transporter; // cached
  if (!process.env['BREVO_SMTP_LOGIN'] || !process.env['BREVO_SMTP_PASSWORD']) {
    logger.warn('⚠️  Brevo SMTP credentials not set — emails will be logged only');
    _transporter = null;
    return null;
  }
  _transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // TLS via STARTTLS
    auth: {
      user: process.env['BREVO_SMTP_LOGIN'],
      pass: process.env['BREVO_SMTP_PASSWORD'],
    },
  });
  logger.info('📧 Brevo SMTP transporter ready');
  return _transporter;
}

// ── Helper: Send email ────────────────────────────────────────
async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const transporter = getTransporter();
  const FROM = `"MPloyChek" <${process.env['BREVO_SENDER_EMAIL'] || 'noreply@mploychek.com'}>`;
  if (!transporter) {
    logger.info('📧 [Email skipped — no SMTP config]', { to, subject });
    return false;
  }
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html });
    logger.info('📧 Email sent', { to, subject, messageId: info.messageId });
    return true;
  } catch (err: any) {
    // Brevo free tier blocks SMTP from unwhitelisted IPs (EAUTH 525).
    // Fix: go to brevo.com → SMTP & API → Allowed IPs → add your server IP.
    // In production on Render, Render's IP range must be whitelisted, OR use
    // Brevo's HTTP API instead of SMTP (no IP restriction).
    if (err?.code === 'EAUTH' || err?.responseCode === 525) {
      logger.warn('📧 Email blocked by Brevo IP restriction. Whitelist your IP at brevo.com → SMTP & API → Allowed IPs.', { to, subject });
    } else {
      logger.error('❌ Email failed', { to, subject, error: err });
    }
    return false;
  }
}

// ── Email Templates ───────────────────────────────────────────
const baseHtml = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'DM Sans', Arial, sans-serif; background: #070b14; color: #e2e8f0; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 32px auto; background: #0f1729; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0d1b2a, #1a2540); padding: 28px 32px; border-bottom: 1px solid rgba(45,212,191,0.2); }
    .brand { font-size: 24px; font-weight: 800; color: #fff; }
    .brand span { color: #2dd4bf; }
    .body { padding: 32px; }
    h2 { font-size: 20px; font-weight: 700; color: #fff; margin: 0 0 12px; }
    p { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.7; margin: 0 0 16px; }
    .btn { display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #2dd4bf, #0ea5e9); color: #000; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; margin: 8px 0 20px; }
    .info-box { background: rgba(45,212,191,0.06); border: 1px solid rgba(45,212,191,0.15); border-radius: 10px; padding: 14px 18px; margin: 16px 0; }
    .info-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
    .info-label { color: rgba(255,255,255,0.4); }
    .info-val { color: rgba(255,255,255,0.8); font-weight: 600; }
    .footer { background: rgba(255,255,255,0.02); padding: 20px 32px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.3); border-top: 1px solid rgba(255,255,255,0.06); }
    .warning { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 10px; padding: 14px 18px; margin: 16px 0; color: #f87171; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand"><span>M</span>PloyChek</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:4px;">Digital Background Verification Platform</div>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      © 2024 MPloyChek by Mohit Sharma. This is an automated message.<br>
      If you did not request this, please ignore or contact support.
    </div>
  </div>
</body>
</html>
`;

// ── Email Functions ───────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string, userId: string): Promise<void> {
  const html = baseHtml(`
    <h2>Welcome to MPloyChek, ${name}! 🎉</h2>
    <p>Your account has been created successfully. You can now log in to the platform and start managing background verifications.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">User ID</span><span class="info-val">${userId}</span></div>
      <div class="info-row"><span class="info-label">Platform</span><span class="info-val">MPloyChek v4.0</span></div>
    </div>
    <a class="btn" href="${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/auth/login">Login Now →</a>
    <p style="font-size:13px;color:rgba(255,255,255,0.35);">If you have any issues, please contact your administrator.</p>
  `);
  await sendMail(to, 'Welcome to MPloyChek — Your account is ready', html);
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  const html = baseHtml(`
    <h2>Password Changed Successfully</h2>
    <p>Hi ${name}, your MPloyChek password was changed successfully at <strong>${new Date().toLocaleString('en-IN')}</strong>.</p>
    <div class="warning">⚠️ If you did not make this change, please contact your administrator immediately and reset your password.</div>
    <p>For security, all active sessions on all devices have been revoked. You will need to log in again on each device.</p>
  `);
  await sendMail(to, 'MPloyChek — Password changed successfully', html);
}

export async function sendVerificationCompleteEmail(
  to: string,
  name: string,
  candidateName: string,
  recordType: string,
  status: string,
  score: number | null,
): Promise<void> {
  const statusColor = status === 'Completed' ? '#22c55e' : '#ef4444';
  const html = baseHtml(`
    <h2>Verification ${status}</h2>
    <p>Hi ${name}, a background verification check has been updated.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Candidate</span><span class="info-val">${candidateName}</span></div>
      <div class="info-row"><span class="info-label">Check Type</span><span class="info-val">${recordType}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-val" style="color:${statusColor}">${status}</span></div>
      ${score !== null ? `<div class="info-row"><span class="info-label">Score</span><span class="info-val">${score}/100</span></div>` : ''}
    </div>
    <a class="btn" href="${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/records">View Records →</a>
  `);
  await sendMail(to, `MPloyChek — Verification ${status}: ${candidateName}`, html);
}

export async function sendPasswordResetEmail(to: string, name: string, resetToken: string): Promise<void> {
  const resetUrl = `${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/auth/reset-password?token=${resetToken}`;
  const html = baseHtml(`
    <h2>Password Reset Request</h2>
    <p>Hi ${name}, we received a request to reset your MPloyChek password. Click the button below to set a new password.</p>
    <a class="btn" href="${resetUrl}">Reset Password →</a>
    <p style="font-size:12px;color:rgba(255,255,255,0.3);">This link expires in <strong>30 minutes</strong>. If you didn't request a reset, ignore this email.</p>
    <div class="warning">Never share this link with anyone. MPloyChek staff will never ask for your password.</div>
  `);
  await sendMail(to, 'MPloyChek — Reset your password', html);
}

export async function sendLoginAlertEmail(to: string, name: string, ip: string, userAgent: string): Promise<void> {
  const html = baseHtml(`
    <h2>New Login Detected</h2>
    <p>Hi ${name}, a new login to your MPloyChek account was detected.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Time</span><span class="info-val">${new Date().toLocaleString('en-IN')}</span></div>
      <div class="info-row"><span class="info-label">IP Address</span><span class="info-val">${ip}</span></div>
      <div class="info-row"><span class="info-label">Browser</span><span class="info-val">${userAgent.slice(0, 60)}</span></div>
    </div>
    <div class="warning">⚠️ If this wasn't you, immediately change your password and contact your administrator.</div>
  `);
  await sendMail(to, 'MPloyChek — New login to your account', html);
}
