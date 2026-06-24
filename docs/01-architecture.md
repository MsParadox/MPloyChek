# MPloyChek — System Architecture

> **Angular 15** · **Node.js 18 / Express** · **PostgreSQL / Prisma** · **WebSocket** · **Docker**

---

## Overview

MPloyChek uses a clean three-tier architecture: an Angular 15 SPA served from Vercel CDN, a Node.js/Express REST API hosted on Render, and a Neon PostgreSQL database managed via Prisma ORM. A native WebSocket layer sits alongside the HTTP API for real-time notifications.

```
┌──────────────────────────────────────────────────────┐
│               Frontend — Vercel CDN                  │
│         Angular 15 · Angular Material · RxJS         │
│                                                      │
│   Auth → Dashboard → Candidates → Records → Admin    │
└───────────────────────┬──────────────────────────────┘
                        │  HTTPS  (REST + JWT)
                        │  WSS    (real-time events)
┌───────────────────────▼──────────────────────────────┐
│              Backend — Render Free Tier              │
│         Node.js 18 · Express · TypeScript            │
│                                                      │
│  Routes → Middleware Stack → Services → Repositories │
│                                                      │
│  Security : Helmet · Rate Limit · CORS · RBAC        │
│  Validation: Zod schemas on all mutating endpoints   │
│  Logging  : Winston JSON + Morgan HTTP               │
└───────────┬──────────────────────┬───────────────────┘
            │  Prisma ORM          │  External Services
    ┌───────▼──────┐    ┌──────────▼──────┐  ┌──────────────┐
    │     Neon     │    │     Brevo       │  │  Cloudinary  │
    │  PostgreSQL  │    │  Email (SMTP)   │  │   Document   │
    │  free tier   │    │  300/day free   │  │   Storage    │
    └──────────────┘    └─────────────────┘  └──────────────┘
```

---

## Request Lifecycle

Every HTTP request passes through this ordered middleware pipeline:

```
Incoming Request
  │
  ├─ express-rate-limit    ─ 429 if exceeded (10 login attempts / 300 general per 15 min)
  ├─ helmet                ─ sets security headers, strips X-Powered-By
  ├─ cors                  ─ allows only ALLOWED_ORIGINS (env var)
  ├─ express.json()        ─ body parsing, 50 KB limit
  ├─ morgan / httpLogger   ─ structured request log: method · path · status · ms
  ├─ authenticate()        ─ JWT verification → attaches req.user { sub, role, email }
  ├─ requireRole([...])    ─ RBAC check → 403 if role not in allowed list
  ├─ validate(zodSchema)   ─ Zod validation → 400 with field errors on failure
  └─ Route Handler         ─ delegates to service layer
       │
       └─ Service          ─ business logic (no HTTP, no Prisma)
            │
            └─ Repository  ─ Prisma queries → Neon PostgreSQL
                 │
                 └─ JSON Response
                      { success, data, message, timestamp, processingTime }
```

---

## Backend Directory Structure

```
backend/
├── prisma/
│   ├── schema.prisma        ← source of truth — 8 models, 6 enums
│   └── seed.ts              ← demo data: 4 users + sample candidates + records
│
└── src/
    ├── index.ts             ← Express bootstrap, WebSocket server, route mounting
    │
    ├── lib/
    │   ├── prisma.ts        ← PrismaClient singleton (prevents connection pool exhaustion)
    │   ├── logger.ts        ← Winston: JSON in prod, colored in dev, daily rotation
    │   ├── email.ts         ← Brevo SMTP via nodemailer — lazy-init transporter
    │   ├── storage.ts       ← Cloudinary upload + local fallback, MIME + size limits
    │   └── ws-notify.ts     ← WebSocket client map + notifyUser() fan-out
    │                           (extracted from index.ts to break circular import)
    ├── middleware/
    │   ├── auth.ts          ← JWT verification → req.user
    │   ├── rbac.ts          ← requireRole(roles[]), requireAdmin
    │   └── validate.ts      ← Zod schema validator factory
    │
    ├── repositories/        ← all Prisma queries live here, nowhere else
    │   ├── user.repository.ts
    │   ├── record.repository.ts
    │   ├── candidate.repository.ts
    │   ├── document.repository.ts
    │   ├── notification.repository.ts
    │   └── index.ts         ← barrel export
    │
    ├── services/            ← business logic (pure TypeScript, no HTTP, no Prisma)
    │   └── auth.service.ts  ← login · refresh · logout · password change
    │
    └── routes/              ← 9 route groups, each mounted at /api/<resource>
        ├── auth.routes.ts
        ├── users.routes.ts
        ├── records.routes.ts
        ├── candidates.routes.ts
        ├── documents.routes.ts
        ├── notifications.routes.ts
        ├── analytics.routes.ts
        ├── search.routes.ts
        └── export.routes.ts
```

---

## Frontend Directory Structure

```
frontend/src/app/
│
├── core/
│   ├── services/            ← RxJS-based HTTP wrappers, error handling
│   │   ├── auth.service.ts  ← login, logout, token refresh, role helpers
│   │   ├── records.service.ts
│   │   ├── candidates.service.ts
│   │   └── ws.service.ts    ← WebSocket client with auto-reconnect
│   ├── models/              ← TypeScript interfaces (User, Record, Candidate …)
│   ├── guards/              ← AuthGuard, RoleGuard — redirect on unauthorized access
│   └── interceptors/
│       └── jwt.interceptor.ts  ← auto-attaches Bearer token; refreshes on 401
│
├── modules/                 ← feature modules — ALL lazy-loaded
│   ├── auth/                ← login form
│   ├── dashboard/           ← stats cards, recent records, flagged candidates
│   ├── candidates/          ← CRUD + document upload
│   ├── records/             ← CRUD + workflow status transitions
│   ├── admin/               ← user management (Admin role only)
│   ├── notifications/       ← notification center + mark-read
│   └── profile/             ← account settings, password change
│
└── shared/
    ├── navbar/
    ├── global-search/
    └── session-warning/     ← warns 5 minutes before token expiry
```

---

## Database Schema (8 Models)

```
User ──────┬─── RefreshToken     (many per user; SHA-256 hashed; 7-day TTL)
           ├─── Record ──────────── TimelineEvent   (immutable history per transition)
           ├─── Notification        (DB-first: saved before WebSocket push)
           └─── AuditLog           (immutable: actor · action · target · IP · timestamp)

Candidate ─┬─── Education
           ├─── Employment
           ├─── Document           (Cloudinary URL + MIME + size metadata)
           └─── PreviousAddress
```

---

## Verification Workflow

```
              ┌──────────┐
              │ PENDING  │◄──────────────────────────┐
              └────┬─────┘                           │
                   │                                 │
                   ▼                                 │
            ┌────────────┐      ┌──────────┐         │
            │ IN_REVIEW  │──────► ON_HOLD  │─────────┘
            └─────┬──────┘      └──────────┘
                  │
                  ▼
    ┌─────────────────────────┐
    │  VERIFICATION_RUNNING   │──────► ON_HOLD
    └──────────┬──────────────┘
               │
      ┌────────┴──────────┐
      ▼                   ▼
 ┌──────────┐        ┌──────────┐    ┌───────────┐
 │ APPROVED │        │ REJECTED │    │ CANCELLED │
 └──────────┘        └──────────┘    └───────────┘
  (Terminal)          (Terminal)      (Terminal)
```

Invalid transitions return `400` with `allowedNext[]`. Terminal records are fully immutable.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Repository pattern | Routes handle HTTP, services handle logic, repositories handle data. Each layer is independently testable. |
| Lazy-loaded Angular modules | Reduces initial bundle size; each feature module loads only when navigated to. |
| `ws-notify.ts` extracted from `index.ts` | Breaks circular dependency: `index.ts` imports routes → routes need `notifyUser` → `notifyUser` was in `index.ts`. |
| DB-first notifications | WebSocket push is unreliable — save to DB first so the notification survives connection drops. |
| SHA-256 hashed refresh tokens | Raw tokens never stored. A full DB dump does not expose usable refresh tokens. |
| Zod on all mutations | Runtime validation catches malformed payloads before the service layer. Schemas are the single source of truth for input shape. |
| Separate `DIRECT_URL` | Prisma migrations require a direct (non-pooled) connection — Neon's PgBouncer doesn't support the extended query protocol needed for DDL. |
| `ALLOWED_ORIGINS` env var | CORS origin whitelist managed via environment — no code change needed when adding a new frontend domain. |
