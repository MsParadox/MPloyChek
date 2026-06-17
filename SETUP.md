# MPloyChek — Local Setup Guide
**Author: Mohit Sharma**

---

## Services Used (All Free)

| Service | Purpose | Limit |
|---------|---------|-------|
| **Neon** | PostgreSQL database | 512 MB, 1 project |
| **Brevo** | Transactional email | 300 emails/day |
| **Cloudinary** | Document/file storage | 25 GB |
| **Render** | Backend API hosting | 750 hrs/month |
| **Vercel** | Frontend hosting | Unlimited |
| **GitHub Actions** | CI/CD pipeline | 2000 min/month |

---

## Prerequisites

```bash
node --version   # v18 or higher required
npm --version    # v9+
git --version
```

---

## Step 1 — Neon PostgreSQL 

1. Go to **[neon.tech](https://neon.tech)** → Sign up free (no credit card)
2. Click **New Project** → Name: `mploychek` → Region: closest to you
3. Go to **Connection Details** → copy both strings:
   - **Connection string** → `DATABASE_URL`
   - **Direct connection** → `DIRECT_URL`

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/mploychek?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/mploychek?sslmode=require
```

---

## Step 2 — Brevo Email

1. Go to **[brevo.com](https://brevo.com)** → Create free account
2. **Settings → SMTP & API → SMTP** tab → Generate credentials

```env
BREVO_SMTP_LOGIN=your_email@example.com
BREVO_SMTP_PASSWORD=xsmtpxxxxxxxxxxxxxxxxxxxxxxxx
BREVO_SENDER_EMAIL=noreply@mploychek.com
```

**Emails sent by MPloyChek:** login alerts, verification completed, password changed, welcome.

---

## Step 3 — Cloudinary File Storage 

1. Go to **[cloudinary.com](https://cloudinary.com)** → Sign up free (25 GB)
2. Dashboard → copy three values:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-api-secret
```

> **Without Cloudinary:** app works fine — uploaded files save to local disk (`/app/uploads`).

---

## Step 4 — Local Backend Setup

```bash
cd backend

# Copy and fill environment variables
cp ../.env.example .env
# Edit .env: paste values from steps 1–3, generate JWT_SECRET

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Install dependencies
npm install

# Generate Prisma client (required before running)
npx prisma generate

# Run database migrations (creates all tables)
npx prisma migrate deploy

# Seed demo data
npm run db:seed

# Start development server
npm run dev
# → http://localhost:3000/api
```

---

## Step 5 — Local Frontend Setup

```bash
cd frontend
npm install
npx ng serve
# → http://localhost:4200
```

---

## Demo Credentials

| User ID | Password | Role |
|---------|----------|------|
| `admin001` | `Admin@123` | Admin |
| `john001` | `User@123` | Manager |
| `priya001` | `Verify@123` | Verifier |
| `mohit001` | `User@123` | General User |

---

## Docker (Full Stack Local)

```bash
cp .env.example .env    # fill DATABASE_URL, JWT_SECRET
docker-compose -f docker-compose.dev.yml up
# Frontend: http://localhost:4200
# Backend:  http://localhost:3000/api
# DB:       localhost:5432 (local PostgreSQL)
```

---

## Running Tests

```bash
cd backend

npm test              # full suite — 244 tests, no DB needed
npm run test:unit     # schemas, services, lib, routes
npm run test:flow     # full auth lifecycle + workflow state machine
npm run test:coverage # with HTML coverage report (open coverage/index.html)
npm run test:ci       # CI mode — coverage thresholds enforced (70/60/70/70)

# Integration tests (requires real DB)
DATABASE_URL_TEST=your_neon_url npm run test:integration
```

---

## For Production Deployment

See **[DEPLOY_FREE.md](DEPLOY_FREE.md)** for the complete step-by-step guide to deploy on Render (backend) + Vercel (frontend) at $0/month.
