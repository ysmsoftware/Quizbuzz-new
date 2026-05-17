# 🔐 Admin Authentication API Documentation

This guide provides exhaustive details for the QuizBuzz Admin Identity and Access Management (IAM) system.

---

## 🛡️ Security Architecture

QuizBuzz uses a dual-token system for maximum security:
1.  **Access Token**: A short-lived JWT stored in an `httpOnly`, `secure` cookie. It must be included in the header for all protected routes as `Authorization: Bearer <TOKEN>`.
2.  **Refresh Token**: A long-lived token stored in an `httpOnly`, `secure` cookie, scoped strictly to the `/api/v1/auth/admin/refresh` path.

### Key Implementation Details:
- **CSRF Protection**: Tokens are delivered via `httpOnly` cookies to prevent XSS-based token theft.
- **Device Tracking**: Every login/refresh records the `ipAddress` and `userAgent` for security auditing.
- **Rate Limiting**: Auth routes are protected by a strict rate limiter (defined in `middlewares/rate-limit.ts`).

---

## 📑 Table of Contents
1. [Register Admin](#1-register-admin)
2. [Login Admin](#2-login-admin)
3. [Refresh Token](#3-refresh-token)
4. [Verify Email (OTP)](#4-verify-email-otp)
5. [Resend Verification](#5-resend-verification)
6. [Forgot Password](#6-forgot-password)
7. [Reset Password](#7-reset-password)
8. [Logout (Single & All)](#8-logout-single--all)
9. [Get Current User (Me)](#9-get-current-user-me)
10. [Switch Organization](#10-switch-organization)

---

## 1. Register Admin
Create a new administrator account. This automatically creates a default organization for the user.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/register`
- **Auth:** **Public**

### Request Body
| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | Must be a valid email format. |
| `password` | `string` | Yes | 8-100 chars, 1 uppercase, 1 lowercase, 1 number. |
| `firstName` | `string` | Yes | 2-50 characters. |
| `lastName` | `string` | Yes | 2-50 characters. |

### Expected Response (201 Created)
```json
{
  "success": true,
  "message": "Account created. Please verify your email",
  "data": {
    "id": "user_01H2...",
    "email": "admin@example.com",
    "isEmailVerified": false
  },
  "requestId": "req_..."
}
```

---

## 2. Login Admin
Authenticate and establish a session. Sets `accessToken` and `refreshToken` cookies.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/login`
- **Auth:** **Public**

### Request Body
```json
{
  "email": "admin@example.com",
  "password": "SecurePassword123!"
}
```

### Expected Response (200 OK)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_...",
      "email": "admin@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "tokens": {
      "accessToken": "ey...",
      "refreshToken": "ey..."
    },
    "currentOrganization": {
      "id": "org_...",
      "name": "John's Org",
      "role": "OWNER"
    }
  }
}
```

---

## 3. Refresh Token
Exchange a refresh token for a new access token.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/refresh`
- **Auth:** **Public** (Requires `refreshToken` cookie)

### Expected Response (200 OK)
```json
{
  "success": true,
  "message": "Token refreshed",
  "requestId": "req_..."
}
```
*Note: The new tokens are automatically updated in the browser/Postman cookies.*

---

## 4. Verify Email (OTP)
Verify the account using the 6-digit numeric OTP sent via email.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/verify-email`
- **Auth:** **Public**

### Request Body
```json
{
  "email": "admin@example.com",
  "otp": "452891"
}
```

---

## 5. Resend Verification
Request a new OTP if the original expired (15-minute TTL).

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/resend-verification`
- **Auth:** **Public**

---

## 6. Forgot Password
Trigger a password reset workflow.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/forgot-password`
- **Auth:** **Public**

### Request Body
```json
{ "email": "admin@example.com" }
```

---

## 7. Reset Password
Update the password using the token received in the reset email.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/reset-password`
- **Auth:** **Public**

### Request Body
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePassword456!"
}
```

---

## 8. Logout (Single & All)

### Single Logout
Invalidates the current session and clears local cookies.
- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/logout`
- **Auth:** **Admin**

### Logout All
Invalidates all sessions across all devices (Security reset).
- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/logout-all`
- **Auth:** **Admin**

---

## 9. Get Current User (Me)
Retrieve the full profile of the authenticated administrator.

- **Method:** `GET`
- **Endpoint:** `/api/v1/auth/admin/me`
- **Auth:** **Admin**

### Expected Response
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "organizations": [
      { "id": "org_1", "name": "Org A", "role": "OWNER" },
      { "id": "org_2", "name": "Org B", "role": "ADMIN" }
    ],
    "activeOrganizationId": "org_1"
  }
}
```

---

## 10. Switch Organization
Change the active organizational context for the current session.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/switch-org`
- **Auth:** **Admin**

### Request Body
```json
{
  "organizationId": "org_01H3..."
}
```

---

## ⚠️ Common Error Patterns

### 400 Bad Request (Validation Error)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "path": ["password"],
      "message": "String must contain at least 1 uppercase character"
    }
  ],
  "requestId": "req_..."
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required",
  "requestId": "req_..."
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Email not verified",
  "requestId": "req_..."
}
```
