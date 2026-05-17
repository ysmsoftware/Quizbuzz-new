# QuizBuzz Frontend Integration Guide
## Master Index & Integration Order

---

### Base URL

```
https://your-domain.com/api/v1
```

All HTTP requests go through this prefix. WebSocket connections go to `wss://your-domain.com` with Socket.IO namespaces.

---

### Auth Pattern

All **protected** admin routes require a valid **httpOnly cookie** (`accessToken`). The frontend does not manage this token manually — it is set and cleared by the backend. The cookie is automatically sent with every `credentials: "include"` fetch call.

**Cookie setup for every fetch call:**

```ts
fetch(url, {
  credentials: "include",   // required — sends the httpOnly access token cookie
  headers: { "Content-Type": "application/json" }
})
```

---

### Integration Wave Order

Integrate in this exact order. Each wave only depends on the waves before it.

```
Wave 1 — Foundation (no dependencies)
  └── 01-auth.md               Admin register, login, refresh, logout, /me

Wave 2 — Org Setup (depends on Wave 1)
  └── 02-organization.md       Get org details, manage members, accept invite

Wave 3 — Content Creation (depends on Waves 1–2)
  └── 03-contests.md           Create, list, get, update, publish contest
  └── 04-questions.md          Create, bulk create, list, assign to contest

Wave 4 — Participant Side — Public Forms (no admin auth required)
  └── 05-public-registration.md  Contact token → register for contest → payment

Wave 5 — Payment (depends on Wave 4)
  └── 06-payment.md            Create order, verify, retry, webhook, admin views

Wave 6 — Live Quiz — Participant Side (depends on Waves 4–5)
  └── 07-quiz-auth.md          Authenticate participant, OTP, join code, session token
  └── 08-websocket-quiz.md     Socket.IO events: join, answer, submit, heartbeat, violations

Wave 7 — Admin Live Monitoring (depends on Wave 6)
  └── 09-admin-live.md         Admin WebSocket: live stats, violations, participant progress

Wave 8 — Post-Quiz (depends on Wave 6)
  └── 10-submissions.md        Admin views, invalidate, bulk evaluate
  └── 11-analytics.md          Contest analytics snapshot + live counts
  └── 12-proctoring.md         Flagged participants, event log, dismiss violations

Wave 9 — Results & Certificates (depends on Wave 8)
  └── 13-leaderboard.md        Public leaderboard, declare results
  └── 14-certificates.md       Issue, bulk issue, retry, download URL

Wave 10 — Admin CRM Views (can integrate any time after Wave 2)
  └── 15-contacts.md           Contact list, lookup, profile, history
  └── 16-messaging.md          Message log, retry, send manual message
```

---

### Dependency Map

```
register/login ──► get /me ──► org info ──► create contest ──► add questions
                                                    │
                                              publish contest
                                                    │
                              ┌─────────────────────┴────────────────────┐
                              │                                           │
                   public registration form                   admin monitors live
                              │                                           │
                        payment flow                          proctoring events
                              │
                    quiz auth (OTP + join code)
                              │
                    websocket quiz session
                              │
                     auto-submit on time expiry
                              │
                     evaluation → leaderboard → certificates
```

---

### Files In This Package

| File | Module |
|---|---|
| `00-INTEGRATION-ORDER.md` | This file |
| `01-auth.md` | Admin authentication |
| `02-organization.md` | Organization management |
| `03-contests.md` | Contest CRUD + lifecycle |
| `04-questions.md` | Question bank + assignment |
| `05-public-registration.md` | Public participant registration |
| `06-payment.md` | Payment flow (Razorpay) |
| `07-quiz-auth.md` | Quiz entry authentication (OTP + join code) |
| `08-websocket-quiz.md` | Live quiz WebSocket (participant) |
| `09-admin-live.md` | Admin WebSocket monitoring |
| `10-submissions.md` | Submission admin views |
| `11-analytics.md` | Analytics dashboard |
| `12-proctoring.md` | Proctoring admin panel |
| `13-leaderboard.md` | Leaderboard + declare results |
| `14-certificates.md` | Certificate management |
| `15-contacts.md` | Contact / CRM |
| `16-messaging.md` | Message logs |
