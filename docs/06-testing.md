# MPloyChek — Testing Guide

## Test Stack
- **Jest** with `ts-jest` transformer
- **Supertest** for HTTP integration tests
- **Angular TestBed** + `HttpClientTestingModule` for frontend
- **Prisma mock** for database (no real DB needed for unit tests)

---

**244 tests across 18 suites**, no database required. Coverage gate enforced in
CI: statements 70% · branches 60% · functions 70% · lines 70% (currently
81 / 62 / 76 / 84). All scripts are cross-platform (Windows `cmd`/PowerShell, macOS/Linux).

## Test Commands

```bash
cd backend

npm test               # full suite (run once, no watch)
npm run test:unit      # schemas, services, lib, routes
npm run test:flow      # full auth lifecycle + workflow state machine
npm run test:coverage  # coverage report → open coverage/index.html
npm run test:ci        # CI mode — coverage + thresholds enforced
npm run test:watch     # watch mode during development

# Integration tests against a real database (opt-in)
DATABASE_URL_TEST=your_neon_url npm run test:integration
```

---

## Test Structure

```
backend/src/
├── __tests__/
│   ├── helpers/
│   │   └── factories.ts         # makeDbUser(), makeSerializedUser(), JWT tokens
│   ├── setup.ts                 # jest global setup / teardown
│   ├── auth.flow.test.ts        # full login → refresh → change-pw → logout cycle
│   ├── auth.service.spec.ts     # UserService unit tests
│   ├── verification.workflow.test.ts  # record status state machine
│   └── prisma.integration.test.ts    # (skipped without DATABASE_URL_TEST)
├── routes/
│   ├── auth.routes.test.ts          # /auth/login, /refresh, /logout, /me, /change-password
│   ├── users.routes.test.ts         # RBAC, self-service, ROLE_CHANGED audit
│   ├── candidates.routes.test.ts    # CRUD + validation
│   ├── records.routes.test.ts       # CRUD + workflow transitions
│   ├── documents.routes.test.ts     # upload/list/delete + authz
│   ├── notifications.routes.test.ts # route ordering (/mark-all-read vs /:id/read)
│   ├── search.routes.test.ts        # privilege-scoped global search
│   ├── analytics.routes.test.ts     # overview aggregation + audit access
│   └── export.routes.test.ts        # CSV/JSON, RBAC, RFC-4180 quoting
├── repositories/
│   └── index.test.ts            # enum↔string mapping, serialization, token hashing
├── schemas/
│   └── index.test.ts            # Zod validation — all schemas
├── services/
│   └── auth.service.test.ts
└── lib/
    ├── storage.test.ts          # save/delete/ensureDir, mime + size limits
    ├── email.test.ts            # SMTP-on / SMTP-off paths, template rendering
    └── ws-notify.test.ts        # client registry, dedup, notifyUser fan-out

frontend/src/
└── app/core/
    ├── services/__tests__/
    │   ├── auth.service.spec.ts  # login, logout, token storage, role helpers
    │   ├── records.service.spec.ts
    │   └── theme.service.spec.ts
    └── guards/__tests__/
        └── auth.guard.spec.ts
```

---

## Key Test Patterns

### Mocking repositories (backend)
```typescript
jest.mock('../repositories/index');         // auto-mocks all exported instances
jest.mock('../repositories/user.repository');
jest.mock('../lib/ws-notify', () => ({ notifyUser: jest.fn() }));  // prevent WS calls

const mockRecordRepo = recordRepo as jest.Mocked<typeof recordRepo>;
mockRecordRepo.findById.mockResolvedValue(makeSerializedRecord());
```

### Test factories
```typescript
import { makeDbUser, makeSerializedUser, ADMIN_TOKEN, MANAGER_TOKEN } from './__tests__/helpers/factories';

// Use pre-signed JWTs (no expiry in test) as Authorization headers
const res = await request(app)
  .get('/api/records')
  .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
```

### Schema tests
```typescript
// Pure Zod — no mocks needed
const r = loginSchema.safeParse({ userId: 'admin001', password: 'Admin@123' });
expect(r.success).toBe(true);
expect(r.data).not.toHaveProperty('role'); // role stripped — security test
```

---

## What Tests Cover

| Area | Tests | Notes |
|------|-------|-------|
| Login flow | Auth routes + flow test | Role-from-DB, audit logging, token pair |
| Refresh token rotation | Auth routes test | Old token revoked, new pair issued |
| Password change | Routes + flow test | Session revocation verified |
| RBAC | Every route test | Admin/Manager/Verifier/General User — wrong role → 403 |
| Record status machine | Workflow test | All valid + invalid transitions, terminal immutability |
| Zod schemas | schemas/index.test.ts | All schemas, edge cases, role-stripping |
| Document upload | Documents routes test | Cloudinary + local storage, authz on delete |
| User management | users.routes.test.ts | Create (Admin-only), self-edit guards, ROLE_CHANGED audit |
| Search / Analytics / Export | dedicated route tests | Privilege scoping, CSV quoting, audit access |
| Repository layer | repositories/index.test.ts | Enum↔string maps, DateTime serialization, token hashing |
| Email service | lib/email.test.ts | SMTP-on/off paths, graceful failure, template rendering |
| WebSocket bus | lib/ws-notify.test.ts | Register, dedup-close, `notifyUser` fan-out, no-op cases |
| Frontend auth | auth.service.spec.ts | Token storage, role helpers, logout |
| Angular routing | auth.guard.spec.ts | Redirect on unauthenticated access |
