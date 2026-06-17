# ============================================================
# MPloyChek — Frontend Dockerfile
# Multi-stage build: Angular build → Nginx serve
# Author: Mohit Sharma
# ============================================================

# ── Stage 1: Angular Build ───────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production

# ── Stage 2: Nginx Serve ────────────────────────────────────
FROM nginx:1.25-alpine AS production
LABEL maintainer="Mohit Sharma"

# Copy compiled Angular app
COPY --from=builder /app/dist/mploychek /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf.bak

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
