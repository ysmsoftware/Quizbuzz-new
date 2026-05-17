# 17 — Error Reference & Frontend HTTP Client
**Reference document — applies to all waves**

---

## Standard Error Response Shape

Every error from the API follows this exact shape. Never parse error messages as strings — always check `error.code`.

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Contest not found",
    "details": {}
  },
  "requestId": "req-abc123xyz"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `false` on errors |
| `error.code` | string | Machine-readable error code (see table below) |
| `error.message` | string | Human-readable message — safe to display |
| `error.details` | object | Validation errors or extra context |
| `requestId` | string | Include this in bug reports |

---

## Error Codes Reference

| HTTP Status | Code | Meaning | Frontend Action |
|:---:|------|---------|----------------|
| 400 | `VALIDATION_ERROR` | Request body failed Zod validation | Show field-level errors from `error.details` |
| 400 | `INVALID_OTP` | Wrong OTP entered | Show "Invalid code" message |
| 400 | `OTP_EXPIRED` | OTP has expired | Show "Code expired, request a new one" |
| 400 | `INVALID_TOKEN` | JWT token invalid or expired | Re-run auth flow from start |
| 400 | `INVALID_SIGNATURE` | Razorpay signature mismatch | Show payment error, offer retry |
| 400 | `PAYMENT_PENDING` | Payment not completed | Show payment prompt |
| 400 | `INVALID_JOIN_CODE` | Wrong join code | Show "Invalid code" |
| 400 | `ALREADY_PROCESSED` | Idempotent — already done | Treat as success |
| 401 | `UNAUTHORIZED` | No valid access token | Redirect to `/login` |
| 403 | `FORBIDDEN` | Authenticated but no permission | Show permission error, do not redirect |
| 403 | `EMAIL_NOT_VERIFIED` | Admin email not verified | Show verify email prompt |
| 403 | `DISQUALIFIED` | Participant disqualified | Show disqualified screen |
| 404 | `NOT_FOUND` | Resource does not exist | Show 404 UI |
| 409 | `CONFLICT` | Duplicate resource | Show "already exists" message |
| 409 | `SESSION_EXISTS` | Active session on another device | Show "active on another device" warning |
| 410 | `GONE` | Registration deadline passed | Show "Registration closed" |
| 422 | `FULL` | Contest at max capacity | Show "Contest is full" |
| 429 | `RATE_LIMITED` | Too many requests | Show "Too many attempts, try again in X minutes" |
| 500 | `INTERNAL_ERROR` | Unexpected server error | Show generic error + `requestId` |

---

## Validation Error Shape

When `code === "VALIDATION_ERROR"`, the `details` field contains field-level errors:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": ["Invalid email address"],
      "password": ["Password must be at least 8 characters", "Must contain an uppercase letter"],
      "firstName": ["Required"]
    }
  }
}
```

Use `error.details` to set field errors in your form library (React Hook Form, Formik, etc.).

---

## Production-Grade Frontend HTTP Client

Copy this into `src/lib/api-client.ts` in your frontend:

```ts
// src/lib/api-client.ts

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  requestId?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  requestId?: string;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
    public readonly requestId?: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

let isRefreshing = false;
let refreshQueue: Array<() => void> = [];

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/admin/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<ApiResponse<T>> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  // Handle 401 — try to refresh once
  if (res.status === 401 && retry) {
    if (isRefreshing) {
      // Wait for the ongoing refresh to complete
      await new Promise<void>((resolve) => refreshQueue.push(resolve));
      return apiFetch<T>(path, options, false);
    }

    isRefreshing = true;
    const success = await refreshToken();
    isRefreshing = false;

    // Resume all queued requests
    refreshQueue.forEach((resolve) => resolve());
    refreshQueue = [];

    if (success) {
      return apiFetch<T>(path, options, false);
    } else {
      // Refresh failed — redirect to login
      window.location.href = "/login";
      throw new ApiRequestError("UNAUTHORIZED", "Session expired. Please log in again.", undefined, undefined, 401);
    }
  }

  const data = await res.json() as ApiResponse<T> | ApiError;

  if (!data.success) {
    const err = (data as ApiError).error;
    throw new ApiRequestError(
      err.code,
      err.message,
      err.details,
      (data as ApiError).requestId,
      res.status
    );
  }

  return data as ApiResponse<T>;
}

// Convenience methods
export const api = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    apiFetch<T>(path, { method: "GET", headers }),

  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    apiFetch<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    }),

  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: "DELETE" }),

  postIdempotent: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    apiFetch<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    }),
};
```

---

## Usage Examples

```ts
// Login
import { api, ApiRequestError } from "@/lib/api-client";

try {
  const res = await api.post<LoginResponse>("/auth/admin/login", { email, password });
  store.setAuth(res.data);
} catch (err) {
  if (err instanceof ApiRequestError) {
    if (err.code === "VALIDATION_ERROR") {
      form.setErrors(err.details ?? {});
    } else {
      toast.error(err.message);
    }
  }
}

// Get contest list
const res = await api.get<ContestListResponse>("/contests?status=LIVE&page=1&limit=20");
setContests(res.data.data);

// Payment verify with idempotency key
const res = await api.postIdempotent<PaymentVerifyResponse>(
  "/payments/verify",
  { razorpayOrderId, razorpayPaymentId, razorpaySignature, participantId },
  razorpayOrderId   // use orderId as the idempotency key
);
```

---

## Environment Variables for Frontend

```env
VITE_API_URL=https://api.your-domain.com/api/v1
VITE_WS_URL=wss://api.your-domain.com
VITE_RAZORPAY_KEY_ID=rzp_live_xxxx
```

Never expose `RAZORPAY_KEY_SECRET` to the frontend. The `keyId` is safe to be public — it identifies your Razorpay account to their checkout SDK.
