# 08 — WebSocket Quiz (Participant Side)
**Wave 6 | Depends on: Wave 6a (quiz auth, socketToken)**

All live quiz interaction happens over **Socket.IO**. There are no HTTP endpoints for question fetching, answering, or submission — everything is a socket event. This document covers all events the participant client sends and receives.

---

## Connection Setup

```ts
import { io, Socket } from "socket.io-client";

const socket: Socket = io("wss://your-domain.com", {
  path: "/socket.io",           // from WS_PATH env
  auth: {
    token: socketToken           // from 07-quiz-auth.md create-session response
  },
  transports: ["websocket"],    // skip polling — websocket only
  reconnection: true,
  reconnectionAttempts: 5,      // from WS_RECONNECT_ATTEMPTS env
  reconnectionDelay: 2000,      // from WS_RECONNECT_DELAY env
  timeout: 10000
});
```

### Connection Events

```ts
socket.on("connect", () => {
  console.log("Connected:", socket.id);
  // Immediately emit join after connecting
  socket.emit("quiz:v1:join", { participantId, contestId });
});

socket.on("connect_error", (err) => {
  // Token expired → redirect to re-auth
  if (err.message === "UNAUTHORIZED") {
    router.push("/quiz/:contestSlug/join");
  }
});

socket.on("disconnect", (reason) => {
  if (reason === "io server disconnect") {
    // Server kicked us — do not auto-reconnect
    showMessage("You have been disconnected by the server.");
  }
  // All other reasons: Socket.IO will auto-reconnect
});
```

---

## Namespace

All participant events use the namespace: `/quiz`  
All events follow the pattern: `quiz:v1:<event-name>`

---

## Events the Client EMITS (sends to server)

### `quiz:v1:join`

Send immediately after connecting. Registers the participant in the quiz session and returns the current state.

```ts
socket.emit("quiz:v1:join", {
  participantId: "01HPART...",
  contestId:     "01HCONT..."
});
```

**Payload:**

| Field | Type | Required |
|-------|------|:---:|
| `participantId` | string | ✓ |
| `contestId` | string | ✓ |

**Server responds with:** `quiz:v1:join_ack`

---

### `quiz:v1:ready`

Sent from the **waiting room** once the participant has granted camera permissions (if proctoring is enabled). Marks the participant as ready to start.

```ts
socket.emit("quiz:v1:ready", {
  participantId: "01HPART...",
  contestId:     "01HCONT...",
  cameraGranted: true
});
```

**Server responds with:** `quiz:v1:ready_ack`

---

### `quiz:v1:answer`

Submit an answer for the current question. Call this every time the participant selects or changes an option. Answers are saved to Redis instantly — the participant can change their answer any time before the question timer ends.

```ts
socket.emit("quiz:v1:answer", {
  participantId:    "01HPART...",
  contestId:        "01HCONT...",
  questionId:       "01HQUES...",
  selectedOptionId: "01HOPT2...",  // null to clear/skip
  questionIndex:    4              // 0-based index of current question
});
```

**Payload:**

| Field | Type | Required | Notes |
|-------|------|:---:|-------|
| `participantId` | string | ✓ | |
| `contestId` | string | ✓ | |
| `questionId` | string | ✓ | |
| `selectedOptionId` | string \| null | ✓ | `null` = skip this question |
| `questionIndex` | number | ✓ | 0-based index |

**Server responds with:** `quiz:v1:answer_ack`

---

### `quiz:v1:submit`

Final manual submission. Call when the participant clicks "Submit Quiz". The quiz engine will also auto-submit when time expires — you do not need to handle that case specially.

```ts
socket.emit("quiz:v1:submit", {
  participantId: "01HPART...",
  contestId:     "01HCONT..."
});
```

**Server responds with:** `quiz:v1:submit_ack`

---

### `quiz:v1:heartbeat`

Send every `WS_HEARTBEAT_INTERVAL` milliseconds (default: 15 seconds) to keep the session alive. If heartbeats stop for too long, the session is considered disconnected and the participant's slot may be freed for re-entry.

```ts
// Set up heartbeat on connect
const heartbeatInterval = setInterval(() => {
  socket.emit("quiz:v1:heartbeat", {
    participantId: "01HPART...",
    contestId:     "01HCONT..."
  });
}, 15_000);

// Clear on disconnect
socket.on("disconnect", () => clearInterval(heartbeatInterval));
```

---

### `quiz:v1:proctoring_event`

Send proctoring violation events detected by the client (tab switch, fullscreen exit, face detection events, etc.). The backend logs these and updates the participant's trust score.

```ts
socket.emit("quiz:v1:proctoring_event", {
  participantId: "01HPART...",
  contestId:     "01HCONT...",
  type:          "TAB_SWITCH",
  severity:      2,
  metadata:      { timestamp: Date.now() }
});
```

**Violation types the client should detect and send:**

| Type | Severity | Trigger |
|------|:---:|-------|
| `TAB_SWITCH` | 2 | `document.visibilitychange` event (hidden) |
| `FULLSCREEN_EXIT` | 2 | `fullscreenchange` event |
| `WINDOW_BLUR` | 1 | `window.blur` event |
| `SCREEN_RESIZE` | 1 | `window.resize` event (drastic change) |
| `FACE_NOT_DETECTED` | 3 | Camera feed analysis returns no face |
| `MULTIPLE_FACES` | 3 | Camera feed analysis detects > 1 face |
| `GAZE_AWAY` | 1 | Face looking away from screen |
| `POOR_LIGHTING` | 1 | Camera feed too dark |
| `AUDIO_ANOMALY` | 2 | Microphone detects conversation |
| `SNAPSHOT_START` | 0 | Auto-snapshot at quiz start (metadata only) |
| `SNAPSHOT_MID_POINT` | 0 | Auto-snapshot at quiz midpoint |
| `SNAPSHOT_RANDOM` | 0 | Random auto-snapshot |
| `SNAPSHOT_PRE_SUBMIT` | 0 | Auto-snapshot before submission |

---

## Events the Client RECEIVES (from server)

### `quiz:v1:join_ack`

Response to `quiz:v1:join`. Contains the full current state needed to render the quiz UI.

```ts
socket.on("quiz:v1:join_ack", (data: JoinAck) => {
  // data contains current questions, answers, phase, time remaining
});
```

**Payload:**

```json
{
  "success": true,
  "phase": "WAITING",
  "participant": {
    "id": "01HPART...",
    "status": "IN_WAITING",
    "currentQuestion": 0
  },
  "contest": {
    "id": "01HCONT...",
    "title": "DSA Championship 2025",
    "duration": 90,
    "startTime": "2025-06-15T10:00:00.000Z",
    "totalQuestions": 50,
    "shuffleOptions": false
  },
  "questions": [
    {
      "id": "01HQUES...",
      "questionText": "What is the time complexity of QuickSort?",
      "options": [
        { "id": "01HOPT1...", "text": "O(n)",       "position": 0 },
        { "id": "01HOPT2...", "text": "O(n log n)", "position": 1 },
        { "id": "01HOPT3...", "text": "O(n²)",      "position": 2 },
        { "id": "01HOPT4...", "text": "O(log n)",   "position": 3 }
      ],
      "marks": 4,
      "negativeMark": 1,
      "index": 0
    }
  ],
  "savedAnswers": {
    "01HQUES1...": "01HOPT2...",
    "01HQUES3...": null
  },
  "timeRemainingMs": 5400000,
  "resumeFromIndex": 0
}
```

> **Important:** `questions` contains ALL questions for the participant (their shuffled order from Redis). The `isCorrect` field is NOT included — answers are revealed only after results are declared. `savedAnswers` is a map of `questionId → selectedOptionId` for resuming a previous session.

**Phase values:**

| Phase | Meaning |
|-------|---------|
| `WAITING` | Contest not started — show waiting room |
| `ACTIVE` | Quiz is live — show quiz UI |
| `SUBMITTED` | Participant already submitted |
| `ENDED` | Contest has ended |

---

### `quiz:v1:quiz_started`

Broadcast to all participants when the admin starts the quiz (or when the scheduled start time fires). Transition from waiting room to quiz UI.

```ts
socket.on("quiz:v1:quiz_started", (data) => {
  // { contestId, startTime, durationMs }
  transitionToQuizUI();
  startLocalCountdown(data.durationMs);
});
```

---

### `quiz:v1:answer_ack`

Confirmation that the answer was saved to Redis.

```ts
socket.on("quiz:v1:answer_ack", (data) => {
  // { success: true, questionId, selectedOptionId, savedAt }
  // Update UI to show the answer was saved (green border, tick icon)
});
```

---

### `quiz:v1:submit_ack`

Confirmation of final submission.

```ts
socket.on("quiz:v1:submit_ack", (data) => {
  // { success: true, submittedAt, totalAnswered, totalSkipped }
  // Navigate to submission success screen
  socket.disconnect();
  router.push("/quiz/submitted");
});
```

---

### `quiz:v1:time_warning`

Sent at configured warning intervals (default: 30 min, 10 min, 5 min remaining).

```ts
socket.on("quiz:v1:time_warning", (data) => {
  // { minutesRemaining: 10, message: "10 minutes remaining" }
  showWarningToast(`${data.minutesRemaining} minutes remaining!`);
});
```

---

### `quiz:v1:auto_submit`

Server-side auto-submission triggered when time expires. The participant should immediately navigate to the submitted screen.

```ts
socket.on("quiz:v1:auto_submit", (data) => {
  // { reason: "time_expired", submittedAt, totalAnswered }
  socket.disconnect();
  router.push("/quiz/submitted?reason=time_expired");
});
```

---

### `quiz:v1:ready_ack`

Confirmation that the participant is marked ready in the waiting room.

```ts
socket.on("quiz:v1:ready_ack", (data) => {
  // { success: true, waitingCount: 47 }
  showWaitingUI(`${data.waitingCount} participants ready`);
});
```

---

### `quiz:v1:proctoring_alert`

Sent to the participant when a violation crosses the threshold and they are about to be flagged. Show a warning modal.

```ts
socket.on("quiz:v1:proctoring_alert", (data) => {
  // { violationCount: 8, threshold: 10, message: "You have been warned..." }
  showProctoringWarningModal(data.message);
});
```

---

### `quiz:v1:disqualified`

Sent if the admin or proctoring system disqualifies the participant mid-quiz.

```ts
socket.on("quiz:v1:disqualified", (data) => {
  // { reason: "Proctoring threshold exceeded", at: "2025-06-15T10:35:00Z" }
  socket.disconnect();
  router.push("/quiz/disqualified");
});
```

---

### `quiz:v1:error`

Generic error from the server for any malformed emit.

```ts
socket.on("quiz:v1:error", (data) => {
  // { code: "INVALID_QUESTION_ID", message: "..." }
  console.error("Quiz error:", data);
});
```

---

## Complete Client-Side Quiz Manager

```ts
class QuizSocketManager {
  private socket: Socket;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private participantId: string, private contestId: string) {}

  connect(socketToken: string) {
    this.socket = io("wss://your-domain.com", {
      path: "/socket.io",
      auth: { token: socketToken },
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on("connect", () => this.onConnect());
    this.socket.on("disconnect", () => this.onDisconnect());
    this.socket.on("quiz:v1:join_ack",        this.handleJoinAck.bind(this));
    this.socket.on("quiz:v1:quiz_started",     this.handleQuizStarted.bind(this));
    this.socket.on("quiz:v1:answer_ack",       this.handleAnswerAck.bind(this));
    this.socket.on("quiz:v1:submit_ack",       this.handleSubmitAck.bind(this));
    this.socket.on("quiz:v1:auto_submit",      this.handleAutoSubmit.bind(this));
    this.socket.on("quiz:v1:time_warning",     this.handleTimeWarning.bind(this));
    this.socket.on("quiz:v1:proctoring_alert", this.handleProctoringAlert.bind(this));
    this.socket.on("quiz:v1:disqualified",     this.handleDisqualified.bind(this));
  }

  private onConnect() {
    this.socket.emit("quiz:v1:join", {
      participantId: this.participantId,
      contestId:     this.contestId
    });
    this.startHeartbeat();
  }

  private onDisconnect() {
    this.stopHeartbeat();
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.socket.emit("quiz:v1:heartbeat", {
        participantId: this.participantId,
        contestId:     this.contestId
      });
    }, 15_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  submitAnswer(questionId: string, selectedOptionId: string | null, questionIndex: number) {
    this.socket.emit("quiz:v1:answer", {
      participantId: this.participantId,
      contestId:     this.contestId,
      questionId,
      selectedOptionId,
      questionIndex
    });
  }

  submitQuiz() {
    this.socket.emit("quiz:v1:submit", {
      participantId: this.participantId,
      contestId:     this.contestId
    });
  }

  sendProctoringEvent(type: string, severity: number, metadata?: object) {
    this.socket.emit("quiz:v1:proctoring_event", {
      participantId: this.participantId,
      contestId:     this.contestId,
      type, severity, metadata
    });
  }

  disconnect() {
    this.stopHeartbeat();
    this.socket.disconnect();
  }

  // Implement these handlers in your UI layer:
  private handleJoinAck(data: any) { /* update quiz state */ }
  private handleQuizStarted(data: any) { /* transition to quiz UI */ }
  private handleAnswerAck(data: any) { /* show saved indicator */ }
  private handleSubmitAck(data: any) { /* navigate to success screen */ }
  private handleAutoSubmit(data: any) { /* navigate to auto-submitted screen */ }
  private handleTimeWarning(data: any) { /* show toast */ }
  private handleProctoringAlert(data: any) { /* show warning modal */ }
  private handleDisqualified(data: any) { /* navigate to disqualified screen */ }
}
```
