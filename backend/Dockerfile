# ============================================================
# MPloyChek v4.0 — Backend Dockerfile
# Multi-stage: Build TypeScript → Production Node image
# FIX: Added prisma schema copy + prisma generate step
# Author: Mohit Sharma
# ============================================================

# ── Stage 1: Builder ────────────────────────────────────────
FROM node:18-alpine AS builder
LABEL maintainer="Mohit Sharma"
WORKDIR /app

# Copy dependency files first (layer caching)
COPY package*.json ./
COPY tsconfig.json ./
# FIX: Copy prisma schema BEFORE npm install so prisma generate works
COPY prisma ./prisma

# Install all deps (including devDeps for build)
RUN npm ci

# FIX: Generate Prisma Client with schema available
RUN npx prisma generate

# Copy source and compile TypeScript
COPY src ./src
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────
FROM node:18-alpine AS production
WORKDIR /app

# Security: run as non-root
RUN addgroup -S mploychek && adduser -S mploychek -G mploychek

# Copy only what's needed for production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
# FIX: Copy prisma to allow runtime migrations (prisma migrate deploy)
COPY --from=builder /app/prisma ./prisma

# Create upload directory for local file storage (used when Cloudinary not configured)
RUN mkdir -p /app/uploads && chown -R mploychek:mploychek /app

USER mploychek

EXPOSE 3000

# Run migrations then start (safe to run migrate deploy on every boot — it's idempotent)

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Run migrations then start server
CMD sh -c "npx prisma migrate deploy && node dist/index.js"
