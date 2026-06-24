# MPloyChek — API Reference

> **Base URL:** `https://mploychek-api.onrender.com/api`  
> All endpoints except `/auth/login` require `Authorization: Bearer <accessToken>`.  
> Every response follows the [standard envelope](#response-format).

---

## Demo Credentials

| User ID | Password | Role | Access |
|---------|----------|------|--------|
| `admin001` | `Admin@123` | Admin | Full platform access |
| `john001` | `User@123` | Manager | Candidates + all records |
| `priya001` | `Verify@123` | Verifier | Record status updates |
| `mohit001` | `User@123` | General User | Own records only |

---

## Authentication

| Method | Endpoint | Auth | Body | Description |
|--------|----------|:----:|------|-------------|
| `POST` | `/auth/login` | ❌ | `{ userId, password }` | Returns `accessToken`, `refreshToken`, `user` |
| `POST` | `/auth/refresh` | ❌ | `{ refreshToken }` | Rotates token pair — old refresh token revoked |
| `POST` | `/auth/logout` | ✅ | — | Revokes all sessions for the current user |
| `GET`  | `/auth/me` | ✅ | — | Returns current user profile |
| `POST` | `/auth/change-password` | ✅ | `{ currentPassword, newPassword }` | Changes password + revokes all sessions |

> **Security note:** The client never sends a `role` field. Role is loaded from the database on login and embedded in the JWT by the server.

---

## Users *(Admin only)*

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET` | `/users` | Admin | List all users (paginated) |
| `GET` | `/users/stats` | Admin | Platform user statistics |
| `GET` | `/users/:id` | Admin | Get user by ID |
| `POST` | `/users` | Admin | Create a new user |
| `PATCH` | `/users/:id` | Admin or Self | Update user fields |
| `DELETE` | `/users/:id` | Admin | Delete user |

---

## Records

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET` | `/records` | All | List records — Admin/Manager see all; others see own only |
| `GET` | `/records/summary` | All | Status and type counts |
| `GET` | `/records/:id` | All | Record detail + full timeline |
| `POST` | `/records` | Admin / Manager | Create verification request |
| `PATCH` | `/records/:id` | Admin / Manager / Verifier | Update status, score, remarks |

**Status workflow:**

```
Pending → In Review → Verification Running → Approved  (terminal)
                                           → Rejected  (terminal)
                                           → On Hold → resume
Pending → Cancelled  (terminal)
```

Invalid transitions return `400` with an `allowedNext` array listing valid next states.

---

## Candidates

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET` | `/candidates` | All | List candidates (paginated) |
| `GET` | `/candidates/:id` | All | Candidate details + all associated records |
| `POST` | `/candidates` | Admin / Manager | Create candidate |
| `PATCH` | `/candidates/:id` | Admin / Manager | Update candidate |
| `DELETE` | `/candidates/:id` | Admin | Archive candidate |

---

## Documents

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/documents/upload/:candidateId` | Admin / Manager / Verifier | Upload file (`multipart/form-data`) |
| `GET` | `/documents/candidate/:candidateId` | All | List candidate's documents |
| `GET` | `/documents/:id` | All | Document metadata |
| `DELETE` | `/documents/:id` | Admin or Owner | Delete document |

**Accepted types:** PAN, Aadhaar, Passport, Resume, Degree Certificate, Experience Letter, Bank Statement, Salary Slip, Offer Letter, Relieving Letter, Character Certificate, Police Clearance, Medical Certificate, Address Proof, Other.

**Limits:** Max 10 MB · Formats: PDF, JPEG, PNG, WEBP, DOC, DOCX.

---

## Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/notifications` | All notifications for the authenticated user |
| `PATCH` | `/notifications/:id/read` | Mark one notification as read |
| `PATCH` | `/notifications/mark-all-read` | Mark all notifications read |

---

## Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/search?q=term&limit=5` | Cross-entity search across users, candidates, and records |

Results are privilege-scoped — General Users only see their own records.

---

## Analytics

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET` | `/analytics/overview` | Admin / Manager / Verifier | Dashboard stats: totals, trends, risk breakdown, monthly chart |
| `GET` | `/analytics/audit-logs` | Admin / Manager | Recent audit log entries |

---

## Export

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET` | `/export/records?format=csv\|json` | All (own data only) | Export records |
| `GET` | `/export/candidates?format=csv\|json` | Admin / Manager | Export all candidates |
| `GET` | `/export/audit-logs` | Admin / Manager | Export audit log (CSV, RFC-4180) |

---

## WebSocket

```
wss://mploychek-api.onrender.com?token=<accessToken>
```

| Event | Direction | Payload |
|-------|-----------|---------|
| Connection | Client → Server | JWT passed as query param, verified on handshake |
| `notification` | Server → Client | `{ type: 'notification', id, message, recordId }` |
| Auth failure | Server → Client | Close code `4401` |
| Heartbeat | Server → Client | `ping` every 30 s; client responds `pong` |

Dead connections (no `pong`) are auto-terminated before the next heartbeat cycle.

---

## Common Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `pageSize` | `number` | `10` | Items per page (max 100) |
| `sortBy` | `string` | varies | Field to sort by |
| `sortDir` | `asc` \| `desc` | `desc` | Sort direction |
| `status` | `string` | — | Filter by status |
| `type` | `string` | — | Filter by type |
| `delay` | `number` | `0` | Simulate latency in ms (0–10 000) — demo only |

---

## Response Format

**Success:**
```json
{
  "success": true,
  "data": {},
  "message": "optional human-readable message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "processingTime": 42
}
```

**Error:**
```json
{
  "success": false,
  "error": "descriptive error message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Validation error (400):**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [{ "field": "password", "message": "Must be at least 8 characters" }]
}
```

**Invalid workflow transition (400):**
```json
{
  "success": false,
  "error": "Invalid transition from Pending to Approved",
  "allowedNext": ["In Review", "Cancelled"]
}
```
