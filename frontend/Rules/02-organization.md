# 02 — Organization Management
**Wave 2 | Depends on: Wave 1 (login)**

All organization routes require the admin to be authenticated.  
The `organizationId` comes from `GET /auth/admin/me → data.activeOrg.id` after login.

Base path: `/api/v1/org`

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| GET | `/org/:orgId` | ✓ | Get org profile + member count |
| PATCH | `/org/:orgId` | ✓ OWNER | Update org name, logo, website |
| GET | `/org/:orgId/members` | ✓ | List all members |
| POST | `/org/:orgId/members/invite` | ✓ OWNER/ADMIN | Invite admin by email |
| PATCH | `/org/:orgId/members/:memberId/role` | ✓ OWNER | Change member role |
| DELETE | `/org/:orgId/members/:memberId` | ✓ OWNER | Remove member |
| POST | `/org/invite/accept` | ✗ | Accept invite token (from email) |

---

## GET `/org/:orgId`

Load the organization details for the settings page or dashboard header.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "01HORG...",
    "name": "QuizBuzz Ltd",
    "slug": "quizbuzz-ltd",
    "logoUrl": "https://cdn.example.com/logo.png",
    "website": "https://quizbuzz.com",
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "members": [
      {
        "id": "01HMEM...",
        "adminId": "01HADM...",
        "role": "OWNER",
        "admin": {
          "email": "owner@company.com",
          "firstName": "Ayush",
          "lastName": "Shah"
        }
      }
    ],
    "_count": { "members": 3, "contests": 12 }
  }
}
```

---

## PATCH `/org/:orgId`

Update the organization profile. Only `OWNER` role can do this.

**Auth required:** ✓ (OWNER role)

### Request Body (all fields optional)

```json
{
  "name": "New Company Name",
  "logoUrl": "https://cdn.example.com/new-logo.png",
  "website": "https://newsite.com"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `name` | string? | 2–100 chars |
| `logoUrl` | string? | Valid URL |
| `website` | string? | Valid URL |

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "01HORG...",
    "name": "New Company Name",
    "slug": "quizbuzz-ltd",
    "logoUrl": "https://cdn.example.com/new-logo.png",
    "website": "https://newsite.com"
  }
}
```

---

## GET `/org/:orgId/members`

List all members of the organization for the team settings page.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": [
    {
      "id": "01HMEM...",
      "adminId": "01HADM...",
      "role": "OWNER",
      "invitedAt": "2024-01-15T10:00:00.000Z",
      "acceptedAt": "2024-01-15T10:05:00.000Z",
      "isActive": true,
      "admin": {
        "email": "owner@company.com",
        "firstName": "Ayush",
        "lastName": "Shah",
        "avatarUrl": null
      }
    },
    {
      "id": "01HMEM2...",
      "adminId": "01HADM2...",
      "role": "ADMIN",
      "invitedAt": "2024-02-01T09:00:00.000Z",
      "acceptedAt": null,
      "isActive": false,
      "admin": {
        "email": "teammate@company.com",
        "firstName": "Riya",
        "lastName": "Patel",
        "avatarUrl": null
      }
    }
  ]
}
```

> `acceptedAt: null` means the invite is pending. Show a "Pending" badge on the UI.

---

## POST `/org/:orgId/members/invite`

Send an invite email to another admin. If the email is already registered, they get an org-invite email. If not, they first need to register.

**Auth required:** ✓ (OWNER or ADMIN role)

### Request Body

```json
{
  "email": "colleague@company.com",
  "role": "ADMIN"
}
```

| Field | Type | Options |
|-------|------|---------|
| `email` | string | Valid email |
| `role` | string | `OWNER`, `ADMIN`, `VIEWER` |

### Response `201`

```json
{
  "success": true,
  "data": {
    "memberId": "01HMEM3...",
    "email": "colleague@company.com",
    "role": "ADMIN",
    "message": "Invite sent. The admin will receive an email with a link to join."
  }
}
```

### Errors

| Status | When |
|--------|------|
| 409 | Email is already a member |
| 403 | Caller does not have permission to invite at this role level |

---

## POST `/org/invite/accept`

Called when an invited admin clicks the link in their invite email. The link contains a `token` query parameter which the frontend passes in the request body.

**Auth required:** No (public endpoint)

### Request Body

```json
{
  "token": "eyJ..."
}
```

### Response `200`

```json
{
  "success": true,
  "message": "You have successfully joined the organization. Please log in to continue."
}
```

After this call succeeds, redirect the user to `/login`.

---

## PATCH `/org/:orgId/members/:memberId/role`

Change a member's role. Only OWNER can change roles.

**Auth required:** ✓ (OWNER role)

### Request Body

```json
{
  "role": "VIEWER"
}
```

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "01HMEM2...",
    "role": "VIEWER",
    "adminId": "01HADM2..."
  }
}
```

---

## DELETE `/org/:orgId/members/:memberId`

Remove a member from the organization. The admin's account is not deleted — they just lose access to this org.

**Auth required:** ✓ (OWNER role)

### Response `200`

```json
{
  "success": true,
  "message": "Member removed from the organization"
}
```

### Errors

| Status | When |
|--------|------|
| 400 | Cannot remove yourself (the OWNER) |
| 404 | Member not found in this org |

---

## Role Reference

| Role | Can Do |
|------|--------|
| `OWNER` | Everything — billing, delete org, manage all admins |
| `ADMIN` | Create/manage contests, view analytics, invite members |
| `VIEWER` | Read-only — view analytics and participants |

Show/hide UI actions based on `activeOrg.role` from the login response or `/me`.
