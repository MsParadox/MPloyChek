// ============================================================
// MPloyChek v4.0 — Enterprise Background Verification API
// FIX CRITICAL-2: WebSocket now authenticated with JWT
//   - userId query param replaced with ?token=<JWT>
//   - Invalid/missing token → connection rejected (close 4401)
// FIX BONUS: WebSocket heartbeat prevents stale connections
// Author: Mohit Sharma
// ============================================================
// Load environment variables from backend/.env BEFORE any module
// that reads process.env (e.g. middleware/auth, lib/prisma) executes.
import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors         from 'cors';
import helmet       from 'helmet';
import compression  from 'compression';
import rateLimit    from 'express-rate-limit';
import * as jwt     from 'jsonwebtoken';
import { createServer } from 'http';
// WebSocket — using require to avoid type declaration issues in CI
// eslint-disable-next-line @typescript-eslint/no-require-imports
const wsModule = require('ws');
const WebSocketServer = wsModule.WebSocketServer;
// WS_OPEN not needed here — readyState check is inside lib/ws-notify.ts
import prismaClient from './lib/prisma';
import logger, { httpLogger } from './lib/logger';
import { JWT_SECRET } from './middleware/auth';
import { refreshTokenRepo } from './repositories/index';

import { registerClient, removeClient, connectedCount } from './lib/ws-notify';
import authRoutes          from './routes/auth.routes';
import usersRoutes         from './routes/users.routes';
import recordsRoutes       from './routes/records.routes';
import candidatesRoutes    from './routes/candidates.routes';
import notificationsRoutes from './routes/notifications.routes';
import analyticsRoutes     from './routes/analytics.routes';
import exportRoutes        from './routes/export.routes';
import searchRoutes        from './routes/search.routes';
import documentsRoutes     from './routes/documents.routes';

const app: Application = express();
const httpServer       = createServer(app);
const PORT    = process.env['PORT']     || 3000;
const NODE_ENV= process.env['NODE_ENV'] || 'development';

// ── Security ──────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression() as any);
app.use(cors({
  origin:         (process.env['ALLOWED_ORIGINS'] || 'http://localhost:4200').split(','),
  credentials:    true,
  methods:        ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// ── Rate Limiting ─────────────────────────────────────────────
app.use('/api/', rateLimit({ windowMs:15*60*1000, max:300, standardHeaders:true, legacyHeaders:false, message:{ success:false, error:'Too many requests. Retry in 15 minutes.' } }));
app.use('/api/auth/login',  rateLimit({ windowMs:15*60*1000, max:10, message:{ success:false, error:'Too many login attempts. Wait 15 minutes.' } }));
app.use('/api/auth/refresh',rateLimit({ windowMs:60*1000, max:5,  message:{ success:false, error:'Too many token refreshes.' } }));

// ── Body Parsing ──────────────────────────────────────────────
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true }));
app.use(httpLogger);

// ── Health ────────────────────────────────────────────────────
app.get('/api/health', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try { await prismaClient.$queryRaw`SELECT 1`; dbStatus = 'connected'; } catch { /* ignore */ }
  res.json({
    success: true, status:'healthy', version:'4.0.0',
    author:'Mohit Sharma', project:'MPloyChek — Enterprise Background Verification',
    environment: NODE_ENV,
    uptime: `${Math.round(process.uptime())}s`,
    memory: `${Math.round(process.memoryUsage().rss/1024/1024)}MB`,
    database: dbStatus,
    wsClients: connectedCount(),
    timestamp: new Date().toISOString(),
  });
});

// ── API Catalogue ─────────────────────────────────────────────
app.get('/api', (_req, res) => res.json({
  name: 'MPloyChek API v4.0', author: 'Mohit Sharma',
  stack: ['Node.js', 'TypeScript', 'Express', 'PostgreSQL', 'Prisma', 'Zod', 'JWT', 'WebSocket'],
  endpoints: {
    auth:         ['POST /api/auth/login', 'POST /api/auth/refresh', 'POST /api/auth/logout', 'GET /api/auth/me', 'POST /api/auth/change-password'],
    users:        ['GET /api/users', 'GET /api/users/stats', 'GET /api/users/:id', 'POST /api/users', 'PATCH /api/users/:id', 'DELETE /api/users/:id'],
    records:      ['GET /api/records', 'GET /api/records/summary', 'GET /api/records/:id', 'POST /api/records', 'PATCH /api/records/:id'],
    candidates:   ['GET /api/candidates', 'GET /api/candidates/:id', 'POST /api/candidates', 'PATCH /api/candidates/:id', 'DELETE /api/candidates/:id'],
    notifications:['GET /api/notifications', 'PATCH /api/notifications/:id/read', 'PATCH /api/notifications/mark-all-read'],
    analytics:    ['GET /api/analytics/overview', 'GET /api/analytics/audit-logs'],
    export:       ['GET /api/export/records?format=csv|json', 'GET /api/export/candidates?format=csv|json', 'GET /api/export/audit-logs'],
    search:       ['GET /api/search?q=term&limit=5'],
    documents:    ['POST /api/documents/upload/:candidateId', 'GET /api/documents/candidate/:candidateId', 'GET /api/documents/:id', 'DELETE /api/documents/:id'],
  },
  websocket: {
    url:    'wss://<host>?token=<JWT>',
    note:   'Authenticate via JWT token in query string. userId in query param was removed (security fix).',
  },
  queryParams: { delay: 'Add ?delay=ms to any GET endpoint to simulate async API latency (0–10000ms)' },
}));

// ── Feature Routes ────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/records',       recordsRoutes);
app.use('/api/candidates',    candidatesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/export',        exportRoutes);
app.use('/api/search',        searchRoutes);
app.use('/api/documents',     documentsRoutes);

// ── Global Error Handler ──────────────────────────────────────
app.use((_req: Request, res: Response) => res.status(404).json({ success:false, error:'Route not found', timestamp:new Date().toISOString() }));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error:err.message, stack:err.stack });
  res.status(500).json({ success:false, error:'Internal server error', timestamp:new Date().toISOString() });
});

// ── WebSocket — JWT authenticated + heartbeat ─────────────────
// FIX CRITICAL-2: connections are now verified with a valid JWT
// Users can no longer spoof identity by passing any userId string.
const wss = new WebSocketServer({ server: httpServer });

// Client map is now managed in lib/ws-notify.ts (avoids circular deps)

// Heartbeat constants
const HEARTBEAT_INTERVAL_MS = 30_000;   // ping every 30s
// Connections are terminated on the next heartbeat cycle if no pong received

wss.on('connection', (ws: any, req: any) => {
  const url   = new URL(req.url || '', 'http://localhost');
  const token = url.searchParams.get('token');

  // ── 1. Validate JWT ────────────────────────────────────────
  if (!token) {
    logger.warn('WS rejected — no token provided');
    ws.close(4401, 'Authentication required');
    return;
  }

  let payload: any;
  try {
    payload = jwt.verify(token, JWT_SECRET) as any;
  } catch {
    logger.warn('WS rejected — invalid or expired token');
    ws.close(4401, 'Invalid token');
    return;
  }

  const userDbId = payload.sub as string;   // DB UUID from JWT sub claim
  const userId   = payload.userId as string; // human-readable login id

  // ── 2. Register connection ─────────────────────────────────
  // Remove any stale existing connection for this user
  // ws-notify handles dedup: closes old socket if same user reconnects
  // (dedup logic is inside registerClient in lib/ws-notify.ts)

  registerClient(userDbId, ws);
  (ws as any)._isAlive = true;

  logger.info(`🔌 WS connected: ${userId} (id: ${userDbId}, total: ${connectedCount()})`);
  ws.send(JSON.stringify({ type: 'connected', message: 'Real-time active', userId }));

  // ── 3. Heartbeat — application-level ping/pong ─────────────
  // NOTE: The browser WebSocket API silently ignores binary-level ws.ping()
  // frames, so the native pong never fires and connections were killed every
  // 30 seconds. We use JSON messages instead — the client replies with
  // {"type":"pong"} and we mark the connection alive.
  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'pong') (ws as any)._isAlive = true;
    } catch { /* ignore malformed frames */ }
  });

  // ── 4. Clean up on disconnect ──────────────────────────────
  ws.on('close', () => {
    removeClient(userDbId, ws);
    logger.info(`🔌 WS disconnected: ${userId} (total: ${connectedCount()})`);
  });

  ws.on('error', (e: Error) => logger.error('WS error', { error: e, userId }));
});

// ── Heartbeat interval — prune stale/dead connections ─────────
// Sends an application-level {"type":"ping"} JSON frame; client replies with
// {"type":"pong"}. This works in every browser environment, unlike binary ping.
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (!ws._isAlive) {
      ws.terminate();
      return;
    }
    ws._isAlive = false;
    try { ws.send(JSON.stringify({ type: 'ping' })); } catch { /* already closed */ }
  });
}, HEARTBEAT_INTERVAL_MS);

// Ensure interval is cleared when server closes
wss.on('close', () => clearInterval(heartbeatInterval));

// notifyUser is exported from lib/ws-notify.ts
export { notifyUser } from './lib/ws-notify';

// ── Bootstrap ─────────────────────────────────────────────────
const bootstrap = async (): Promise<void> => {
  try {
    await prismaClient.$connect();
    logger.info('✅ PostgreSQL connected via Prisma');
  } catch (err) {
    logger.error('❌ Database connection failed', { error: err });
    logger.warn('Running without database — some routes will fail');
  }

  // Periodic cleanup of expired refresh tokens (every hour)
  setInterval(async () => {
    try {
      const { count } = await refreshTokenRepo.deleteExpired() as any;
      if (count > 0) logger.info(`🗑️  Cleaned up ${count} expired refresh tokens`);
    } catch { /* ignore */ }
  }, 3600000);

  httpServer.listen(PORT, () => {
    logger.info('');
    logger.info('╔══════════════════════════════════════════════════════════╗');
    logger.info('║   MPloyChek v4.0 — Enterprise Verification Platform      ║');
    logger.info(`║   API:    http://localhost:${PORT}/api                       ║`);
    logger.info(`║   WS:     ws://localhost:${PORT}?token=<JWT>               ║`);
    logger.info(`║   Env:    ${NODE_ENV.padEnd(46)} ║`);
    logger.info('║   Author: Mohit Sharma  |  Personal Portfolio Project    ║');
    logger.info('╚══════════════════════════════════════════════════════════╝');
    logger.info('');
    logger.info('Demo Credentials:');
    logger.info('  admin001  / Admin@123   → Admin');
    logger.info('  john001   / User@123    → Manager');
    logger.info('  priya001  / Verify@123  → Verifier');
    logger.info('  mohit001  / User@123    → General User');
  });
};

bootstrap().catch((err) => { logger.error('Bootstrap failed', { error: err }); process.exit(1); });

// ── Graceful shutdown ─────────────────────────────────────────
// Render/Docker send SIGTERM on redeploy; SIGINT is Ctrl-C locally.
// Drain in-flight HTTP, stop the heartbeat, close WS + DB, then exit.
let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;       // ignore repeated signals
  shuttingDown = true;
  logger.info(`⏻ ${signal} received — shutting down gracefully…`);

  clearInterval(heartbeatInterval);
  wss.clients.forEach((ws: any) => { try { ws.close(1001, 'Server shutting down'); } catch { /* ignore */ } });

  // Force-exit if a clean close stalls (e.g. a hung connection)
  const forceExit = setTimeout(() => { logger.warn('Forced exit after timeout'); process.exit(1); }, 10_000);
  forceExit.unref();

  httpServer.close(async () => {
    try { await prismaClient.$disconnect(); } catch { /* ignore */ }
    logger.info('✅ Shutdown complete');
    clearTimeout(forceExit);
    process.exit(0);
  });
};

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT',  () => { void shutdown('SIGINT'); });

export default app;
