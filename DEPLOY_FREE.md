# MPloyChek — Zero-Cost Deployment Guide

**Stack:** Angular (Vercel) + Node.js/Express (Render) + PostgreSQL (Neon) + Files (Cloudinary) + Email (Brevo)

Every service used here has a **permanent free tier** — no credit card required for any of them.

---

## Overview

| Layer        | Service       | Free Tier                         |
|-------------|---------------|-----------------------------------|
| Frontend    | Vercel        | Unlimited static deploys          |
| Backend API | Render        | 750 hrs/month (enough for 1 app)  |
| Database    | Neon          | 512 MB PostgreSQL, 5 GB transfer  |
| File Storage| Cloudinary    | 25 credits/month (plenty)         |
| Email       | Brevo         | 300 emails/day                    |
| CI/CD       | GitHub Actions| 2000 min/month on public repos    |

---

## Step 0 — Prerequisites

Install these tools first:

```bash
node --version    # v18+ required
npm --version     # v9+
git --version     # any
```

---

## Step 1 — Set Up GitHub Repository

1. Create a new repo at https://github.com/new
   - Name: `mploychek`
   - Visibility: **Public** (needed for free GitHub Actions minutes)
   - Do NOT initialise with README

2. Push your code:
```bash
cd mploychek-v4
git init
git remote add origin https://github.com/YOUR_USERNAME/mploychek-v4.git
git add .
git commit -m "chore: initial commit — MPloyChek v4.0"
git push -u origin main
```

---

## Step 2 — Database on Neon (Free PostgreSQL)

### 2a. Create Neon project

1. Go to https://neon.tech and sign up (free, no credit card)
2. Click **New Project**
3. Name: `mploychek`
4. Region: choose closest to you
5. Click **Create Project**

### 2b. Get connection strings

In your Neon dashboard, go to **Connection Details**.

You need two strings — copy them both:

```
DATABASE_URL  = postgresql://user:password@ep-xxx.region.aws.neon.tech/mploychek?sslmode=require
DIRECT_URL    = postgresql://user:password@ep-xxx.region.aws.neon.tech/mploychek?sslmode=require
```

> **Why two URLs?** Prisma uses `DATABASE_URL` for queries and `DIRECT_URL` for migrations (bypasses connection pooling).

### 2c. Run migrations locally (first time)

```bash
cd backend
cp ../.env.example .env
# Edit .env — paste DATABASE_URL and DIRECT_URL from Neon
# Also set: JWT_SECRET=any-random-string-at-least-32-chars

npm install
npx prisma migrate deploy
npx prisma db seed     # loads demo users + sample data
```

---

## Step 3 — File Storage on Cloudinary (Free)

1. Go to https://cloudinary.com/users/register/free
2. Sign up (free tier — 25 credits/month, no card needed)
3. Go to **Dashboard** → copy these three values:

```
CLOUDINARY_CLOUD_NAME = your-cloud-name
CLOUDINARY_API_KEY    = 123456789012345
CLOUDINARY_API_SECRET = abcdefghijklmnopqrstuvwxyz
```

---

## Step 4 — Email on Brevo (Free)

1. Go to https://www.brevo.com and sign up (free — 300 emails/day)
2. Go to **SMTP & API** → **SMTP** tab
3. Copy the credentials:

```
BREVO_SMTP_LOGIN    = your@email.com
BREVO_SMTP_PASSWORD = xsmtpapikey...
BREVO_SENDER_EMAIL  = your@email.com
```

> If you skip email, the app still works — email calls are non-blocking.

---

## Step 5 — Deploy Backend to Render

### 5a. Create Render account

1. Go to https://render.com and sign up with GitHub
2. Authorize Render to access your repos

### 5b. Create Web Service

1. Dashboard → **New** → **Web Service**
2. Connect your `mploychek` GitHub repo
3. Configure:

| Field          | Value                                           |
|---------------|-------------------------------------------------|
| Name           | `mploychek-api`                                 |
| Region         | Oregon (or nearest)                             |
| Branch         | `main`                                          |
| Root Directory | `backend`                                       |
| Runtime        | `Node`                                          |
| Build Command  | `npm ci && npx prisma generate && npm run build`|
| Start Command  | `npx prisma migrate deploy && node dist/index.js`|
| Plan           | **Free**                                        |

### 5c. Set environment variables

In Render → your service → **Environment** tab, add:

```
NODE_ENV              = production
PORT                  = 3000
DATABASE_URL          = [paste from Neon — Step 2b]
DIRECT_URL            = [paste from Neon — Step 2b]
JWT_SECRET            = [click "Generate" or paste: openssl rand -hex 32]
JWT_EXPIRES_IN        = 28800
RT_EXPIRES_DAYS       = 7
ALLOWED_ORIGINS       = https://mploychek.vercel.app
FRONTEND_URL          = https://mploychek.vercel.app
CLOUDINARY_CLOUD_NAME = [Step 3]
CLOUDINARY_API_KEY    = [Step 3]
CLOUDINARY_API_SECRET = [Step 3]
BREVO_SMTP_LOGIN      = [Step 4]
BREVO_SMTP_PASSWORD   = [Step 4]
BREVO_SENDER_EMAIL    = [Step 4]
```

> You can also use the `render.yaml` in the root for one-click deploy via the Render Blueprint feature.

### 5d. Deploy

Click **Create Web Service**. First deploy takes 3–5 minutes.

When done, your API will be live at:
```
https://mploychek-api.onrender.com
```

Test it:
```bash
curl https://mploychek-api.onrender.com/api/health
```

Expected response:
```json
{ "success": true, "status": "healthy", "database": "connected" }
```

> **Free tier note:** Render free services sleep after 15 minutes of inactivity. First request after sleep takes ~30 seconds. This is fine for a portfolio project.

---

## Step 6 — Deploy Frontend to Vercel

### 6a. Update production environment

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

Commit and push:
```bash
git add .
git commit -m "config: set Render API URL for production"
git push
```

### 6b. Create Vercel account

1. Go to https://vercel.com and sign up with GitHub
2. Authorize Vercel to access your repos

### 6c. Import project

1. Dashboard → **Add New Project**
2. Select `mploychek-v4` from your repos
3. Configure:

| Field           | Value                                    |
|----------------|------------------------------------------|
| Framework Preset| Other (or Angular)                       |
| Root Directory  | `frontend`                               |
| Build Command   | `npm run build -- --configuration production` |
| Output Directory| `dist/mploychek`        |
| Install Command | `npm ci`                                 |

### 6d. Deploy

Click **Deploy**. Vercel builds and deploys in ~2 minutes.

Your frontend will be live at:
```
https://mploychek.vercel.app
```

### 6e. Update CORS on Render

Go back to Render → Environment → update:
```
ALLOWED_ORIGINS = https://mploychek.vercel.app
FRONTEND_URL    = https://mploychek.vercel.app
```

Click **Save Changes** — Render auto-redeploys.

---

## Step 7 — Set Up GitHub Actions CI/CD

The `.github/workflows/deploy.yml` already exists. Set these secrets in GitHub:

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name           | Value                                |
|----------------------|--------------------------------------|
| `RENDER_API_KEY`     | Render → Account → API Keys          |
| `RENDER_SERVICE_ID`  | Render → your service → Service ID   |
| `VERCEL_TOKEN`       | Vercel → Settings → Tokens           |
| `VERCEL_ORG_ID`      | Vercel → Settings → General          |
| `VERCEL_PROJECT_ID`  | Vercel → your project → Settings     |

After this every push to `main` automatically:
1. Runs backend tests
2. Deploys backend to Render
3. Builds frontend
4. Deploys frontend to Vercel

---

## Step 8 — Seed Demo Data

If you need to reseed the database:

```bash
cd backend

# Make sure DATABASE_URL is in your .env
npx prisma db seed
```

This creates:
- `admin001 / Admin@123` → Admin
- `john001 / User@123` → Manager  
- `priya001 / Verify@123` → Verifier
- `mohit001 / User@123` → General User
- Sample candidates and verification records

---

## Full .env Reference

Copy `.env.example` to `.env` in the `backend/` folder:

```bash
# ── Database ────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DIRECT_URL=postgresql://user:pass@host/db?sslmode=require

# ── JWT ─────────────────────────────────────────────────────
JWT_SECRET=generate-with: openssl rand -hex 32
JWT_EXPIRES_IN=28800
RT_EXPIRES_DAYS=7

# ── CORS ────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:4200
FRONTEND_URL=http://localhost:4200

# ── Cloudinary ──────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abc123

# ── Brevo (email) ───────────────────────────────────────────
BREVO_SMTP_LOGIN=you@example.com
BREVO_SMTP_PASSWORD=xsmtpkey
BREVO_SENDER_EMAIL=noreply@mploychek.com

# ── Server ──────────────────────────────────────────────────
PORT=3000
NODE_ENV=development
```

---

## Local Development (Quick Start)

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/mploychek-v4.git
cd mploychek-v4

# 2. Install all dependencies
npm install           # root
cd backend && npm install
cd ../frontend && npm install

# 3. Configure backend
cd ../backend
cp ../.env.example .env
# Edit .env with your Neon DATABASE_URL

# 4. Migrate + seed
npx prisma migrate deploy
npx prisma db seed

# 5. Start backend (terminal 1)
npm run dev           # http://localhost:3000

# 6. Start frontend (terminal 2)
cd ../frontend
npm start             # http://localhost:4200
```

Or with Docker Compose:
```bash
# From project root
docker-compose -f docker-compose.dev.yml up
```

---

## Troubleshooting

### Backend shows "Database disconnected" on Render

- Check DATABASE_URL has `?sslmode=require` at the end
- Neon free tier pauses databases after 5 days of inactivity — visit neon.tech and click **Resume**

### Frontend shows "Cannot connect to API"

- Verify `ALLOWED_ORIGINS` on Render includes your exact Vercel URL
- No trailing slash: `https://mploychek.vercel.app` ✅ not `https://mploychek.vercel.app/` ❌

### WebSocket not connecting

- Render free tier uses `wss://` (TLS) in production — ensure `environment.prod.ts` uses `wss://`, not `ws://`
- Check browser console for close code 4401 (token expired — log in again)

### Render service sleeping

- First request after 15 min idle takes ~30s — this is a free-tier limitation
- Consider adding an uptime monitor (UptimeRobot free tier pings every 5 minutes to keep it awake)

### Angular build fails on Vercel

- Ensure Output Directory is `dist/mploychek` — this is Angular 15 (Angular 17+ uses `/browser` suffix; this project does not)
- Check `angular.json` → `outputPath` matches

---

## Cost Summary

| Service       | Cost         | Notes                              |
|--------------|-------------|------------------------------------|
| Vercel       | $0/month    | 100 GB bandwidth, unlimited deploys|
| Render       | $0/month    | 750 hrs, sleeps when idle          |
| Neon         | $0/month    | 512 MB storage, 5 GB transfer      |
| Cloudinary   | $0/month    | 25 credits, 25 GB storage          |
| Brevo        | $0/month    | 300 emails/day                     |
| GitHub       | $0/month    | Public repo, 2000 CI mins          |
| **TOTAL**    | **$0/month**|                                    |

