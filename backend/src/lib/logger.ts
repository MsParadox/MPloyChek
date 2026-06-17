// ============================================================
// MPloyChek — Winston Logger
// Structured logging with daily rotation
// Author: Mohit Sharma
// ============================================================
import winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// ── Formats ──────────────────────────────────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp: ts, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `  ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${message}${metaStr}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// ── Transports ────────────────────────────────────────────────
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: process.env['NODE_ENV'] === 'production' ? prodFormat : devFormat,
  }),
];

// File transports in production / when LOG_TO_FILE=true
if (process.env['NODE_ENV'] === 'production' || process.env['LOG_TO_FILE'] === 'true') {
  transports.push(
    // Error logs — keep 30 days
    new (winston.transports as any).DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      maxSize: '20m',
      format: prodFormat,
    }),
    // Combined logs — keep 14 days
    new (winston.transports as any).DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      format: prodFormat,
    })
  );
}

// ── Logger Instance ───────────────────────────────────────────
const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  transports,
  // Don't crash on uncaught exceptions — just log them
  exceptionHandlers: [
    new winston.transports.Console({ format: devFormat }),
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log'), format: prodFormat }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log'), format: prodFormat }),
  ],
});

// ── Helper: HTTP Request Logger (replaces morgan) ─────────────
export const httpLogger = (req: any, res: any, next: () => void) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    logger.log(level, `${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });
  next();
};

export default logger;
