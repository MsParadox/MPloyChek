# Authentication Architecture

## Token Flow

```
Login Request
    │
    ▼
POST /api/auth/login
    │
    ├── Validate userId + password (Zod — role is NOT in request body)
    ├── Look up user (userRepo.findByUserId)
    ├── bcrypt.compare(password, hash)
    ├── Issue access token (JWT, 8h)
    ├── Issue refresh token (random 128-char hex, SHA-256 hashed in DB)
    ├── Update lastLogin
    └── Audit log: LOGIN

Client stores:
  - Access token  → localStorage (mploychek_token)
  - Refresh token → localStorage (mploychek_rt)
  - User object   → localStorage (mploychek_user)
```

## Refresh Token Rotation

When the access token expires (401), the Angular JWT interceptor:
1. Sends `POST /api/auth/refresh` with the refresh token
2. Server validates the stored SHA-256 hash (never stores raw tokens)
3. Issues NEW access + refresh tokens
4. Revokes the old refresh token (rotation — prevents token reuse attacks)
5. Retries the original request with the new access token

## Logout

`POST /api/auth/logout` revokes ALL refresh tokens for the user.
This forces re-login on every device — important for security.

## Password Change

Changing password also revokes all refresh tokens (forces re-login everywhere).

## Role-Based Access Control (RBAC)

Four roles: `Admin > Manager > Verifier > General User`

The `authenticate` middleware verifies the JWT and attaches `req.user`.
The `rbac.ts` middleware checks role-based permissions before route handlers run.

See `docs/04-rbac.md` for the full permission matrix.
