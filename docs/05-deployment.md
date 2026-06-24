# MPloyChek — Deployment Guide

> **Stack:** Angular 15 (Vercel) · Node.js / Express (Render) · PostgreSQL (Neon) · Files (Cloudinary) · Email (Brevo)  
> Every service used here — no credit card required.

---

## Production Architecture

```
Browser
  │
  ▼
Vercel (Angular SPA — CDN, global edge)
  │
  │  HTTPS (REST + JWT)    WSS (WebSocket)
  ▼                              ▼
Render (Node.js / Express)  ←────┘
  │
  ├── Neon PostgreSQL (DATABASE_URL + DIRECT_URL)
  ├── Cloudinary (file/document storage)
  └── Brevo (transactional email)

GitHub → GitHub Actions → Render deploy hook + Vercel deploy
```

---

## Tier Overview

| Layer | Service | Free Limit |
|-------|---------|-----------|
| Frontend | Vercel | Unlimited deploys · 100 GB bandwidth |
| Backend API | Render | 750 hrs/month · sleeps after 15 min idle |
| Database | Neon | 512 MB PostgreSQL · 5 GB transfer |
| File storage | Cloudinary | 25 credits/month · 25 GB storage |
| Email | Brevo | 300 emails/day |
| CI/CD | GitHub Actions | 2 000 min/month on public repos |

---

## Prerequisites

```bash
node --version    # v18 or higher
npm --version     # v9+
git --version     # any recent version
```

---

## Step 1 — GitHub Repository

1. Go to https://github.com/new
   - Name: `mploychek`
   - Visibility: **Public** (required for free GitHub Actions minutes)
   - Do NOT initialise with README

2. Push your code:

```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/mploychek.git
git add .
git commit -m "chore: initial commit — MPloyChek v4.0"
git push -u origin main
```

---

## Step 2 — Database on Neon (Free PostgreSQL)

### 2a. Create project

1. Go to https://neon.tech — sign up (free, no card required)
2. Click **New Project** · Name: `mploychek` · Region: closest to you
3. Click **Create Project**

### 2b. Get connection strings

Neon dashboard → **Connection Details** — copy both:

```
DATABASE_URL  = postgresql://user:pass@ep-xxx.region.aws.neon.tech/mploychek?sslmode=require
DIRECT_URL    = postgresql://user:pass@ep-xxx.region.aws.neon.tech/mploychek?sslmode=require
```

> **Why two URLs?** `DATABASE_URL` uses Neon's PgBouncer pooler (for queries). `DIRECT_URL` bypasses pooling for Prisma migrations — DDL statements require the extended query protocol which PgBouncer does not support.

### 2c. Run migrations locally

```bash
cd backend
cp ../.env.example .env
# Edit .env — paste both DATABASE_URL values, set JWT_SECRET to any 32+ char string

npm install
npx prisma migrate deploy
npx prisma db seed          # loads 4 demo users + sample data
```

---

## Step 3 — File Storage on Cloudinary

1. Go to https://cloudinary.com/users/register/free — sign up (free, no card)
2. Dashboard → copy three values:

```
CLOUDINARY_CLOUD_NAME = your-cloud-name
CLOUDINARY_API_KEY    = 123456789012345
CLOUDINARY_API_SECRET = abcdefghijklmnopqrstuvwxyz
```

---

## Step 4 — Email on Brevo

1. Go to https://www.brevo.com — sign up (free — 300 emails/day)
2. **SMTP & API** → **SMTP** tab → copy:

```
BREVO_SMTP_LOGIN    = your@email.com
BREVO_SMTP_PASSWORD = xsmtpkey...
BREVO_SENDER_EMAIL  = noreply@yourdomain.com
```

> **Skipping email:** The app works without email. Calls fail gracefully. Add credentials to Render later.

> **IP restriction:** Brevo SMTP blocks unwhitelisted IPs. Render's IPs are dynamic — whitelist them at brevo.com → SMTP & API → Allowed IPs, or switch to Brevo's HTTP API (no IP restrictions).

---

## Step 5 — Deploy Backend to Render

### 5a. Create account

https://render.com → sign up with GitHub → authorize Render.

### 5b. Create Web Service

1. Dashboard → **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:

| Field | Value |
|-------|-------|
| Name | `mploychek-api` |
| Region | Oregon (or nearest) |
| Branch | `main` |
| Root Directory | `backend` |
| Runtime | `Node` |
| Build Command | `npm ci && npx prisma generate && npm run build` |
| Start Command | `npx prisma migrate deploy && node dist/index.js` |
| Plan | **Free** |

### 5c. Set environment variables

Render → your service → **Environment** tab:

```
NODE_ENV              = production
PORT                  = 3000
DATABASE_URL          = [Step 2b — pooled URL]
DIRECT_URL            = [Step 2b — direct URL]
JWT_SECRET            = [generate: openssl rand -hex 32]
JWT_EXPIRES_IN        = 28800
RT_EXPIRES_DAYS       = 7
ALLOWED_ORIGINS       = https://your-app.vercel.app
FRONTEND_URL          = https://your-app.vercel.app
CLOUDINARY_CLOUD_NAME = [Step 3]
CLOUDINARY_API_KEY    = [Step 3]
CLOUDINARY_API_SECRET = [Step 3]
BREVO_SMTP_LOGIN      = [Step 4]
BREVO_SMTP_PASSWORD   = [Step 4]
BREVO_SENDER_EMAIL    = [Step 4]
```

> Alternatively, use `render.yaml` from the repo root for a one-click Render Blueprint deploy.

### 5d. Deploy and verify

Click **Create Web Service**. First deploy takes 3–5 minutes.

```bash
curl https://mploychek-api.onrender.com/api/health
# Expected: { "success": true, "status": "healthy", "database": "connected" }
```

> **Free tier:** Render sleeps after 15 min idle. First wake request takes ~30–60 s. Use UptimeRobot (free) to ping every 5 min.

---

## Step 6 — Deploy Frontend to Vercel

### 6a. Set production API URL

Edit `frontend/src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production:   true,
  apiUrl:       'https://mploychek-api.onrender.com/api',
  wsUrl:        'wss://mploychek-api.onrender.com',
  tokenKey:     'mploychek_token',
  userKey:      'mploychek_user',
  refreshKey:   'mploychek_rt',
  defaultDelay: 0,
};
```

Commit and push before deploying to Vercel.

### 6b. Create Vercel project

1. https://vercel.com → sign up with GitHub → authorize Vercel
2. Dashboard → **Add New Project** → select repo
3. Configure:

| Field | Value |
|-------|-------|
| Framework Preset | Other (or Angular) |
| Root Directory | `frontend` |
| Build Command | `npm run build -- --configuration production` |
| Output Directory | `dist/mploychek` |
| Install Command | `npm ci` |

> **Angular 15 note:** Output directory is `dist/mploychek` — NOT `dist/mploychek/browser` (that suffix is Angular 17+). Verify in `angular.json` → `outputPath`.

### 6c. Deploy

Click **Deploy**. Vercel builds in ~2 minutes. Your frontend goes live at `https://mploychek.vercel.app`.

### 6d. Update CORS

Render → Environment → update:

```
ALLOWED_ORIGINS = https://mploychek.vercel.app
FRONTEND_URL    = https://mploychek.vercel.app
```

Save → Render auto-redeploys.

> **No trailing slash:** `https://mploychek.vercel.app` ✅ &nbsp; `https://mploychek.vercel.app/` ❌

---

## Step 7 — GitHub Actions CI/CD

Set these secrets in your repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Where to find it |
|--------|-----------------|
| `RENDER_API_KEY` | Render → Account → API Keys |
| `RENDER_SERVICE_ID` | Render → your service URL (after `/web/`) |
| `VERCEL_TOKEN` | Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel → Settings → General |
| `VERCEL_PROJECT_ID` | Vercel → your project → Settings |

Every push to `main` now automatically:
1. Runs backend tests (`npm test`)
2. Type-checks frontend (`tsc --noEmit`)
3. Builds Angular production bundle
4. Deploys backend via Render API hook
5. Deploys frontend via Vercel CLI

---

## Step 8 — Seed Demo Data

To reseed at any time:

```bash
cd backend
npx prisma db seed
```

Creates:

| User ID | Password | Role |
|---------|----------|------|
| `admin001` | `Admin@123` | Admin |
| `john001` | `User@123` | Manager |
| `priya001` | `Verify@123` | Verifier |
| `mohit001` | `User@123` | General User |

Plus sample candidates and verification records with various statuses.

---

## Environment Variable Reference

```bash
# ── Database (Neon) ─────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@pooler.host/db?sslmode=require
DIRECT_URL=postgresql://user:pass@direct.host/db?sslmode=require

# ── JWT ─────────────────────────────────────────────────────────
JWT_SECRET=generate-with: openssl rand -hex 32
JWT_EXPIRES_IN=28800
RT_EXPIRES_DAYS=7

# ── CORS ────────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:4200
FRONTEND_URL=http://localhost:4200

# ── Cloudinary ──────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-secret

# ── Brevo (email) ───────────────────────────────────────────────
BREVO_SMTP_LOGIN=you@example.com
BREVO_SMTP_PASSWORD=xsmtpkey
BREVO_SENDER_EMAIL=noreply@yourdomain.com

# ── Server ──────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development
```

---

## Local Development

```bash
# Clone
git clone https://github.com/MsParadox/MPloyChek.git
cd MPloyChek

# Install
cd backend && npm install
cd ../frontend && npm install

# Configure
cd ../backend
cp ../.env.example .env   # fill in Neon DATABASE_URL

# Migrate + seed
npx prisma migrate deploy
npx prisma db seed

# Start (two terminals)
npm run dev               # terminal 1: http://localhost:3000
cd ../frontend && npm start  # terminal 2: http://localhost:4200
```

Docker Compose alternative:

```bash
docker-compose -f docker-compose.dev.yml up
```

---

## CI/CD Flow

```
git push main
  │
  ├─ 1. npm test              (Jest — all 244 tests)
  ├─ 2. tsc --noEmit          (TypeScript type check)
  ├─ 3. ng build --prod       (Angular production bundle)
  ├─ 4. Render deploy hook    (backend redeploys)
  └─ 5. vercel --prod         (frontend redeploys)
```

Pull requests get Vercel preview deployments automatically.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Database disconnected" on Render | Check `DATABASE_URL` ends with `?sslmode=require`. Neon pauses after 5 days idle — resume at neon.tech. |
| "Cannot connect to API" (CORS) | `ALLOWED_ORIGINS` on Render must match the exact Vercel URL with no trailing slash. |
| WebSocket not connecting | `environment.prod.ts` must use `wss://` not `ws://`. Close code 4401 = JWT expired — log in again. |
| Angular build fails on Vercel | Output Directory must be `dist/mploychek` for Angular 15. Check `angular.json` → `outputPath`. |
| Email not working in production | Add Brevo credentials to Render Environment tab. Check logs for `EAUTH 525` (IP not whitelisted). |
| Render spins slowly on first request | Expected on free tier — first wake after 15 min idle takes ~30–60 s. Add UptimeRobot to prevent sleep. |
