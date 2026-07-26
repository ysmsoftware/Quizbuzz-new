# ⚡ Quiz & Real-Time Module API Documentation

This document covers the core real-time quiz experience, including REST endpoints for participant registration/auth and proctoring capture uploads, as well as WebSocket events for the live quiz flow.

*(Note: Submission management endpoints are documented in `submission_api.md`)*

---

## 📑 Table of Contents
1. [Quiz Registration (REST)](#1-quiz-registration-rest)
2. [Quiz Proctoring (REST)](#2-quiz-proctoring-rest)
3. [Live Quiz Handshake (WebSocket)](#3-live-quiz-handshake-websocket)
4. [Live Quiz Events (WebSocket)](#4-live-quiz-events-websocket)

---

## 1. Quiz Registration (REST)

Endpoints used by participants to authenticate and join a contest. These are mounted under `/api/v1/auth/quiz`.

### 1.1 Request OTP
**Description:** Request an OTP for a participant to login to a specific contest.
**Business Logic:** Verifies that the participant is registered for the given contest and that the contest is currently active, then generates and dispatches a secure OTP via email/SMS.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/quiz/request-otp`
- **Auth:** Public

### 1.2 Verify OTP
**Description:** Verify the provided OTP to authenticate the participant.
**Business Logic:** Checks the OTP against the stored hash in Redis. If successful, issues a short-lived participant JWT allowing access to the quiz gateway and proctoring routes.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/quiz/verify-otp`
- **Auth:** Public

### 1.3 Participant Login
**Description:** Alternative login method if OTPs are disabled or for specific SSO flows.
**Business Logic:** Validates participant credentials directly against the database to issue a participant JWT for the live quiz session.

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/quiz/participant-login`
- **Auth:** Public

---

## 2. Quiz Proctoring (REST)

Endpoints used by the participant client during the live quiz to upload webcam captures or screen recordings. These are mounted under `/api/v1/quiz-proctoring`.

### 2.1 Get Presigned URL
**Description:** Request a secure upload link for a proctoring capture.
**Business Logic:** Generates a short-lived S3 presigned URL granting the client direct PUT access to a specific path in the cloud storage bucket for their image/video capture.

- **Method:** `POST`
- **Endpoint:** `/api/v1/quiz-proctoring/presigned-url`
- **Auth:** Participant JWT

### 2.2 Local Upload
**Description:** Endpoint mimicking S3 presigned URL upload for local development.
**Business Logic:** Handles multipart form data upload directly to the local filesystem when cloud storage is disabled in development environments.

- **Method:** `PUT`
- **Endpoint:** `/api/v1/quiz-proctoring/local-upload`
- **Auth:** Public (Path and key restricted)

### 2.3 Confirm Upload
**Description:** Confirm that a capture upload has finished successfully.
**Business Logic:** Triggers a background BullMQ job to process the uploaded file (e.g., run AI face detection or compute trust score impact) asynchronously.

- **Method:** `POST`
- **Endpoint:** `/api/v1/quiz-proctoring/confirm`
- **Auth:** Participant JWT

---

## 3. Live Quiz Handshake (WebSocket)

All live interactions happen over the `participant` namespace.
- **Namespace:** `/participant`
- **Auth:** Handshake must include `participantId` and `contestId` in `socket.data`. (Extracted from the Participant JWT).

### **Connection Logic**
Upon connection, the server automatically joins the participant to two rooms:
1. `contest:<contestId>` - For contest-wide broadcasts (e.g., time warnings).
2. `participant:<participantId>` - For individual instructions (e.g., auto-submit, capture requests).

---

## 4. Live Quiz Events (WebSocket)

### 📤 Client-to-Server Events

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `quiz:v1:join` | `JoinPayload` | Join the waiting room or resume session. |
| `quiz:v1:heartbeat`| - | Keep session active and prevent auto-submit. |
| `quiz:v1:answer` | `AnswerPayload`| Save an answer to a specific question. |
| `quiz:v1:skip` | `SkipPayload` | Explicitly skip a question to update progress accurately. |
| `quiz:v1:violation`| `ViolationPayload`| Record a proctoring violation (e.g. Tab Switch). |
| `quiz:v1:submit` | `SubmitPayload` | Manual trigger for quiz completion. |

**Example Answer Payload:**
```json
{
  "questionId": "ques_123",
  "selectedOptionId": "opt_456",
  "answeredAt": "2024-05-20T10:05:00Z"
}
```

---

### 📥 Server-to-Client Events

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `quiz:v1:waiting_room_status`| `StatusPayload` | Updates the participant on their pre-quiz status (e.g., wait to start). |
| `quiz:v1:start` | `QuizData` | Triggered when the quiz officially starts. Includes all assigned questions. |
| `quiz:v1:answer_saved`| `{ questionId }` | Confirmation that an answer was persisted in Redis. |
| `quiz:v1:time_warning`| `{ secondsRemaining }`| Notification of approaching deadline. |
| `quiz:v1:auto_submit` | `{ reason }` | Triggered if time expires or violation limit is reached. |
| `quiz:v1:capture_request`| `{ captureType }`| Request for client to snap and upload a webcam photo. |
| `quiz:v1:violation_update`| `{ count }` | Informs the client of their updated violation count. |
| `quiz:v1:submit_success`| `SubmitPayload` | Confirms successful manual submission and provides submission reference. |

**Example Start Payload:**
```json
{
  "status": "STARTED",
  "startTime": "...",
  "endTime": "...",
  "questions": [
    { "id": "q1", "text": "...", "options": [...] }
  ]
}
```
