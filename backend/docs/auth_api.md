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
11. [Get Socket Token](#11-get-socket-token)

---

## 1. Register Admin
**Description:** Create a new administrator account.
**Business Logic:** This automatically creates a default organization for the user and assigns them the OWNER role. An OTP is generated and emailed to the user for verification.

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

---

## 2. Login Admin
**Description:** Authenticate an administrator and establish a session.
**Business Logic:** Validates the credentials, tracks the device metadata (IP, user agent), and generates a new pair of Access and Refresh tokens. The tokens are attached as HTTP-only cookies in the response.

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

---

## 3. Refresh Token
**Description:** Exchange a valid refresh token for a new access token.
**Business Logic:** Consumes the refresh token stored in the strict-scoped cookie, validates its expiration and status, and issues a fresh set of tokens to extend the active session securely.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/refresh`
- **Auth:** **Public** (Requires `refreshToken` cookie)

---

## 4. Verify Email (OTP)
**Description:** Verify the admin account using a 6-digit numeric OTP.
**Business Logic:** Compares the provided OTP against the hashed OTP in the database. If correct and not expired, it marks the account's email as verified.

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
**Description:** Request a new verification OTP.
**Business Logic:** Generates a new OTP, updates the expiration time (usually 15 minutes TTL) in the database, and sends a new verification email to the user.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/resend-verification`
- **Auth:** **Public**

---

## 6. Forgot Password
**Description:** Trigger a password reset workflow.
**Business Logic:** Validates the existence of the user, generates a secure password reset token, and sends it to the user's registered email address.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/forgot-password`
- **Auth:** **Public**

### Request Body
```json
{ "email": "admin@example.com" }
```

---

## 7. Reset Password
**Description:** Update the password using the reset token.
**Business Logic:** Verifies the cryptographic token received via email and securely hashes and saves the new password, terminating all existing sessions to enforce security.

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
**Description:** Invalidate one or all administrator sessions.
**Business Logic:** The single logout deletes the current token pair. The 'logout-all' option increments a token version flag in the database, invalidating every active session across all devices.

### Single Logout
- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/logout`
- **Auth:** **Admin**

### Logout All
- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/admin/logout-all`
- **Auth:** **Admin**

---

## 9. Get Current User (Me)
**Description:** Retrieve the full profile of the authenticated administrator.
**Business Logic:** Uses the access token to fetch the user's data, along with all their associated organizations, roles, and the currently active organizational context.

- **Method:** `GET`
- **Endpoint:** `/api/v1/auth/admin/me`
- **Auth:** **Admin**

---

## 10. Switch Organization
**Description:** Change the active organizational context for the current session.
**Business Logic:** Validates that the user belongs to the requested organization and modifies the current session state/token payload to reflect the newly active organization ID.

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

## 11. Get Socket Token
**Description:** Retrieve a token for WebSocket connections.
**Business Logic:** Generates a short-lived, signed JWT specifically designed for authenticating real-time WebSocket connections (e.g. for notifications or proctoring) for this user.

- **Method:** `GET`
- **Endpoint:** `/api/v1/auth/admin/socket-token`
- **Auth:** **Admin**

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
