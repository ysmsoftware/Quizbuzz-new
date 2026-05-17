# 🚀 QuizBuzz API Reference

This document provides a comprehensive list of all API endpoints available in the QuizBuzz backend.

**Base URL:** `http://localhost:3000/api/v1`

### 📚 Detailed Module Guides
- [🔐 Auth & Identity](auth_api.md)
- [🏢 Organization Management](organization_api.md)
- [🏆 Contest Management](contest_api.md)
- [❓ Question Bank](question_api.md)
- [👤 Contact Database](contact_api.md)
- [👥 Participant Management](participant_api.md)
- [⚡ Live Quiz & Handshake](quiz_api.md)
- [📥 Submissions & Evaluation](submission_api.md)
- [🛡️ Proctoring & Integrity](proctoring_api.md)
- [💳 Payments (Razorpay)](payment_api.md)
- [📨 Messaging (Email/WhatsApp)](messaging_api.md)
- [📊 Analytics & Stats](analytics_api.md)
- [🎓 Certificates](certificate_api.md)

---

## 🔐 Authentication & Security

Most admin routes require a Bearer token:
`Authorization: Bearer <ADMIN_ACCESS_TOKEN>`

Routes marked as **Public** do not require authentication.
Routes marked as **Participant** require a session token or specific contact token.

---

## 1. Admin Authentication Module
Endpoints for administrator registration, login, and session management.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/auth/admin/register` | Public | Register a new administrator account. |
| POST | `/auth/admin/login` | Public | Log in and receive access/refresh tokens. |
| POST | `/auth/admin/refresh` | Public | Refresh the access token using a refresh token. |
| POST | `/auth/admin/verify-email` | Public | Verify email address using the 6-digit OTP. |
| POST | `/auth/admin/resend-verification` | Public | Resend the email verification OTP. |
| POST | `/auth/admin/forgot-password` | Public | Request a password reset link. |
| POST | `/auth/admin/reset-password` | Public | Reset password using the reset token. |
| POST | `/auth/admin/logout` | Admin | Invalidate the current session. |
| POST | `/auth/admin/logout-all` | Admin | Invalidate all active sessions for the user. |
| GET | `/auth/admin/me` | Admin | Get details of the currently logged-in user. |
| POST | `/auth/admin/switch-org` | Admin | Switch the active organization context. |

### Example: Admin Login
`POST /auth/admin/login`
```json
{
  "email": "admin@example.com",
  "password": "Password123!"
}
```

---

## 2. Organization Module
Management of organization profile and team members.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| PATCH | `/org` | Admin | Update organization details (name, logo, website). |
| GET | `/org/members` | Admin | List all members of the organization. |
| POST | `/org/members/invite` | Admin | Invite a new member to the organization. |
| PATCH | `/org/members/:userId/role` | Admin | Update a member's role (OWNER, ADMIN, VIEWER). |
| DELETE | `/org/members/:userId` | Admin | Remove a member from the organization. |
| POST | `/org/members/invite/accept` | Public | Accept an invitation using the invite token. |

### Example: Invite Member
`POST /org/members/invite`
```json
{
  "email": "newmember@example.com",
  "role": "ADMIN"
}
```

---

## 3. Contact Module
Manage the master database of participants (Contacts).

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/contacts` | Admin | Create a new contact. |
| GET | `/contacts/lookup` | Admin | Search for a contact by email or phone. |
| GET | `/contacts` | Admin | List all contacts with pagination and filters. |
| GET | `/contacts/:id` | Admin | Get full details of a specific contact. |
| PATCH | `/contacts/:id` | Admin | Update contact information. |
| DELETE | `/contacts/:id` | Admin | Soft delete a contact. |
| GET | `/contacts/:id/contests` | Admin | Get registration history for a contact. |
| GET | `/contacts/:id/messages` | Admin | Get message history for a contact. |
| GET | `/contacts/:id/certificates` | Admin | Get all certificates issued to this contact. |

---

## 4. Contest Module
Endpoints for the complete contest lifecycle.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/contests` | Admin | Create a new contest (Draft status). |
| GET | `/contests` | Admin | List all contests owned by the organization. |
| POST | `/contests/register/:contestSlug` | Public | Public registration endpoint for participants. |
| GET | `/contests/:contestId` | Admin | Get detailed contest configuration. |
| PATCH | `/contests/:contestId` | Admin | Update contest settings (while in Draft). |
| DELETE | `/contests/:contestId` | Admin | Delete a draft contest. |
| POST | `/contests/:contestId/publish` | Admin | Publish contest and generate Join Code. |
| GET | `/contests/:contestId/participants` | Admin | List all registered participants for a contest. |
| GET | `/contests/:contestId/participants/:participantId` | Admin | Get specific participant details. |
| PATCH | `/contests/:contestId/participants/:participantId/disqualify` | Admin | Disqualify a participant with a reason. |
| POST | `/contests/:contestId/evaluate` | Admin | Trigger bulk evaluation of all submissions. |
| POST | `/contests/:contestId/declare-results` | Admin | Publish leaderboard and notify participants. |
| GET | `/contests/:contestId/leaderboard` | Public | Get the published leaderboard for a contest. |

---

## 5. Question Module
Manage the organizational question bank and contest assignments.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/questions` | Admin | Create a single question with options. |
| GET | `/questions` | Admin | List organization's questions. |
| GET | `/questions/:id` | Admin | Get detailed question info. |
| PATCH | `/questions/:id` | Admin | Update question or its options. |
| DELETE | `/questions/:id` | Admin | Soft delete a question. |
| POST | `/questions/bulk` | Admin | Bulk import questions from JSON. |
| POST | `/questions/assign/:contestId` | Admin | Link questions to a specific contest. |
| POST | `/questions/reorder/:contestId` | Admin | Change the display order of questions in a contest. |
| PATCH | `/questions/contest-questions/:id` | Admin | Update marks/negative marks for a specific link. |
| GET | `/questions/tags` | Admin | Get distinct tags used in organization questions. |

---

## 6. Submission Module
Endpoints for handling participant quiz entries.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/admin/contests/:contestId/submissions` | Admin | List all submissions for a contest. |
| GET | `/admin/contests/:contestId/submissions/stats` | Admin | Get status breakdown of submissions. |
| POST | `/admin/contests/:contestId/submissions/evaluate` | Admin | Trigger evaluation (redundant with Contest Evaluate). |
| GET | `/admin/submissions/:submissionId` | Admin | Get full details of a submission (with scores). |
| PATCH | `/admin/submissions/:submissionId/invalidate` | Admin | Invalidate a submission (admin override). |
| GET | `/admin/contacts/:contactId/submissions` | Admin | Get all submissions for a specific contact. |
| POST | `/:contestId/submit` | Partic. | Submit quiz answers (REST fallback). |
| GET | `/submissions/me/:participantId` | Partic. | Get own submission results. |

---

## 7. Messaging Module
Communications management (Email/WhatsApp).

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/messaging/:id` | Admin | Get details and delivery status of a message. |
| POST | `/messaging/send` | Admin | Send an ad-hoc message using a template. |
| POST | `/messaging/:id/retry` | Admin | Retry a failed message delivery. |
| POST | `/messaging/retry-failed` | Admin | Bulk retry all failed messages in org. |
| GET | `/messaging/contact/:contactId` | Admin | Message history for a contact. |
| GET | `/messaging/contest/:contestId` | Admin | All messages sent for a specific contest. |

---

## 8. Payment Module
Integration with Razorpay for contest entry fees.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/payment/create-order` | Partic. | Create a new Razorpay order for registration. |
| POST | `/payment/verify` | Partic. | Verify payment signature after success. |
| POST | `/payment/retry` | Partic. | Retry a failed payment order. |
| GET | `/payment/events/:contestId` | Admin | List all payments for a contest. |
| GET | `/payment` | Admin | List all payments in organization. |
| GET | `/payment/:paymentId` | Admin | Get specific payment transaction details. |
| POST | `/payment/:paymentId/cancel` | Admin | Cancel a pending payment. |

---

## 9. Certificate Module
Automated certificate generation and delivery.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/certificates/issue` | Admin | Issue a single certificate. |
| POST | `/certificates/bulk-issue` | Admin | Bulk issue certificates based on criteria. |
| POST | `/certificates/retry-failed` | Admin | Retry failed certificate generations. |
| GET | `/certificates/contact/:contactId/contest/:contestId` | Admin | Find certificate for specific pairing. |
| GET | `/certificates/contact/:contactId` | Admin | List certificates for a contact. |
| GET | `/certificates/contest/:contestId` | Admin | List certificates for a contest. |
| GET | `/certificates/:id` | Admin | Get certificate metadata and download link. |
| POST | `/certificates/:id/retry` | Admin | Retry specific certificate. |

---

## 10. Proctoring Module
Real-time monitoring and violation auditing.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/proctoring/contests/:contestId/overview` | Admin | Global violation stats for a live quiz. |
| GET | `/proctoring/contests/:contestId/flagged` | Admin | List participants with high violation counts. |
| GET | `/proctoring/contests/:contestId/participants/:participantId/events` | Admin | Detailed audit log of violations for a user. |
| PATCH | `/proctoring/scores/:scoreId/status` | Admin | Dismiss or confirm a specific violation. |

---

## 11. Analytics Module
Performance insights and live reporting.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/analytics/:id` | Admin | Get full analytics report for a contest. |
| GET | `/analytics/:id/live` | Admin | Real-time funnel analytics (Waiting -> In-Quiz -> Submitted). |
| POST | `/analytics/:id/refresh` | Admin | Force refresh cached analytics data. |

---

## 12. Quiz Module (WebSocket API)
Quiz interaction happens over WebSockets for real-time performance.

**Namespace:** `/participant`
**Auth Handshake:** Pass JWT as `token` in `auth` object.

| Event (Client Emit) | Payload | Description |
| :--- | :--- | :--- |
| `quiz:v1:join` | `{}` | Join the waiting room for the contest. |
| `quiz:v1:heartbeat` | `{}` | Keep session alive and track presence. |
| `quiz:v1:answer` | `{ "questionId": "...", "selectedOptionId": "...", "answeredAt": "..." }` | Save an answer to Redis (Auto-save). |
| `quiz:v1:violation` | `{ "type": "TAB_SWITCH", "severity": "MEDIUM" }` | Report a detected violation. |
| `quiz:v1:submit` | `{}` | Final submission of the quiz. |

| Event (Server Emit) | Payload | Description |
| :--- | :--- | :--- |
| `quiz:v1:start` | `{ "questions": [...], "totalTimeMs": 3600000 }` | Quiz has started for the user. |
| `quiz:v1:time_warning` | `{ "secondsRemaining": 300 }` | Time threshold alert. |
| `quiz:v1:auto_submit` | `{ "reason": "TIME_UP" }` | Force submission by server. |
| `quiz:v1:capture_request`| `{ "captureType": "RANDOM" }` | Trigger camera snapshot on client. |

---

## 🛠️ Postman Collection Tips

1.  **Environment Variables**: Create an environment in Postman with `baseUrl` and `adminToken`.
2.  **Inheritance**: Set the Authorization to `Bearer Token` at the Collection level using `{{adminToken}}`.
3.  **JSON Body**: All POST/PATCH requests use `Content-Type: application/json`.
4.  **Registration Ref**: After registration, store the `registrationRef` to use in participant-facing endpoints.
