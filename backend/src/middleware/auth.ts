// ============================================================
// MPloyChek v4.0 — Authentication Middleware
// FIX: Added production warning if JWT_SECRET is default value
// Author: Mohit Sharma
// ============================================================
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const DEFAULT_SECRET = 'mploychek_dev_secret_change_in_prod';

export const JWT_SECRET      = process.env['JWT_SECRET'] || DEFAULT_SECRET;
export const JWT_EXPIRES_IN  = parseInt(process.env['JWT_EXPIRES_IN']  || '28800'); // 8 hours
export const RT_EXPIRES_DAYS = parseInt(process.env['RT_EXPIRES_DAYS'] || '7');

// Warn loudly at startup if running with the insecure default secret
if (JWT_SECRET === DEFAULT_SECRET && process.env['NODE_ENV'] === 'production') {
  console.error('🚨 CRITICAL: JWT_SECRET is not set in production! Set it immediately.');
  process.exit(1); // Hard fail — do not allow production with insecure secret
}
if (JWT_SECRET === DEFAULT_SECRET) {
  console.warn('⚠️  JWT_SECRET is using the dev default. Set JWT_SECRET in .env for production.');
}
if (JWT_SECRET.length < 32) {
  console.warn('⚠️  JWT_SECRET is shorter than 32 characters. Use: openssl rand -hex 32');
}

// ── Types ─────────────────────────────────────────────────────
export interface AuthRequest extends Request {
  user?: { sub: string; userId: string; role: string; };
}

// ── authenticate middleware ────────────────────────────────────
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false, error: 'No token provided',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  try {
    const payload = jwt.verify(header.split(' ')[1], JWT_SECRET) as any;
    req.user = { sub: payload.sub, userId: payload.userId, role: payload.role };
    next();
  } catch {
    res.status(401).json({
      success: false, error: 'Invalid or expired token',
      timestamp: new Date().toISOString(),
    });
  }
};

// ── withDelay — simulates API latency for demo/testing ────────
export const withDelay = (req: Request, _res: Response, next: NextFunction): void => {
  const delay = Math.min(parseInt(req.query['delay'] as string) || 0, 10000);
  delay > 0 ? setTimeout(next, delay) : next();
};
