# MPloyChek — Authentication & Token Lifecycle

> **Strategy:** Stateless JWT access tokens + rotatable refresh tokens (stored SHA-256 hashed in PostgreSQL)

---

## Login Flow

```
Client                              Server                         Database
  │                                    │                               │
  │── POST /api/auth/login ──────────► │                               │
  │   { userId, password }             │                               │
  │                                    │── findByUserId(userId) ──────►│
  │                                    │◄─ User row ───────────────────│
  │                                    │                               │
  │                                    │── bcrypt.compare(pw, hash)    │
  │                                    │   (role NOT in request body)  │
  │                                    │                               │
  │                                    │── Generate access token (JWT) │
  │                                    │   payload: { sub, role,       │
  │                                    │              email, iat, exp} │
  │                                    │                               │
  │                                    │── Generate refresh token      │
  │                                    │   (128-char random hex)       │
  │                                    │── SHA-256 hash → store ──────►│
  │                                    │── updateLastLogin() ─────────►│
  │                                    │── AuditLog: LOGIN ───────────►│
  │                                    │                               │
  │◄─ 200 { accessToken,               │                               │
  │         refreshToken, user } ──────│                               │
  │                                    │                               │
  │  Store in localStorage:            │                               │
  │    mploychek_token  ← accessToken  │                               │
  │    mploychek_rt     ← refreshToken │                               │
  │    mploychek_user   ← user object  │                               │
```

---

## JWT Access Token

```
Header . Payload . Signature
  │          │          │
  │          │          └─ HMAC-SHA256(base64(header) + "." + base64(payload), JWT_SECRET)
  │          │
  │          └─ {
  │               "sub":   "admin001",          // user ID
  │               "role":  "Admin",             // from DB — client cannot influence this
  │               "email": "admin@example.com",
  │               "iat":   1700000000,          // issued at
  │               "exp":   1700028800           // expires in 8 hours
  │             }
  │
  └─ { "alg": "HS256", "typ": "JWT" }
```

**TTL:** 8 hours (`JWT_EXPIRES_IN=28800` seconds)

---

## Refresh Token Rotation

When the access token expires, the Angular JWT interceptor transparently handles the refresh:

```
Client                              Server                         Database
  │                                    │                               │
  │  (request fails with 401)          │                               │
  │── POST /api/auth/refresh ────────► │                               │
  │   { refreshToken }                 │                               │
  │                                    │── SHA-256(refreshToken) ─────►│
  │                                    │◄─ stored hash ────────────────│
  │                                    │   compare → valid             │
  │                                    │                               │
  │                                    │── Revoke old token ──────────►│
  │                                    │── Issue new access token      │
  │                                    │── Issue new refresh token     │
  │                                    │── Store new hash ────────────►│
  │                                    │                               │
  │◄─ 200 { accessToken,               │                               │
  │         refreshToken } ────────────│                               │
  │                                    │                               │
  │  Retry original request            │                               │
  │  with new access token             │                               │
```

**Why rotation?** Once a refresh token is used, it is immediately revoked. If an attacker captures a refresh token and tries to use it after the legitimate client has already rotated, the server detects the reuse and can invalidate all sessions for the user.

**TTL:** 7 days (`RT_EXPIRES_DAYS=7`)

---

## Logout

`POST /api/auth/logout` revokes **all** refresh tokens for the authenticated user — every device and browser is logged out simultaneously.

---

## Password Change

`POST /api/auth/change-password` changes the password hash and revokes all refresh tokens. The user must re-authenticate on every device.

---

## JWT Interceptor (Angular)

The `JwtInterceptor` in `frontend/src/app/core/interceptors/jwt.interceptor.ts` automatically:

1. Attaches `Authorization: Bearer <token>` to every outbound HTTP request
2. On receiving a `401` response:
   - Calls `POST /auth/refresh` with the stored refresh token
   - If refresh succeeds: updates stored tokens, retries the original request
   - If refresh fails (expired, revoked): logs the user out and redirects to `/auth/login`

All in-flight requests are queued while a refresh is in progress to avoid parallel refresh race conditions.

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Token theft from localStorage | Short 8h access token TTL limits exposure window |
| Refresh token reuse | Rotation: each use revokes the old token immediately |
| Brute-force login | `express-rate-limit`: 10 attempts per IP per 15 minutes |
| DB compromise leaking tokens | Refresh tokens stored as SHA-256 hashes — raw tokens never persisted |
| Role elevation | `role` is read from DB on login, embedded in JWT by server — client cannot send a role |
| Session hijacking | All sessions revocable: password change or logout invalidates all refresh tokens |
| WebSocket impersonation | JWT verified on WS handshake; close code `4401` on failure — no plain `?userId=` accepted |

---

## Role-Based Access Control

Four roles control access at the middleware boundary:

```
Admin > Manager > Verifier > General User
```

See [`docs/04-rbac.md`](./04-rbac.md) for the full permission matrix and implementation details.
