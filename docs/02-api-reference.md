# MPloyChek — API Reference

**Base URL:** `https://mploychek-api.onrender.com/api`  
**Auth:** All endpoints except `/auth/login` require `Authorization: Bearer <token>`

---

## Authentication

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | `{userId, password}` | Login — returns `accessToken`, `refreshToken`, `user` |
| POST | `/auth/refresh` | `{refreshToken}` | Rotate refresh token — returns new token pair |
| POST | `/auth/logout` | — | Revoke all sessions for current user |
| GET  | `/auth/me` | — | Current user profile |
| POST | `/auth/change-password` | `{currentPassword, newPassword}` | Change password + revoke all sessions |

> **Role note:** `role` is never sent by the client. It is loaded from the database on login and embedded in the JWT by the server.

---

## Users *(Admin only)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List all users (paginated) |
| GET | `/users/stats` | User count by role / status |
| GET | `/users/:id` | Get user by ID |
| POST | `/users` | Create user |
| PATCH | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |

---

## Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/records` | List records (paginated, filterable) |
| GET | `/records/summary` | Status / type summary counts |
| GET | `/records/:id` | Record detail with timeline |
| POST | `/records` | Create verification request |
| PATCH | `/records/:id` | Update status / score / remarks |

**Status workflow:**
```
Pending → In Review → Verification Running → Approved / Rejected / Failed
                                           → On Hold → resume
```

---

## Candidates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates` | List candidates (paginated) |
| GET | `/candidates/:id` | Candidate + all records |
| POST | `/candidates` | Create candidate |
| PATCH | `/candidates/:id` | Update candidate |
| DELETE | `/candidates/:id` | Archive candidate |

---

## Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/documents/upload/:candidateId` | Upload file (multipart/form-data) |
| GET  | `/documents/candidate/:candidateId` | List candidate's documents |
| GET  | `/documents/:id` | Document metadata |
| DELETE | `/documents/:id` | Delete document |

Accepted types: PAN, Aadhaar, Passport, Resume, Degree Certificate, Experience Letter (and 10 more).

---

## Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | All notifications for current user |
| PATCH | `/notifications/:id/read` | Mark one read |
| PATCH | `/notifications/mark-all-read` | Mark all read |

---

## Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search?q=term&limit=5` | Cross-entity search (users + candidates + records) |

---

## Analytics *(Admin / Manager / Verifier)*

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/analytics/overview` | Admin / Manager / Verifier | Full dashboard stats, trends, risk breakdown |
| GET | `/analytics/audit-logs` | Admin / Manager | Recent audit log entries |

---

## Export

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/export/records?format=csv\|json` | Any user (scoped to own records) | Export records |
| GET | `/export/candidates?format=csv\|json` | Admin / Manager | Export all candidates |
| GET | `/export/audit-logs` | Admin / Manager | Export audit log (CSV) |

---

## WebSocket

```
wss://mploychek-api.onrender.com?token=<JWT>
```

- Connection authenticated with JWT on handshake (code 4401 = auth failure)
- Server pushes `{ type: 'notification', ... }` events on status changes
- Heartbeat every 30s — dead connections auto-terminated
- Re-connects automatically on drop (except 4401)

---

## Common Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 10, max: 100) |
| `sortBy` | string | Field to sort by |
| `sortDir` | `asc` \| `desc` | Sort direction (default: desc) |
| `status` | string | Filter by status |
| `type` | string | Filter by type |
| `delay` | ms | Simulate API latency for demo (0–10000) |

---

## Response Envelope

All responses follow this shape:

```json
{
  "success": true,
  "data": {},
  "message": "optional",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "processingTime": 42
}
```

Error responses:
```json
{
  "success": false,
  "error": "descriptive message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```
