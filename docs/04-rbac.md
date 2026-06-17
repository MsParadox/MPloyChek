# MPloyChek — Role-Based Access Control (RBAC)

## Roles (hierarchy: Admin > Manager > Verifier > General User)

| Role | Description |
|------|-------------|
| **Admin** | Full platform access — user management, all data, exports, audit logs |
| **Manager** | All records and candidates — no user management |
| **Verifier** | Update record status and score — no create/delete |
| **General User** | View own records and candidate list — read-only |

---

## Permission Matrix

| Action | Admin | Manager | Verifier | General User |
|--------|:-----:|:-------:|:--------:|:------------:|
| **Users** | | | | |
| List / view users | ✅ | ❌ | ❌ | ❌ |
| Create / update users | ✅ | ❌ | ❌ | ❌ |
| Delete users | ✅ | ❌ | ❌ | ❌ |
| Change own password | ✅ | ✅ | ✅ | ✅ |
| **Records** | | | | |
| View all records | ✅ | ✅ | ✅ | Own only |
| Create records | ✅ | ✅ | ❌ | ❌ |
| Update status / score | ✅ | ✅ | ✅ | ❌ |
| Delete records | ✅ | ❌ | ❌ | ❌ |
| Export records | ✅ | ❌ | ❌ | ❌ |
| **Candidates** | | | | |
| View candidates | ✅ | ✅ | ✅ | ✅ |
| Create candidates | ✅ | ✅ | ❌ | ❌ |
| Update candidates | ✅ | ✅ | ❌ | ❌ |
| Delete / archive | ✅ | ❌ | ❌ | ❌ |
| **Documents** | | | | |
| Upload documents | ✅ | ✅ | ✅ | ❌ |
| View documents | ✅ | ✅ | ✅ | ✅ |
| Delete documents | ✅ | Owner only | Owner only | ❌ |
| **Analytics** | | | | |
| Full analytics | ✅ | ✅ | ❌ | ❌ |
| Audit logs | ✅ | ❌ | ❌ | ❌ |
| Export audit log | ✅ | ❌ | ❌ | ❌ |

---

## Implementation

RBAC is enforced in `backend/src/middleware/rbac.ts`:

```typescript
// Usage in routes:
router.get('/', authenticate, requireRole(['Admin','Manager']), handler);
router.delete('/:id', authenticate, requireAdmin, handler);
```

`authenticate` verifies the JWT and attaches `req.user` (with `role` from the token).  
`requireRole([...])` checks `req.user.role` against the allowed roles array.

Role is set **only by the server** when the JWT is issued (loaded from the database after password verification). The client never sends or influences the role.

---

## Ownership Checks

For General Users, record access is further limited by ownership:

```typescript
// records.routes.ts
if (req.user.role === 'General User' && record.ownerId !== req.user.sub) {
  return res.status(403).json({ error: 'Access denied' });
}
```

This prevents General Users from accessing other users' records even if they know the record ID.
