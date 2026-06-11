<div align="center">

<h1>🔍 MPloyChek</h1>
<h3>Enterprise Background Verification Platform</h3>

<p>
  <a href="#"><img src="https://img.shields.io/badge/Status-In%20Development-orange?style=flat-square" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Version-4.0.0-blue?style=flat-square" /></a>
  <a href="#"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Tests-176%20passing-brightgreen?style=flat-square&logo=jest" /></a>
</p>

<p>
  <img src="https://img.shields.io/badge/Angular-17-DD0031?style=flat-square&logo=angular&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-18-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white" />
</p>

<p>
  <img src="https://img.shields.io/badge/Backend-Render.com-46E3B7?style=flat-square&logo=render&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-Vercel-000000?style=flat-square&logo=vercel&logoColor=white" />
  <img src="https://img.shields.io/badge/Database-Neon%20PostgreSQL-00E5B4?style=flat-square&logo=neon&logoColor=white" />
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white" />
</p>

<p>
  <b>A production-grade full-stack SaaS platform for HR background verification.</b>
</p>

<p>
  <a href="#-quick-start">Get Started</a> ·
  <a href="#-api-endpoints">API Docs</a> ·
  <a href="#-test-suite">Tests (176)</a> ·
  <a href="#-deployment">Deploy Guide</a>
</p>

<!-- TODO: Add live demo URL once deployed -->
<!-- <a href="#">🔗 Live Demo</a> -->

</div>

---

## 📌 What is MPloyChek?

MPloyChek is a **background verification SaaS** for HR teams. It manages the full lifecycle of candidate screening — criminal checks, employment history, education verification, and address validation — with a structured approval workflow, role-based access control, and a real-time audit trail.

> **Why build this?**
> This project demonstrates every pattern a full-stack engineer needs for a production role: strict authentication with refresh-token rotation, fine-grained RBAC, relational database design with Prisma, file uploads, real-time WebSocket notifications, a state-machine workflow, comprehensive testing (176 tests), and zero-cost CI/CD deployment.

---

## ✨ Features

| Category | Feature | Details |
|----------|---------|---------|
| 🔐 **Auth** | JWT + Refresh Token Rotation | 8h access tokens, 7d refresh tokens, SHA-256 hashed in DB |
| 🛡️ **Authorization** | 4-Role RBAC | Admin / Manager / Verifier / General User with 20+ permission constants |
| 📋 **Workflow** | Verification State Machine | `PENDING → IN_REVIEW → VERIFICATION_RUNNING → APPROVED/REJECTED` — invalid transitions blocked (400) |
| 📁 **Documents** | Secure File Uploads | Multer + Cloudinary; supports PDF, JPEG, PNG, WEBP, DOC, DOCX (max 10 MB) |
| 📡 **Realtime** | WebSocket Notifications | Live dashboard updates via `ws` library |
| 📊 **Analytics** | Overview Dashboard | Record metrics, candidate stats, monthly trends, audit activity |
| 🔍 **Search** | Global Search | Cross-entity search across candidates, records, users |
| 📤 **Export** | CSV / JSON / PDF | Role-filtered exports for records and candidate data |
| 📧 **Email** | Transactional Emails | Nodemailer + Brevo SMTP (300 emails/day free) |
| 📝 **Audit Trail** | Immutable Audit Log | Every state change logged: action, actor, target, IP, timestamp |
| 🧪 **Tests** | 176 Automated Tests | Unit, Integration, E2E lifecycle, Prisma DB tests |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Angular 17 Frontend (Vercel CDN)                       │
│  7 Lazy-Loaded Modules: Dashboard · Candidates · Records│
│  Admin · Profile · Notifications · Reports              │
│  JWT Interceptor · Auth Guard · RxJS Services           │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTPS + WebSocket (WSS)
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Node.js / Express (Render.com)                         │
│  ├── Middleware:  auth · rbac · validate · rate-limit   │
│  ├── Routes:      auth · users · candidates · records   │
│  │               documents · notifications · analytics  │
│  │               search · export                        │
│  ├── Services:    AuthService · UserService             │
│  ├── Repositories: Prisma-backed data-access layer      │
│  └── WebSocket: native ws — live notification push      │
└───────────┬──────────────────────────────┬──────────────┘
            │                              │
            ▼                              ▼
┌──────────────────────┐    ┌─────────────────────────────┐
│  Neon PostgreSQL     │    │  Cloudinary CDN             │
│  8 Prisma models     │    │  Document / image storage   │
│  Schema-first + enums│    └─────────────────────────────┘
│  Migrations + seeding│
└──────────────────────┘
```

### Database Schema (8 Models)

```
User ──────┬─── RefreshToken
           ├─── Record ──────── TimelineEvent
           ├─── Notification
           └─── AuditLog

Candidate ─┬─── Education
           ├─── Employment
           ├─── Document
           └─── PreviousAddress
```

### Verification Workflow

```
              ┌──────────┐
              │ PENDING  │◄────────────────────────┐
              └────┬─────┘                         │
                   │                               │
                   ▼                               │
            ┌───────────┐      ┌──────────┐        │
            │ IN_REVIEW │      │ ON_HOLD  │────────┘
            └─────┬─────┘      └────▲─────┘
                  │                 │
                  ▼                 │
    ┌────────────────────────┐      │
    │ VERIFICATION_RUNNING   │──────┘
    └──────────┬─────────────┘
               │
      ┌────────┴─────────┐
      ▼                  ▼
 ┌──────────┐       ┌──────────┐
 │ APPROVED │       │ REJECTED │
 └──────────┘       └──────────┘
   (Terminal)         (Terminal)

Also: PENDING → CANCELLED (Terminal)
```

---

## 🛠️ Tech Stack

### Backend

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | Node.js 18 (LTS) | Non-blocking I/O, broad ecosystem |
| Language | TypeScript 5.3 | End-to-end type safety |
| Framework | Express.js | Minimal, well-understood |
| ORM | Prisma 5 | Type-safe queries, schema-first migrations |
| Database | PostgreSQL on Neon | ACID compliance, free forever |
| Auth | JWT + Refresh Tokens | Stateless access + revocable sessions |
| Validation | Zod | Runtime-safe schema validation |
| Logging | Winston | Structured JSON, daily log rotation |
| Security | Helmet + bcrypt + rate-limit | Production hardening |
| Realtime | WebSocket (`ws`) | Live dashboard notifications |
| Email | Nodemailer + Brevo | 300 emails/day on free tier |
| Storage | Multer + Cloudinary | Zero-cost document CDN |

### Frontend

| Layer | Choice |
|-------|--------|
| Framework | Angular 17 |
| Language | TypeScript |
| UI | Angular Material + TailwindCSS |
| State | RxJS + Services |
| HTTP | HttpClient + JWT Interceptor |
| Charts | Chart.js |

### Infrastructure (All Free)

| Service | Provider | Free Tier |
|---------|----------|-----------|
| API Hosting | Render.com | 750 hrs/month |
| Frontend CDN | Vercel | Unlimited |
| Database | Neon | 0.5 GB PostgreSQL |
| Email | Brevo | 300 emails/day |
| File Storage | Cloudinary | 25 GB |
| CI/CD | GitHub Actions | 2,000 min/month |

---

## 🔐 Security Model

- **JWT Access Tokens** (8h TTL) + **Refresh Tokens** (7 days, stored SHA-256 hashed)
- **Refresh Token Rotation** — old token invalidated on every refresh (prevents replay attacks)
- **RBAC** with 20+ granular permission constants, enforced at the middleware boundary:

  | Role | Key Permissions |
  |------|----------------|
  | `ADMIN` | Full access: users, candidates, records, analytics, audit export |
  | `MANAGER` | Manage candidates & records, view analytics |
  | `VERIFIER` | Assigned records only, transition workflow states |
  | `GENERAL_USER` | Own records and profile only |

- **bcrypt** password hashing (cost factor 10) at the service layer
- **Helmet** security headers on every response
- **Tiered rate limiting**: 300 req/15 min global · 10 login attempts/15 min per IP
- **Immutable audit trail**: every action logged with actor, target, IP, timestamp

---

## 🚀 Quick Start (Local)

### Prerequisites

- Node.js 18+
- PostgreSQL (or [Neon](https://neon.tech) free account)
- Git

### 1. Clone & Install

```bash
git clone https://github.com/MsParadox/mploychek.git
cd mploychek
```

### 2. Backend Setup

```bash
cd backend
cp ../.env.example .env
# Required: DATABASE_URL, DIRECT_URL (Neon), JWT_SECRET (32+ chars)
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev          # → http://localhost:3000
```

### 3. Frontend Setup

```bash
# New terminal
cd frontend
npm install
npx ng serve         # → http://localhost:4200
```

### 4. Docker (Full Stack)

```bash
cp .env.example .env
docker-compose up --build -d
# Frontend: http://localhost  |  API: http://localhost:3000/api
```

### Demo Accounts

| User ID | Password | Role |
|---------|----------|------|
| `admin001` | `Admin@123` | Admin |
| `john001` | `User@123` | Manager |
| `priya001` | `Verify@123` | Verifier |
| `mohit001` | `User@123` | General User |

---

## 🧪 Test Suite — 176 Tests

```
Unit Tests          (61)   schemas · AuthService · storage helpers
Integration Tests   (84)   auth endpoints · records workflow · candidates · documents
E2E Flow Tests      (22)   full auth lifecycle · verification state machine
Prisma DB Tests      (9)   real DB — opt-in via DATABASE_URL_TEST
─────────────────────────────────────────────────────────
Total: 176 tests across 10 files
```

```bash
npm test                    # all unit + integration + E2E
npm run test:unit           # schemas, services, storage
npm run test:flow           # auth lifecycle + state machine
npm run test:integration    # Prisma DB tests (requires DATABASE_URL_TEST)
npm run test:coverage       # HTML coverage report
```

**Coverage highlights:**
- Every valid workflow transition tested (e.g. `PENDING → IN_REVIEW → VERIFICATION_RUNNING → APPROVED`)
- Every invalid shortcut blocked (e.g. `PENDING → APPROVED` returns 400 with `allowedNext`)
- Terminal records are immutable — even non-status field updates blocked post-approval
- Document upload/delete with wrong owner returns 403; audit event verified on every upload

---

## 📡 API Endpoints

<details>
<summary><b>Auth</b></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/login` | ❌ | Login, returns JWT pair |
| `POST` | `/api/auth/refresh` | ❌ | Rotate refresh token |
| `POST` | `/api/auth/logout` | ✅ | Revoke all sessions |
| `GET` | `/api/auth/me` | ✅ | Current user profile |
| `POST` | `/api/auth/change-password` | ✅ | Change password + revoke sessions |

</details>

<details>
<summary><b>Users</b></summary>

| Method | Endpoint | Role Required | Description |
|--------|----------|---------------|-------------|
| `GET` | `/api/users` | Admin/Manager | List all users |
| `POST` | `/api/users` | Admin | Create user |
| `GET` | `/api/users/stats` | Admin | Platform statistics |
| `PATCH` | `/api/users/:id` | Admin or Self | Update user |
| `DELETE` | `/api/users/:id` | Admin | Delete user |

</details>

<details>
<summary><b>Candidates & Records</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/candidates` | List candidates (RBAC-filtered) |
| `POST` | `/api/candidates` | Create candidate |
| `PATCH` | `/api/candidates/:id` | Update candidate |
| `DELETE` | `/api/candidates/:id` | Delete (Admin) |
| `GET` | `/api/records` | List records (RBAC-filtered) |
| `POST` | `/api/records` | Create record |
| `PATCH` | `/api/records/:id` | Update / advance workflow |
| `GET` | `/api/records/summary` | Status breakdown |

</details>

<details>
<summary><b>Documents, Notifications, Search, Export</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/documents/upload/:candidateId` | Upload document (multipart) |
| `GET` | `/api/documents/candidate/:id` | List candidate documents |
| `DELETE` | `/api/documents/:id` | Delete document |
| `GET` | `/api/notifications` | User notifications |
| `PATCH` | `/api/notifications/:id/read` | Mark read |
| `PATCH` | `/api/notifications/read-all` | Mark all read |
| `GET` | `/api/search?q=term` | Global search |
| `GET` | `/api/export/:format/:type` | Export CSV/JSON/PDF |
| `GET` | `/api/analytics/overview` | Analytics dashboard data |
| `GET` | `/api/health` | Health check + DB status |

</details>

---

## 📁 Project Structure

```
mploychek/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        ← source of truth (8 models, 6 enums)
│   │   └── seed.ts              ← demo data seeder
│   └── src/
│       ├── index.ts             ← app bootstrap + WebSocket server
│       ├── lib/                 ← prisma · logger · email · storage
│       ├── middleware/          ← auth · rbac · validate
│       ├── repositories/        ← Prisma data-access layer
│       ├── services/            ← business logic (auth, user)
│       └── routes/              ← 9 route groups
│
├── frontend/
│   └── src/app/
│       ├── core/                ← services · models · guards · interceptors
│       ├── modules/             ← 7 lazy-loaded feature modules
│       └── shared/              ← navbar · global-search · session-warning
│
├── .github/workflows/           ← CI/CD (test → build → deploy)
├── docker-compose.yml           ← full local dev stack
├── render.yaml                  ← one-click Render deploy
└── README.md
```

---

## ☁️ Deployment Guide

### Backend → Render.com

1. Connect GitHub repo → New Web Service → Root dir: `backend`
2. Build: `npm ci && npx prisma generate && npm run build`
3. Start: `npx prisma migrate deploy && node dist/index.js`
4. Set env vars from `.env.example` (DATABASE_URL, JWT_SECRET, CLOUDINARY_*, BREVO_*)

### Frontend → Vercel

```bash
cd frontend
vercel --prod
# Set VITE_API_URL=https://your-render-app.onrender.com/api
```

### CI/CD (GitHub Actions)

Push to `main` → type-check → Jest tests → Angular production build → trigger Render deploy hook → Vercel deploy. All automated, $0/month.

---


## 👨‍💻 Author

**Mohit Sharma** — Full-Stack Developer · Angular · Node.js · TypeScript · PostgreSQL

[![GitHub](https://img.shields.io/badge/GitHub-MsParadox-181717?style=flat-square&logo=github)](https://github.com/MsParadox)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-mohit--sharma-0A66C2?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/mohit-sharma-27a6532b6)

---

<div align="center">
  <b>Built with Angular · Node.js · TypeScript · PostgreSQL · Prisma · Docker</b>
</div>
