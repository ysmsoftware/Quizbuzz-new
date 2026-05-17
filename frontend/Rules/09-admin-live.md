# 09 — Admin Live Monitoring (WebSocket)
**Wave 7 | Depends on: Wave 1 (admin login), Wave 6 (quiz running)**

During a live contest, the admin dashboard connects to a separate Socket.IO namespace to monitor participants in real time. This is a separate connection from the participant socket — admin uses their `accessToken` cookie for auth, not a `socketToken`.

---

## Connection Setup

```ts
import { io, Socket } from "socket.io-client";

const adminSocket: Socket = io("wss://your-domain.com/admin", {
  path: "/socket.io",
  auth: {
    token: adminAccessToken   // the admin's JWT accessToken from login
  },
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 5
});
```

**Namespace:** `/admin`

---

## Events the Admin Client EMITS

### `admin:v1:subscribe_contest`

Subscribe to real-time updates for a specific contest. Call immediately after connecting. Only one contest subscription per connection.

```ts
adminSocket.emit("admin:v1:subscribe_contest", {
  contestId:      "01HCONT...",
  organizationId: "01HORG..."
});
```

---

### `admin:v1:start_quiz`

Manually start the quiz for all waiting participants. Use this if the admin wants to start early or the scheduled timer is overridden.

```ts
adminSocket.emit("admin:v1:start_quiz", {
  contestId: "01HCONT..."
});
```

---

### `admin:v1:broadcast`

Send a message to all participants currently in the quiz room (e.g. announcements, technical issue notices).

```ts
adminSocket.emit("admin:v1:broadcast", {
  contestId: "01HCONT...",
  message:   "There will be a 5-minute break. Please wait.",
  type:      "ANNOUNCEMENT"   // "ANNOUNCEMENT" | "WARNING" | "INFO"
});
```

---

### `admin:v1:kick_participant`

Remove a participant from the quiz room mid-contest. Does not disqualify them — they can rejoin unless the admin also calls the disqualify HTTP endpoint.

```ts
adminSocket.emit("admin:v1:kick_participant", {
  contestId:     "01HCONT...",
  participantId: "01HPART..."
});
```

---

### `admin:v1:ban_participant`

Disqualify a participant and kick them from the quiz room. This is permanent.

```ts
adminSocket.emit("admin:v1:ban_participant", {
  contestId:     "01HCONT...",
  participantId: "01HPART...",
  reason:        "Caught sharing screen"
});
```

---

### `admin:v1:request_snapshot`

Request a camera snapshot from a specific participant's proctoring feed.

```ts
adminSocket.emit("admin:v1:request_snapshot", {
  contestId:     "01HCONT...",
  participantId: "01HPART..."
});
```

---

## Events the Admin Client RECEIVES

### `admin:v1:subscribed`

Confirmation of subscription, with the full live contest state.

```ts
adminSocket.on("admin:v1:subscribed", (data) => {
  // Full snapshot of current contest state
});
```

**Payload:**

```json
{
  "contestId": "01HCONT...",
  "status": "LIVE",
  "startedAt": "2025-06-15T10:00:00.000Z",
  "totalRegistered": 142,
  "totalCheckedIn": 138,
  "totalInQuiz": 127,
  "totalSubmitted": 9,
  "totalDisqualified": 2,
  "participants": [
    {
      "participantId": "01HPART...",
      "name": "Rahul Mehta",
      "status": "IN_QUIZ",
      "currentQuestionIndex": 12,
      "totalQuestions": 50,
      "answeredCount": 10,
      "lastHeartbeatAt": "2025-06-15T10:18:45.000Z",
      "violationCount": 0,
      "isFlagged": false
    }
  ]
}
```

---

### `admin:v1:participant_joined`

Fired when a participant successfully joins the quiz room.

```ts
adminSocket.on("admin:v1:participant_joined", (data) => {
  // { participantId, name, joinedAt, status: "IN_QUIZ" }
  addParticipantToList(data);
});
```

---

### `admin:v1:participant_progress`

Fired periodically as participants answer questions. Use this to update the live progress table.

```ts
adminSocket.on("admin:v1:participant_progress", (data) => {
  updateParticipantRow(data);
});
```

**Payload:**

```json
{
  "participantId": "01HPART...",
  "currentQuestionIndex": 23,
  "answeredCount": 20,
  "skippedCount": 3,
  "lastActivityAt": "2025-06-15T10:22:10.000Z"
}
```

---

### `admin:v1:participant_submitted`

Fired when a participant submits (manually or auto).

```ts
adminSocket.on("admin:v1:participant_submitted", (data) => {
  // { participantId, name, submittedAt, reason: "manual" | "time_expired" }
  markParticipantAsSubmitted(data);
});
```

---

### `admin:v1:participant_disconnected`

Fired when a participant's socket disconnects (they closed the tab, lost internet, etc.).

```ts
adminSocket.on("admin:v1:participant_disconnected", (data) => {
  // { participantId, disconnectedAt }
  markParticipantAsDisconnected(data);
});
```

---

### `admin:v1:proctoring_violation`

Fired in real time when a proctoring event is logged for any participant.

```ts
adminSocket.on("admin:v1:proctoring_violation", (data) => {
  showViolationAlert(data);
});
```

**Payload:**

```json
{
  "participantId": "01HPART...",
  "name": "Rahul Mehta",
  "type": "TAB_SWITCH",
  "severity": 2,
  "violationCount": 5,
  "trustScore": 72.5,
  "isFlagged": false,
  "threshold": 10,
  "occurredAt": "2025-06-15T10:24:00.000Z"
}
```

---

### `admin:v1:participant_flagged`

Fired when a participant's violation score crosses the proctoring threshold. Requires admin action.

```ts
adminSocket.on("admin:v1:participant_flagged", (data) => {
  // { participantId, name, violationScore, trustScore }
  showFlaggedAlert(data);
  highlightParticipantRow(data.participantId, "red");
});
```

---

### `admin:v1:live_stats`

Broadcast every 10 seconds with aggregate contest statistics for the dashboard summary cards.

```ts
adminSocket.on("admin:v1:live_stats", (data) => {
  updateDashboardStats(data);
});
```

**Payload:**

```json
{
  "contestId": "01HCONT...",
  "totalInQuiz": 121,
  "totalSubmitted": 17,
  "totalDisqualified": 2,
  "totalDisconnected": 4,
  "averageProgress": 0.48,
  "timeRemainingMs": 2847000,
  "updatedAt": "2025-06-15T10:28:00.000Z"
}
```

---

### `admin:v1:quiz_ended`

Fired when all participants have submitted or the contest time expires completely.

```ts
adminSocket.on("admin:v1:quiz_ended", (data) => {
  // { contestId, endedAt, totalSubmitted, totalAbsent }
  showEndedBanner(data);
  // Enable the "Trigger Evaluation" button
});
```

---

## Recommended Admin Live Dashboard UI Layout

```
┌─────────────────────────────────────────────────────┐
│  DSA Championship 2025 — LIVE  │  ⏱ 47:32 remaining │
├────────────┬────────────┬────────────┬───────────────┤
│ In Quiz    │ Submitted  │ Disconnected│   Flagged     │
│    121     │    17      │     4       │     2         │
├─────────────────────────────────────────────────────┤
│ Participant Progress Table                           │
│                                                      │
│ Name         │ Progress    │ Answered │ Status │ Flag │
│ Rahul Mehta  │ ███░░ 48%  │ 24/50    │ Active │  -   │
│ Priya Singh  │ ████░ 76%  │ 38/50    │ Active │  ⚠   │
│ ...          │ ...         │ ...      │ ...    │ ...  │
├─────────────────────────────────────────────────────┤
│ Violation Feed (real-time)                          │
│ 10:24 — Rahul Mehta — TAB_SWITCH (severity: 2)     │
│ 10:22 — Priya Singh — FACE_NOT_DETECTED (sev: 3)   │
└─────────────────────────────────────────────────────┘
```

---

## Admin HTTP Actions During Live Quiz

While the WebSocket handles real-time monitoring, these HTTP endpoints are called for admin actions during the live quiz:

| Action | HTTP Call |
|--------|-----------|
| Disqualify participant | `PATCH /contests/:contestId/participants/:participantId/disqualify` |
| View participant detail | `GET /contests/:contestId/participants/:participantId` |
| View proctoring events | `GET /proctoring/:contestId/events` |
| View flagged participants | `GET /proctoring/:contestId/flagged` |

See `03-contests.md` and `12-proctoring.md` for full details on those endpoints.
