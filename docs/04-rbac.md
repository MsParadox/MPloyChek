# MPloyChek — Role-Based Access Control (RBAC)

> **Hierarchy:** `Admin > Manager > Verifier > General User`  
> Role is embedded in the JWT by the server on login — the client can never influence it.

---

## Role Descriptions

| Role | Description |
|------|-------------|
| **Admin** | Full platform access — user management, all records and candidates, analytics, audit logs, exports |
| **Manager** | All records and candidates, analytics overview — no user management |
| **Verifier** | Can update record status and score on assigned records — no create or delete |
| **General User** | Read-only access to own records and the candidate list |

---

## Permission Matrix

| Action | Admin | Manager | Verifier | General User |
|--------|:-----:|:-------:|:--------:|:------------:|
| **Users** | | | | |
| List / view all users | ✅ | ❌ | ❌ | ❌ |
| Create user | ✅ | ❌ | ❌ | ❌ |
| Update any user | ✅ | ❌ | ❌ | ❌ |
| Delete user | ✅ | ❌ | ❌ | ❌ |
| Update own profile | ✅ | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ | ✅ |
| **Records** | | | | |
| View all records | ✅ | ✅ | ✅ | Own only |
| Create records | ✅ | ✅ | ❌ | ❌ |
| Update status / score | ✅ | ✅ | ✅ | ❌ |
| Delete records | ✅ | ❌ | ❌ | ❌ |
| Export records (CSV/JSON) | ✅ | ❌ | ❌ | ✅ (own) |
| **Candidates** | | | | |
| View candidates | ✅ | ✅ | ✅ | ✅ |
| Create candidates | ✅ | ✅ | ❌ | ❌ |
| Update candidates | ✅ | ✅ | ❌ | ❌ |
| Delete / archive | ✅ | ❌ | ❌ | ❌ |
| Export candidates (CSV/JSON) | ✅ | ✅ | ❌ | ❌ |
| **Documents** | | | | |
| Upload documents | ✅ | ✅ | ✅ | ❌ |
| View documents | ✅ | ✅ | ✅ | ✅ |
| Delete documents | ✅ | Owner only | Owner only | ❌ |
| **Analytics & Audit** | | | | |
| Analytics overview | ✅ | ✅ | ✅ | ❌ |
| Audit logs (view) | ✅ | ✅ | ❌ | ❌ |
| Export audit log | ✅ | ❌ | ❌ | ❌ |
| **Search** | | | | |
| Global search | ✅ (all) | ✅ (all) | ✅ (all) | ✅ (own only) |

---

## Implementation

RBAC is enforced in `backend/src/middleware/rbac.ts`:

```typescript
// Granular role check — pass an array of allowed roles
router.get('/users', authenticate, requireRole(['Admin']), handler);

// Admin-only shorthand
router.delete('/users/:id', authenticate, requireAdmin, handler);

// Multi-role
router.get('/analytics/overview', authenticate, requireRole(['Admin', 'Manager', 'Verifier']), handler);
```

`authenticate` verifies the JWT and attaches `req.user`:
```typescript
interface AuthUser {
  sub:   string;   // userId
  role:  string;   // 'Admin' | 'Manager' | 'Verifier' | 'General User'
  email: string;
}
```

`requireRole(allowed)` checks `req.user.role` against the allowed list — returns `403` immediately if not matched.

---

## Ownership Enforcement

For General Users, access to records is further restricted by ownership beyond the RBAC role check:

```typescript
// In records.routes.ts — after RBAC passes:
if (req.user.role === 'General User' && record.ownerId !== req.user.sub) {
  return res.status(403).json({ success: false, error: 'Access denied' });
}
```

This prevents a General User from accessing another user's records even if they know the record ID.

The same pattern applies to document deletion — only the uploader or an Admin can delete a document:

```typescript
if (req.user.role !== 'Admin' && document.uploadedById !== req.user.sub) {
  return res.status(403).json({ success: false, error: 'Access denied' });
}
```

---

## Role Assignment

Roles are **set only by an Admin** when creating or updating a user account. A user can never self-assign or escalate their own role:

- The `role` field is stripped from the request body on all auth endpoints (Zod schema excludes it)
- On login, role is read fresh from the database and embedded in the JWT by the server
- A Zod schema test explicitly verifies the `role` field is absent from login schema output

```typescript
// From schemas/index.test.ts
const r = loginSchema.safeParse({ userId: 'admin001', password: 'Admin@123', role: 'Admin' });
expect(r.data).not.toHaveProperty('role'); // role is stripped — security invariant
```
