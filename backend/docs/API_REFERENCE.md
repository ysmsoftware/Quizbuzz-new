# 🚀 QuizBuzz API Reference

This document provides a comprehensive list of all API endpoints available in the QuizBuzz backend.

**Base URL:** `http://localhost:3000/api/v1`

### 📚 Detailed Module Guides
- [🔐 Auth & Identity](auth_api.md)
- [🏢 Organization Management](organization_api.md)
- [🚀 Onboarding](onboarding_api.md)
- [💸 Payout](payout_api.md)
- [🏆 Contest Management](contest_api.md)
- [❓ Question Bank](question_api.md)
- [👤 Contact Database](contact_api.md)
- [👥 Participant Management](participant_api.md)
- [⚡ Quiz & Real-Time](quiz_api.md)
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
| GET | `/auth/admin/socket-token` | Admin | Retrieve a token for WebSocket connections. |

---

## 2. Organization Module
Management of organization profile and team members.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/org/:orgId` | Admin | Get organization details. |
| PATCH | `/org/:orgId/profile` | Admin | Update organization details (name, logo, website). |
| GET | `/org/:orgId/members` | Admin | List all members of the organization. |
| POST | `/org/:orgId/members/invite` | Admin | Invite a new member to the organization. |
| PATCH | `/org/:orgId/members/:memberId/role` | Admin | Update a member's role (OWNER, ADMIN, VIEWER). |
| DELETE | `/org/:orgId/members/:memberId` | Admin | Remove a member from the organization. |
| POST | `/org/members/invite/accept` | Public | Accept an invitation using the invite token. |

---

## 3. Onboarding Module
Initial setup and plan selection flow for new organizations.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/onboarding/status` | Admin | Retrieve the current completion state. |
| PATCH | `/onboarding/step/:step` | Admin | Persist data for a specific setup step. |
| POST | `/onboarding/complete` | Admin | Finalize onboarding and activate the organization. |
| GET | `/onboarding/plans` | Admin | Fetch available billing plans. |
| POST | `/onboarding/handoff` | Admin | Generate a secure handoff link for external billing. |

---

## 4. Payout Module
Managing organization payout accounts and tracking revenue transfers.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/payout/setup` | Admin | Initialize a payout account configuration. |
| GET | `/payout/account` | Admin | Retrieve the current payout account details. |
| PATCH | `/payout/link` | Admin | Finalize linkage of an external payout account. |
| GET | `/payout/transfers` | Admin | Fetch a ledger of all automated revenue transfers. |
| GET | `/payout/summary` | Admin | Retrieve aggregated metrics of revenue payouts. |

---

## 5. Contact Module
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

## 6. Contest Module
Endpoints for the complete contest lifecycle.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/contests` | Admin | Create a new contest (Draft status). |
| GET | `/contests` | Admin | List all active contests owned by the organization. |
| POST | `/contests/upload-banner` | Admin | Upload a promotional banner image. |
| POST | `/contests/register/:contestSlug` | Public | Register for a contest via public slug. |
| GET | `/contests/public` | Public | Fetch all publicly accessible and published contests. |
| GET | `/contests/public/:slug` | Public | Fetch detailed public information about a contest. |
| GET | `/contests/archived` | Admin | Fetch all archived contests. |
| GET | `/contests/:contestId` | Admin | Get detailed contest configuration. |
| PATCH | `/contests/:contestId` | Admin | Update contest settings. |
| DELETE | `/contests/:contestId` | Admin | Soft-delete a draft contest. |
| PATCH | `/contests/:contestId/archive` | Admin | Move a contest to the archive. |
| POST | `/contests/:contestId/publish` | Admin | Publish contest and open for registration. |
| POST | `/contests/:contestId/close-registration` | Admin | Manually close the registration window early. |
| GET | `/contests/:contestId/participants` | Admin | List all participants for a contest. |
| GET | `/contests/:contestId/participants/status-summary`| Admin | Get aggregated participant status counts. |
| GET | `/contests/:contestId/participants/:participantId` | Admin | Get specific participant details. |
| PATCH | `/contests/:contestId/participants/:participantId/disqualify` | Admin | Disqualify a participant. |
| POST | `/contests/:contestId/evaluate` | Admin | Trigger evaluation of all submissions. |
| GET | `/contests/:contestId/results-info` | Admin | Retrieve pre-declaration insights. |
| POST | `/contests/:contestId/declare-results` | Admin | Declare final results and publish leaderboard. |
| GET | `/contests/:contestId/leaderboard` | Public | Retrieve rankings for a public contest. |
| GET | `/contests/:contestId/admin-leaderboard`| Admin | Retrieve complete leaderboard for admin review. |

---

## 7. Question Module
Manage the organizational question bank and contest assignments.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/questions` | Admin | List organization's questions. |
| POST | `/questions` | Admin | Create a single question with options. |
| POST | `/questions/bulk` | Admin | Bulk import questions. |
| GET | `/questions/tags` | Admin | Get distinct tags used in organization questions. |
| GET | `/questions/:id` | Admin | Get detailed question info. |
| PATCH | `/questions/:id` | Admin | Update question or its options. |
| DELETE | `/questions/:id` | Admin | Soft delete a question. |
| GET | `/questions/contests/:contestId/questions` | Admin | Retrieve all questions assigned to a contest. |
| POST | `/questions/contests/:contestId/assign-questions` | Admin | Link questions to a specific contest. |
| POST | `/questions/contests/:contestId/auto-generate` | Admin | Use AI to automatically generate questions. |
| DELETE | `/questions/contests/:contestId/questions/:questionId` | Admin | Unlink a specific question from a contest. |
| PATCH | `/questions/contests/:contestId/questions/:questionId` | Admin | Update scoring/ordering within one contest. |

---

## 8. Participant Module
Management and auditing of contest participants.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/contests/:contestId/participants` | Admin | Fetch all users registered for a contest. |
| GET | `/contests/:contestId/participants/status-summary`| Admin | Aggregated counts of participants by status. |
| POST | `/contests/:contestId/participants/bulk-status` | Admin | Force update status of multiple participants. |
| GET | `/contests/:contestId/participants/:participantId` | Admin | Retrieve detailed information about a participant. |
| PATCH | `/contests/:contestId/participants/:participantId/disqualify` | Admin | Manually remove a participant from the contest. |
| POST | `/contests/:contestId/participants/export` | Admin | Initiate a background job to export participant data. |
| GET | `/contests/:contestId/participants/export/:exportId` | Admin | Check status or retrieve download link for export. |

---

## 9. Submission Module
Endpoints for handling participant quiz entries.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/admin/contests/:contestId/submissions` | Admin | List all submissions for a contest. |
| GET | `/admin/contests/:contestId/submissions/stats` | Admin | Get status breakdown of submissions. |
| POST | `/admin/contests/:contestId/submissions/evaluate` | Admin | Trigger bulk grading evaluation. |
| GET | `/admin/submissions/:submissionId` | Admin | Get full details of a submission (with scores). |
| PATCH | `/admin/submissions/:submissionId/invalidate` | Admin | Invalidate a submission (admin override). |
| GET | `/admin/contacts/:contactId/submissions` | Admin | Get all submissions for a specific contact. |
| POST | `/:contestId/submit` | Partic. | Submit quiz answers. |
| GET | `/submissions/me/:participantId` | Partic. | Get own submission results. |

---

## 10. Messaging Module
Communications management (Email/WhatsApp).

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/messaging/templates` | Admin | Retrieve all available message templates. |
| POST | `/messaging/send` | Admin | Send an ad-hoc message. |
| GET | `/messaging/:id` | Admin | Get delivery status of a specific message. |
| POST | `/messaging/:id/retry` | Admin | Retry a specific failed message. |
| POST | `/messaging/retry-failed` | Admin | Bulk retry all failed messages in org. |
| GET | `/messaging/contact/:contactId` | Admin | Message history for a contact. |
| GET | `/messaging/contest/:contestId` | Admin | All messages sent for a specific contest. |
| GET | `/messaging/contest/:contestId/contact/:contactId` | Admin | Messages for contact in contest. |

---

## 11. Payment Module
Integration with Razorpay for contest entry fees.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/payment/create-order` | Partic. | Create a new Razorpay order for registration. |
| POST | `/payment/verify` | Partic. | Verify payment signature after success. |
| POST | `/payment/retry` | Partic. | Retry a failed payment order. |
| GET | `/payment/status/:participantId` | Partic. | Check real-time payment status of participant. |
| GET | `/payment/events/:contestId` | Admin | List all payments for a contest. |
| GET | `/payment` | Admin | List all payments in organization. |
| GET | `/payment/:paymentId` | Admin | Get specific payment transaction details. |
| POST | `/payment/:paymentId/cancel` | Admin | Cancel a pending payment. |

---

## 12. Certificate Module
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

## 13. Proctoring Module
Real-time monitoring and violation auditing.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/proctoring/contests/:contestId/overview` | Admin | Global violation stats for a live quiz. |
| GET | `/proctoring/contests/:contestId/flagged` | Admin | List participants with high violation counts. |
| GET | `/proctoring/contests/:contestId/participants/:participantId/events` | Admin | Detailed audit log of violations for a user. |
| PATCH | `/proctoring/scores/:scoreId/status` | Admin | Dismiss or confirm a specific violation. |
| GET | `/proctoring/contests/:contestId/participants/:participantId/captures` | Admin | Retrieve webcam snapshots captured. |

---

## 14. Analytics Module
Performance insights and live reporting.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/analytics/:id` | Admin | Get full analytics report for a contest. |
| GET | `/analytics/:id/live` | Admin | Real-time funnel analytics. |
| POST | `/analytics/:id/refresh` | Admin | Force refresh cached analytics data. |

---

## 15. Quiz & Real-Time Module
REST endpoints for live quiz interaction and WebSocket references.

### REST Endpoints
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/auth/quiz/request-otp` | Public | Request an OTP for a participant to login. |
| POST | `/auth/quiz/verify-otp` | Public | Verify the provided OTP to authenticate. |
| POST | `/auth/quiz/participant-login` | Public | Login via credentials instead of OTP. |
| POST | `/quiz-proctoring/presigned-url` | Partic. | Request secure upload link for capture. |
| PUT | `/quiz-proctoring/local-upload` | Public | Local upload fallback for captures. |
| POST | `/quiz-proctoring/confirm` | Partic. | Confirm capture upload finished. |

### WebSocket API
**Namespace:** `/participant`
**Auth Handshake:** Extract `participantId` and `contestId` from `socket.data`

| Event (Client Emit) | Payload | Description |
| :--- | :--- | :--- |
| `quiz:v1:join` | `{}` | Join the waiting room or resume session. |
| `quiz:v1:heartbeat` | `{}` | Keep session alive and track presence. |
| `quiz:v1:answer` | `{ "questionId": "...", "selectedOptionId": "...", "answeredAt": "..." }` | Save an answer to Redis. |
| `quiz:v1:skip` | `{ "questionId": "..." }` | Explicitly skip a question. |
| `quiz:v1:violation` | `{ "type": "TAB_SWITCH", "severity": "MEDIUM" }` | Report a detected violation. |
| `quiz:v1:submit` | `{}` | Final submission of the quiz. |

| Event (Server Emit) | Payload | Description |
| :--- | :--- | :--- |
| `quiz:v1:waiting_room_status`| `{ "status": "WAITING" }` | Updates pre-quiz status. |
| `quiz:v1:start` | `{ "questions": [...], "totalTimeMs": 3600000 }` | Quiz has started for the user. |
| `quiz:v1:answer_saved` | `{ "questionId": "..." }` | Confirmation answer persisted. |
| `quiz:v1:time_warning` | `{ "secondsRemaining": 300 }` | Time threshold alert. |
| `quiz:v1:auto_submit` | `{ "reason": "TIME_UP" }` | Force submission by server. |
| `quiz:v1:capture_request`| `{ "captureType": "RANDOM" }` | Trigger camera snapshot on client. |
| `quiz:v1:violation_update`| `{ "count": 2 }` | Informs client of updated violation count. |
| `quiz:v1:submit_success` | `{ "submissionRef": "..." }` | Confirms successful manual submission. |
