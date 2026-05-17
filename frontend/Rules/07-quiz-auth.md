# 07 — Quiz Authentication (Participant Side)
**Wave 6 | Depends on: Wave 4 (registration), Wave 5 (payment complete)**

Before a participant can connect to the WebSocket quiz room, they must complete a two-step identity verification. This produces a short-lived `socketToken` which is the credential for the WebSocket handshake.

Base path: `/api/v1/auth/quiz`

---

## Full Quiz Entry Flow

```
Contest day arrives. Participant navigates to the quiz join URL:
https://your-domain.com/quiz/:contestSlug/join

        │
        ▼
Step 1: POST /auth/quiz/authenticate
        Participant enters: email + registrationRef
        Returns: participantId + whether joinCode is required
        │
        ▼
Step 2a (if joinCode required):
        POST /auth/quiz/verify-join-code
        Participant enters the join code shown by admin
        Returns: sessionToken (intermediate)
        │
Step 2b (if OTP path is used instead):
        POST /auth/quiz/request-otp  (same as registration OTP)
        POST /auth/quiz/verify-otp
        │
        ▼
Step 3: POST /auth/quiz/create-session
        Exchange sessionToken for a socketToken
        Returns: socketToken (short-lived, ~2h)
        │
        ▼
Step 4: Connect to Socket.IO
        Pass socketToken in handshake auth
        (see 08-websocket-quiz.md)
```

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| POST | `/auth/quiz/authenticate` | ✗ | Verify identity (email + ref) |
| POST | `/auth/quiz/verify-join-code` | ✗ | Verify the join code |
| POST | `/auth/quiz/request-otp` | ✗ | Send OTP (if join-code flow not used) |
| POST | `/auth/quiz/verify-otp` | ✗ | Verify OTP, get session token |
| POST | `/auth/quiz/create-session` | ✗ (sessionToken) | Get socketToken for WS connection |
| GET | `/auth/quiz/session-status/:participantId` | ✗ | Check if already authenticated |

---

## POST `/auth/quiz/authenticate`

First step. Participant proves they are registered by providing their email and registration reference number.

**Auth required:** No  
**Rate limited:** 10 attempts per 15 min per IP

### Request Body

```json
{
  "email": "participant@example.com",
  "registrationRef": "QB-2025-00142",
  "contestSlug": "dsa-championship-2025"
}
```

| Field | Type | Required |
|-------|------|:---:|
| `email` | string | ✓ |
| `registrationRef` | string | ✓ |
| `contestSlug` | string | ✓ |

### Response `200`

```json
{
  "success": true,
  "data": {
    "participantId": "01HPART...",
    "contestId": "01HCONT...",
    "firstName": "Rahul",
    "joinCodeRequired": true,
    "contestStatus": "PUBLISHED",
    "startTime": "2025-06-15T10:00:00.000Z",
    "message": "Identity verified. Please enter the join code to proceed."
  }
}
```

| Field | Description |
|-------|-------------|
| `participantId` | Needed for subsequent calls |
| `joinCodeRequired` | If `true`, go to verify-join-code; if `false`, go to OTP flow |
| `contestStatus` | `PUBLISHED` = waiting room not open yet, `LIVE` = can join now |

### Errors

| Status | Code | When |
|--------|------|------|
| 404 | `NOT_FOUND` | Email + registrationRef combination not found |
| 400 | `PAYMENT_PENDING` | Participant registered but payment not completed |
| 403 | `DISQUALIFIED` | Participant has been disqualified |
| 410 | `CONTEST_ENDED` | Contest is already completed |

---

## POST `/auth/quiz/verify-join-code`

The admin reveals the 5-character join code at the start of the contest (shown in admin dashboard). Participant enters this to prove physical presence.

**Auth required:** No  
**Rate limited:** 5 attempts per 15 min per participant

### Request Body

```json
{
  "participantId": "01HPART...",
  "contestId": "01HCONT...",
  "joinCode": "XK9PQ"
}
```

| Field | Type | Required |
|-------|------|:---:|
| `participantId` | string | ✓ |
| `contestId` | string | ✓ |
| `joinCode` | string | ✓ |

### Response `200`

```json
{
  "success": true,
  "data": {
    "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 300
  }
}
```

| Field | Description |
|-------|-------------|
| `sessionToken` | Intermediate token valid for ~5 minutes. Use immediately to call `/create-session`. |

### Errors

| Status | Code | When |
|--------|------|------|
| 400 | `INVALID_JOIN_CODE` | Wrong join code |
| 429 | — | Too many failed attempts |

---

## POST `/auth/quiz/request-otp`

Used when `joinCodeRequired: false`. Sends an OTP to the participant's email. Same endpoint as registration OTP.

**Auth required:** No

### Request Body

```json
{
  "email": "participant@example.com"
}
```

### Response `200`

```json
{
  "success": true,
  "message": "OTP sent to your email"
}
```

---

## POST `/auth/quiz/verify-otp`

Verify the OTP. On success, returns a `sessionToken` (same as the join-code path output).

**Auth required:** No

### Request Body

```json
{
  "email": "participant@example.com",
  "otp": "482915",
  "participantId": "01HPART..."
}
```

### Response `200`

```json
{
  "success": true,
  "data": {
    "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 300
  }
}
```

---

## POST `/auth/quiz/create-session`

Exchange the `sessionToken` for a `socketToken`. The `socketToken` is what the WebSocket connection uses for authentication.

This call also:
- Creates/updates the `QuizSession` record in DB
- Marks the participant as `CHECKED_IN`
- If the contest is already `LIVE`, returns `inWaitingRoom: false` — go straight to quiz

**Auth required:** No (uses `sessionToken` in body)

### Request Body

```json
{
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "participantId": "01HPART...",
  "deviceFingerprint": "fp_abc123xyz"
}
```

| Field | Type | Required | Notes |
|-------|------|:---:|-------|
| `sessionToken` | string | ✓ | From verify-join-code or verify-otp |
| `participantId` | string | ✓ | From authenticate response |
| `deviceFingerprint` | string | ✗ | Browser fingerprint for device tracking |

### Response `200`

```json
{
  "success": true,
  "data": {
    "socketToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 7200,
    "participantId": "01HPART...",
    "contestId": "01HCONT...",
    "inWaitingRoom": true,
    "contestStartTime": "2025-06-15T10:00:00.000Z",
    "resumeFromQuestion": null
  }
}
```

| Field | Description |
|-------|-------------|
| `socketToken` | Pass this in Socket.IO handshake `auth.token`. Valid for 2 hours. |
| `inWaitingRoom` | `true` = contest not started yet, show waiting room UI. `false` = contest is live, connect immediately. |
| `resumeFromQuestion` | `null` for new session. `45` if they disconnected at question 45 — resume from Q46. |

### Errors

| Status | Code | When |
|--------|------|------|
| 401 | `INVALID_TOKEN` | sessionToken invalid or expired |
| 409 | `SESSION_EXISTS` | Another active session exists on a different device |

---

## GET `/auth/quiz/session-status/:participantId`

Check if a participant already has an active authenticated session. Use this on page load to skip the auth flow if they are already checked in.

**Auth required:** No

### Response `200`

```json
{
  "success": true,
  "data": {
    "isAuthenticated": true,
    "hasActiveSession": true,
    "socketToken": "eyJ...",
    "resumeFromQuestion": 12,
    "inWaitingRoom": false
  }
}
```

If `isAuthenticated: false`, run the full auth flow from step 1.  
If `isAuthenticated: true` and `hasActiveSession: true`, skip directly to Socket.IO connection.

---

## Frontend State to Track

```ts
interface QuizAuthState {
  // Step 1 output
  participantId: string | null;
  contestId: string | null;
  joinCodeRequired: boolean;

  // Step 2 output
  sessionToken: string | null;  // ephemeral — don't persist

  // Step 3 output
  socketToken: string | null;   // store in sessionStorage only
  resumeFromQuestion: number | null;
  inWaitingRoom: boolean;
}
```

> Store `socketToken` in `sessionStorage` (not `localStorage`) so it is cleared when the browser tab closes. Never persist it across browser sessions.
