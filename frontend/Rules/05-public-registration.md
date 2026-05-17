# 05 — Public Participant Registration
**Wave 4 | No admin auth required | Public-facing form**

This is the flow a participant goes through to register for a contest.  
No admin JWT is needed. This is what powers the public registration page.

The full flow has two steps:
1. **Get a contact token** — participant proves they are a real person via OTP
2. **Register** — use the contact token to register for the contest

Base path: `/api/v1`

---

## Full Registration Flow

```
Participant lands on public registration page
        │
        ▼
POST /auth/quiz/request-otp   ← participant enters their email
        │
        ▼
Participant checks email/WhatsApp for OTP
        │
        ▼
POST /auth/quiz/verify-otp    ← participant enters the 6-digit OTP
        │  returns: contactToken (JWT, ~15 min TTL)
        ▼
POST /contests/register/:contestSlug  ← participant fills registration form
        │  body includes: contactToken + profile fields
        │
        ├─── paymentEnabled: false ──► Registered immediately (REGISTERED status)
        │
        └─── paymentEnabled: true  ──► Returns Razorpay order details
                                        │
                                        ▼
                                   Payment flow (see 06-payment.md)
```

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| POST | `/auth/quiz/request-otp` | ✗ | Send OTP to email |
| POST | `/auth/quiz/verify-otp` | ✗ | Verify OTP, get contactToken |
| POST | `/contests/register/:contestSlug` | ✗ (contactToken) | Register for contest |

---

## POST `/auth/quiz/request-otp`

Participant enters their email. The backend sends a 6-digit OTP to that email (and optionally WhatsApp if phone is provided).

**Auth required:** No  
**Rate limited:** 5 OTP requests per window per IP

### Request Body

```json
{
  "email": "participant@example.com"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Valid email address |

### Response `200`

```json
{
  "success": true,
  "message": "OTP sent to your email"
}
```

> Always returns 200 regardless of whether the email is new or existing — prevents user enumeration.

### Errors

| Status | When |
|--------|------|
| 400 | Invalid email format |
| 429 | Too many OTP requests |

---

## POST `/auth/quiz/verify-otp`

Participant enters the OTP they received. On success, a short-lived `contactToken` JWT is returned. This token is required for registration.

**Auth required:** No

### Request Body

```json
{
  "email": "participant@example.com",
  "otp": "482915"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Same email used in request-otp |
| `otp` | string | 6-digit code |

### Response `200`

```json
{
  "success": true,
  "message": "OTP verified",
  "data": {
    "contactToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

| Field | Description |
|-------|-------------|
| `contactToken` | JWT valid for ~15 minutes. Pass this in the registration body. |
| `expiresIn` | Seconds until the token expires (900 = 15 minutes) |

### Errors

| Status | Code | When |
|--------|------|------|
| 400 | `INVALID_OTP` | Wrong OTP code |
| 400 | `OTP_EXPIRED` | OTP has expired (default TTL: 10 minutes) |
| 429 | — | Too many failed attempts (max 5) |

### Frontend Pattern

```ts
// Store contactToken temporarily in component state (NOT localStorage)
// It expires in 15 min — enough time to fill the registration form
const [contactToken, setContactToken] = useState<string | null>(null);

const handleOtpVerify = async (otp: string) => {
  const res = await fetch("/api/v1/auth/quiz/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp })
  });
  const data = await res.json();
  if (data.success) {
    setContactToken(data.data.contactToken);
    // Proceed to registration form step
  }
};
```

---

## POST `/contests/register/:contestSlug`

Register a participant for a contest. Requires the `contactToken` from OTP verification.  
The contact is automatically deduplicated — if this email already registered for another contest in this org, their existing contact record is reused.

**Auth required:** No (uses `contactToken` in body)

**URL Param:** `contestSlug` — from the contest's public URL (e.g. `dsa-championship-2025`)

### Request Body

```json
{
  "contactToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "participant@example.com",
  "phone": "+919876543210",
  "firstName": "Rahul",
  "lastName": "Mehta",
  "college": "IIT Bombay",
  "department": "Computer Science",
  "city": "Mumbai",
  "state": "Maharashtra"
}
```

| Field | Type | Rules | Required |
|-------|------|-------|:---:|
| `contactToken` | string | From verify-otp response | ✓ |
| `email` | string | Valid email | ✓ |
| `phone` | string | E.164 format (`+91...`) | ✗ |
| `firstName` | string | 1–100 chars | ✓ |
| `lastName` | string | Max 100 chars | ✗ |
| `college` | string | Free text | ✗ |
| `department` | string | Max 200 chars | ✗ |
| `city` | string | Max 100 chars | ✗ |
| `state` | string | Max 100 chars | ✗ |

### Response — Free Contest `201`

```json
{
  "success": true,
  "data": {
    "participantId": "01HPART...",
    "registrationRef": "QB-2025-00142",
    "status": "REGISTERED",
    "paymentRequired": false,
    "contest": {
      "title": "DSA Championship 2025",
      "startTime": "2025-06-15T10:00:00.000Z",
      "joinCode": null
    }
  }
}
```

### Response — Paid Contest `201`

```json
{
  "success": true,
  "data": {
    "participantId": "01HPART...",
    "registrationRef": "QB-2025-00142",
    "status": "PENDING_PAYMENT",
    "paymentRequired": true,
    "payment": {
      "orderId": "order_ABC123XYZ",
      "amount": 19900,
      "currency": "INR",
      "keyId": "rzp_live_xxxx"
    },
    "contest": {
      "title": "DSA Championship 2025",
      "startTime": "2025-06-15T10:00:00.000Z"
    }
  }
}
```

> When `paymentRequired: true`, immediately open the Razorpay checkout with the `payment` object. See `06-payment.md` for the full payment flow.

### Errors

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Missing required fields |
| 400 | `INVALID_TOKEN` | contactToken invalid or expired |
| 404 | `NOT_FOUND` | Contest slug not found |
| 409 | `CONFLICT` | Email already registered for this contest |
| 410 | `GONE` | Registration deadline has passed |
| 422 | `FULL` | Contest has reached `maxParticipants` |

---

## Page Architecture for Registration

The public registration page should be a **multi-step form**:

```
Step 1: Email input
  → POST /auth/quiz/request-otp
  → Show "Check your email for OTP"

Step 2: OTP input
  → POST /auth/quiz/verify-otp
  → Store contactToken in state
  → Proceed to Step 3

Step 3: Registration form
  → Fill name, phone, college, etc.
  → POST /contests/register/:contestSlug (body includes contactToken)
  → If paymentRequired: false → Show success screen
  → If paymentRequired: true → Open Razorpay modal (see 06-payment.md)

Step 4 (conditional): Payment
  → Razorpay checkout
  → POST /payments/verify on success
  → Show confirmation

Step 5: Success screen
  → Show registrationRef, startTime, and what to expect next
```

---

## Important Notes for Frontend

**Never reuse a contactToken across contests.** Each registration should start fresh with a new OTP flow — or if the token is still valid (within 15 min), the participant can use it for a different contest registration.

**Do not send the join code on the registration page.** The join code is only revealed when the participant attempts to join the quiz room on the contest start day.

**Contest slug** is the public URL-friendly identifier. Construct the registration page URL as:
```
https://your-domain.com/quiz/:contestSlug/register
```

The backend resolves the slug to the full contest object including whether payment is enabled.
