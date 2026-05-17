# ⚡ Quiz & Submission Module API Documentation

This document covers the core real-time quiz experience, including REST endpoints for submission management and WebSocket events for the live quiz flow.

---

## 📑 Table of Contents
1. [Submission Management (REST)](#1-submission-management-rest)
2. [Live Quiz Handshake (WebSocket)](#2-live-quiz-handshake-websocket)
3. [Live Quiz Events (WebSocket)](#3-live-quiz-events-websocket)

---

## 1. Submission Management (REST)

### 👤 Participant Routes
Endpoints used by participants to submit or retrieve their own work.

#### **Submit Quiz**
Manual submission of the quiz.
- **Method:** `POST`
- **Endpoint:** `/api/v1/:contestId/submit`
- **Headers:** `X-Idempotency-Key` (Optional but recommended)

#### **Get My Submission**
Retrieve the result or confirmation for a specific participant.
- **Method:** `GET`
- **Endpoint:** `/api/v1/submissions/me/:participantId`

---

### 👑 Admin Routes
Endpoints used by organizers to audit and evaluate submissions.

#### **List Contest Submissions**
- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/contests/:contestId/submissions`
- **Query Params:** `status` (`SUBMITTED`, `EVALUATED`, `INVALIDATED`), `page`, `limit`.

#### **Trigger Bulk Evaluation**
Enqueues background jobs to score all submitted quizzes for a contest.
- **Method:** `POST`
- **Endpoint:** `/api/v1/admin/contests/:contestId/submissions/evaluate`

#### **Invalidate Submission**
- **Method:** `PATCH`
- **Endpoint:** `/api/v1/admin/submissions/:submissionId/invalidate`

---

## 2. Live Quiz Handshake (WebSocket)

All live interactions happen over the `participant` namespace.
- **Namespace:** `/participant`
- **Auth:** Handshake must include `participantId` and `contestId` in `socket.data`.

### **Connection Logic**
Upon connection, the server automatically joins the participant to two rooms:
1. `contest:<contestId>` - For contest-wide broadcasts.
2. `participant:<participantId>` - For individual instructions.

---

## 3. Live Quiz Events (WebSocket)

### 📤 Client-to-Server Events

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `quiz:v1:join` | `JoinPayload` | Join the waiting room. |
| `quiz:v1:heartbeat`| - | Keep session active and prevent auto-submit. |
| `quiz:v1:answer` | `AnswerPayload`| Save an answer to a specific question. |
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
| `quiz:v1:start` | `QuizData` | Triggered when the quiz officially starts. Includes questions. |
| `quiz:v1:answer_saved`| `{ questionId }` | Confirmation that an answer was persisted. |
| `quiz:v1:time_warning`| `{ secondsRemaining }`| Notification of approaching deadline. |
| `quiz:v1:auto_submit` | `{ reason }` | Triggered if time expires or violation limit reached. |
| `quiz:v1:capture_request`| `{ captureType }`| Request for proctoring photo/screenshot. |

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
