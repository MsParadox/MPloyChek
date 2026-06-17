# MPloyChek — Architecture Overview

## System Design

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Vercel)                 │
│           Angular 15 + Material + RxJS              │
│                                                     │
│  Auth → Dashboard → Candidates → Records → Admin    │
└─────────────────────┬───────────────────────────────┘
                      │ HTTPS + JWT
                      │ WebSocket (real-time)
┌─────────────────────▼───────────────────────────────┐
│                  Backend (Render)                   │
│           Node.js + Express + TypeScript            │
│                                                     │
│  Routes → Middleware → Services → Repositories      │
│  Security: Helmet, Rate Limit, RBAC, Zod, bcrypt    │
└──────────────────────┬──────────────────────────────┘
                       │ Prisma ORM
           ┌───────────┼───────────┐
           │           │           │
    ┌──────▼──────┐  ┌─▼──────┐ ┌─▼────────┐
    │    Neon     │  │ Brevo  │ │Cloudinary│
    │ PostgreSQL  │  │ Email  │ │ Storage  │
    │  (free)     │  │ (free) │ │  (free)  │
    └─────────────┘  └────────┘ └──────────┘
```

## Request Lifecycle

```
HTTP Request
→ express-rate-limit     (429 if exceeded)
→ helmet                 (security headers)
→ cors                   (origin check)
→ express.json()         (body parsing)
→ morgan/httpLogger      (request logging)
→ authenticate()         (JWT verification)
→ rbac middleware        (permission check)
→ validate(schema)       (Zod validation → 400 on fail)
→ Route Handler          (business logic)
→ Repository             (Prisma → PostgreSQL)
→ JSON Response
```

## Directory Structure

```
backend/
├── prisma/
│   ├── schema.prisma    # Source of truth for all DB models
│   └── seed.ts          # Demo data seeder
├── src/
│   ├── index.ts         # App bootstrap, WS server, route mounting
│   ├── lib/
│   │   ├── prisma.ts    # Singleton PrismaClient
│   │   ├── logger.ts    # Winston structured logging
│   │   ├── email.ts     # Brevo email service
│   │   ├── storage.ts   # Local/Cloudinary document storage
│   │   └── ws-notify.ts # WebSocket notification bus (decoupled from index.ts)
│   ├── middleware/
│   │   ├── auth.ts      # JWT authentication
│   │   ├── rbac.ts      # Permission-based authorization
│   │   └── validate.ts  # Zod schema validation
│   ├── repositories/    # Data access layer (Prisma)
│   ├── services/        # Business logic layer
│   └── routes/          # HTTP route handlers
frontend/
├── src/app/
│   ├── core/
│   │   ├── services/    # Angular services (HTTP calls)
│   │   ├── models/      # TypeScript interfaces
│   │   ├── guards/      # Route guards
│   │   └── interceptors/# JWT interceptor (auto-attach token)
│   ├── modules/         # Feature modules (lazy-loaded)
│   └── shared/          # Shared components
```
