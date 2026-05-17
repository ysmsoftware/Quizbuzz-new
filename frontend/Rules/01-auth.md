# 01 — Admin Authentication
**Wave 1 | No dependencies | Start here**

All admin authentication endpoints live under `/api/v1/auth/admin`.  
Tokens are managed as **httpOnly cookies** — the frontend never reads or stores them manually.  
Rate limited: 10 attempts per window per IP.

---

## Endpoints at a Glance

| Method | Path | Auth Required | Description |
|--------|------|:---:|-------------|
| POST | `/auth/admin/register` | ✗ | Create account + org |
| POST | `/auth/admin/login` | ✗ | Login, sets cookies |
| POST | `/auth/admin/refresh` | ✗ (cookie) | Refresh access token |
| POST | `/auth/admin/verify-email` | ✗ | Verify email with token |
| POST | `/auth/admin/forgot-password` | ✗ | Request password reset |
| POST | `/auth/admin/reset-password` | ✗ | Reset password with token |
| GET | `/auth/admin/me` | ✓ | Get current admin profile |
| POST | `/auth/admin/logout` | ✓ | Logout current device |
| POST | `/auth/admin/logout-all` | ✓ | Logout all devices |
| POST | `/auth/admin/switch-org` | ✓ | Switch active organization |

---

## POST `/auth/admin/register`

Creates a new admin account and a new organization automatically.  
After registration, a verification email is sent. The admin cannot access protected routes until `emailVerified: true`.

**Auth required:** No

### Request Body

```json
{
  "email": "admin@company.com",
  "password": "SecurePass1",
  "firstName": "Ayush",
  "lastName": "Shah"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Valid email, lowercased |
| `password` | string | Min 8 chars, 1 uppercase, 1 lowercase, 1 number |
| `firstName` | string | 1–50 chars |
| `lastName` | string | 1–50 chars |

### Response `201`

```json
{
  "success": true,
  "message": "Account created. Please verify your email",
  "data": {
    "adminId": "01HXYZ...",
    "email": "admin@company.com",
    "firstName": "Ayush",
    "emailVerified": false,
    "organization": {
      "id": "01HORG...",
      "name": "Ayush's Organization",
      "slug": "ayushs-organization"
    }
  },
  "requestId": "req-abc123"
}
```

### Errors

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Missing/invalid fields |
| 409 | `CONFLICT` | Email already registered |
| 429 | — | Rate limit exceeded |

---

## POST `/auth/admin/login`

Validates credentials, sets `accessToken` and `refreshToken` as httpOnly cookies.

**Auth required:** No

### Request Body

```json
{
  "email": "admin@company.com",
  "password": "SecurePass1"
}
```

### Response `200`

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "admin": {
      "id": "01HXYZ...",
      "email": "admin@company.com",
      "firstName": "Ayush",
      "lastName": "Shah",
      "avatarUrl": null,
      "emailVerified": true
    },
    "activeOrganization": {
      "id": "01HORG...",
      "name": "Company Name",
      "slug": "company-name",
      "role": "OWNER"
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ..."
    }
  }
}
```

> **Note:** `tokens` in the body is informational — the actual auth happens via cookies set by the server. Do not manually store `tokens.accessToken`.

### Cookies Set

| Cookie | Path | Purpose |
|--------|------|---------|
| `accessToken` | `/` | Short-lived access token (httpOnly, Secure in prod) |
| `refreshToken` | `/api/v1/auth/admin/refresh` | Long-lived refresh token (httpOnly, path-scoped) |

### Errors

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Missing fields |
| 401 | `UNAUTHORIZED` | Wrong email or password |
| 403 | `FORBIDDEN` | Email not verified |
| 429 | — | Rate limit exceeded |

---

## POST `/auth/admin/refresh`

Rotates the access token using the `refreshToken` cookie. Call this when any protected request returns `401`.

**Auth required:** No (uses `refreshToken` cookie automatically)

### Request Body

None. The refresh token is read from the cookie automatically.

### Response `200`

```json
{
  "success": true,
  "message": "Token refreshed",
  "requestId": "req-abc123"
}
```

New cookies are set on success. Previous tokens are revoked.

### Errors

| Status | When |
|--------|------|
| 401 | No refresh token cookie, expired, or revoked |

### Frontend Pattern

```ts
async function apiFetch(url: string, options = {}) {
  let res = await fetch(url, { ...options, credentials: "include" });

  if (res.status === 401) {
    // Try to refresh
    const refresh = await fetch("/api/v1/auth/admin/refresh", {
      method: "POST",
      credentials: "include"
    });
    if (refresh.ok) {
      // Retry original request
      res = await fetch(url, { ...options, credentials: "include" });
    } else {
      // Refresh failed — redirect to login
      window.location.href = "/login";
    }
  }
  return res;
}
```

---

## POST `/auth/admin/verify-email`

Called when the admin clicks the verification link in their email. The link contains a `token` query parameter.

**Auth required:** No

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
  "message": "Email verified successfully"
}
```

### Errors

| Status | When |
|--------|------|
| 400 | Token missing or expired |

---

## POST `/auth/admin/forgot-password`

Sends a password reset email. Always returns `200` regardless of whether the email exists (prevents user enumeration).

**Auth required:** No

### Request Body

```json
{
  "email": "admin@company.com"
}
```

### Response `200`

```json
{
  "success": true,
  "message": "If that email exists, a reset link has been sent"
}
```

---

## POST `/auth/admin/reset-password`

Resets the password using the token from the reset email.

**Auth required:** No

### Request Body

```json
{
  "token": "eyJ...",
  "newPassword": "NewSecurePass1"
}
```

### Response `200`

```json
{
  "success": true,
  "message": "Password reset successful. Please login"
}
```

### Errors

| Status | When |
|--------|------|
| 400 | Token invalid/expired or password too weak |

---

## GET `/auth/admin/me`

Returns the authenticated admin's full profile including all org memberships.  
Use this to populate the dashboard header and org switcher on first load.

**Auth required:** ✓ (`accessToken` cookie)

### Request Body

None.

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "01HXYZ...",
    "email": "admin@company.com",
    "firstName": "Ayush",
    "lastName": "Shah",
    "avatarUrl": null,
    "emailVerified": true,
    "organizations": [
      {
        "id": "01HORG...",
        "name": "Company A",
        "slug": "company-a",
        "role": "OWNER"
      },
      {
        "id": "01HORG2...",
        "name": "Company B",
        "slug": "company-b",
        "role": "ADMIN"
      }
    ]
  }
}
```

---

## POST `/auth/admin/logout`

Revokes the current device's refresh token. Clears both cookies.

**Auth required:** ✓

### Request Body

None.

### Response `200`

```json
{
  "success": true,
  "message": "Logged out"
}
```

---

## POST `/auth/admin/logout-all`

Revokes all refresh tokens for this admin across all devices.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "message": "Logged out from all devices"
}
```

---

## POST `/auth/admin/switch-org`

Issues new tokens scoped to a different organization. Useful when an admin belongs to multiple orgs.

**Auth required:** ✓

### Request Body

```json
{
  "organizationId": "01HORG2..."
}
```

### Response `200`

```json
{
  "success": true,
  "message": "Switched to organization",
  "data": {
    "organization": {
      "id": "01HORG2...",
      "name": "Company B",
      "slug": "company-b"
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ..."
    }
  }
}
```

New cookies are set. Old tokens are revoked.

### Errors

| Status | When |
|--------|------|
| 403 | Admin is not a member of the requested org |

---

## Frontend State After Login

Store in your global state manager (Zustand, Redux, Context):

```ts
interface AuthState {
  admin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    emailVerified: boolean;
  };
  activeOrg: {
    id: string;
    name: string;
    slug: string;
    role: "OWNER" | "ADMIN" | "VIEWER";
  };
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
}
```

Persist `admin` and `activeOrg` to `sessionStorage` to survive page refreshes. Never persist token strings.
