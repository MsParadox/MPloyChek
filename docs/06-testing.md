# MPloyChek — Testing Guide

> **244 tests across 18 suites** — no live database required for unit and integration tests.  
> Coverage gates enforced in CI: **statements 70% · branches 60% · functions 70% · lines 70%**  
> Current coverage: 81% statements · 62% branches · 76% functions · 84% lines

---

## Test Stack

| Tool | Purpose |
|------|---------|
| **Jest** + `ts-jest` | Test runner + TypeScript transformer |
| **Supertest** | HTTP integration tests — mounts Express app in-process, no real port |
| **Angular TestBed** + `HttpClientTestingModule` | Frontend component and service tests |
| **Prisma mock** (`jest.mock`) | Auto-mocks all repository calls — no real DB connection needed |

---

## Test Commands

```bash
cd backend

npm test                    # full suite (run once, non-watch)
npm run test:unit           # schemas · services · lib · routes
npm run test:flow           # full auth lifecycle + workflow state machine
npm run test:coverage       # HTML report → open coverage/index.html
npm run test:ci             # CI mode — enforces coverage thresholds, fails if unmet
npm run test:watch          # watch mode for development

# Integration tests against a real Neon database branch (opt-in)
DATABASE_URL_TEST=your_neon_url npm run test:integration
```

All commands are cross-platform — Windows `cmd` / PowerShell and macOS / Linux.

---

## Test Structure

```
backend/src/
├── __tests__/
│   ├── helpers/
│   │   └── factories.ts             ← makeDbUser(), makeSerializedUser(), ADMIN_TOKEN, MANAGER_TOKEN
│   ├── setup.ts                     ← jest global setup / teardown hooks
│   ├── auth.flow.test.ts            ← login → refresh → change-password → logout lifecycle
│   ├── auth.service.spec.ts         ← UserService unit tests
│   ├── verification.workflow.test.ts  ← record state machine (all valid + invalid transitions)
│   └── prisma.integration.test.ts   ← real DB tests (skipped without DATABASE_URL_TEST)
│
├── routes/
│   ├── auth.routes.test.ts          ← /login, /refresh, /logout, /me, /change-password
│   ├── users.routes.test.ts         ← RBAC, self-service guards, ROLE_CHANGED audit
│   ├── candidates.routes.test.ts    ← CRUD + Zod validation
│   ├── records.routes.test.ts       ← CRUD + workflow transitions
│   ├── documents.routes.test.ts     ← upload/list/delete + ownership authorization
│   ├── notifications.routes.test.ts ← route ordering (/mark-all-read vs /:id/read)
│   ├── search.routes.test.ts        ← privilege-scoped global search
│   ├── analytics.routes.test.ts     ← overview aggregation + audit log access
│   └── export.routes.test.ts        ← CSV/JSON output, RBAC, RFC-4180 quoting
│
├── repositories/
│   └── index.test.ts                ← enum↔string mapping, DateTime serialization, token hashing
├── schemas/
│   └── index.test.ts                ← Zod validation — all schemas, edge cases, role-stripping
├── services/
│   └── auth.service.test.ts
└── lib/
    ├── storage.test.ts              ← save/delete/ensureDir, MIME + size limits
    ├── email.test.ts                ← SMTP-on / SMTP-off paths, graceful failure, template rendering
    └── ws-notify.test.ts            ← client registry, dedup-close, notifyUser fan-out

frontend/src/app/core/
├── services/__tests__/
│   ├── auth.service.spec.ts         ← login, logout, token storage, role helpers
│   ├── records.service.spec.ts
│   └── theme.service.spec.ts
└── guards/__tests__/
    └── auth.guard.spec.ts           ← redirect on unauthenticated access
```

---

## Key Patterns

### Mocking repositories

```typescript
jest.mock('../repositories/index');          // auto-mocks all exported instances
jest.mock('../lib/ws-notify', () => ({ notifyUser: jest.fn() }));  // silence WS calls

const mockRecordRepo = recordRepo as jest.Mocked<typeof recordRepo>;
mockRecordRepo.findById.mockResolvedValue(makeSerializedRecord());
```

### Pre-signed test tokens

```typescript
import { ADMIN_TOKEN, MANAGER_TOKEN, VERIFIER_TOKEN } from './__tests__/helpers/factories';

// Tokens are pre-signed with JWT_SECRET and have no expiry — no fake timers needed
const res = await request(app)
  .get('/api/records')
  .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
```

### Schema tests (pure Zod — zero mocks)

```typescript
const r = loginSchema.safeParse({ userId: 'admin001', password: 'Admin@123', role: 'Admin' });
expect(r.success).toBe(true);
expect(r.data).not.toHaveProperty('role');  // role-stripping security invariant
```

---

## Coverage Summary

| Area | Key Assertions |
|------|----------------|
| Login flow | Role from DB, audit log written, access + refresh pair returned |
| Refresh rotation | Old token revoked, new pair issued, retry works |
| Password change | All sessions revoked after change |
| RBAC enforcement | Wrong role → 403; correct role → 2xx on every route |
| Record state machine | All valid transitions pass; all invalid transitions → 400 with `allowedNext` |
| Terminal immutability | APPROVED / REJECTED records reject all field updates |
| Zod schemas | All schemas, edge cases, role-stripping invariant verified |
| Document authz | Upload succeeds for allowed roles; wrong-owner delete → 403 |
| User management | Admin-only create; self-edit guard; ROLE_CHANGED audit event |
| Search / Analytics / Export | Privilege scoping, CSV RFC-4180 quoting, audit access gating |
| Repository layer | Enum↔string maps, DateTime serialization, token hashing round-trips |
| Email service | SMTP-on / SMTP-off paths; EAUTH 525 handled gracefully |
| WebSocket bus | Register, dedup-close, notifyUser fan-out, no-op on missing client |
| Frontend auth | Token storage, role helpers, logout clears all state |
| Angular routing | Unauthenticated access redirects to `/auth/login` |

---

## Integration Tests (Optional)

Integration tests hit a real PostgreSQL database and are skipped by default:

```bash
# Create a separate Neon branch for test isolation (free)
# Copy the connection string and set DATABASE_URL_TEST

DATABASE_URL_TEST="postgresql://..." npm run test:integration
```

Integration tests cover Prisma enum↔string round-trips, token hashing consistency, and DateTime serialization — scenarios where ORM behavior must match actual DB types.
