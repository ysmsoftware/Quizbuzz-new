# 03 — Contests
**Wave 3 | Depends on: Wave 1 (login), Wave 2 (org)**

Base path: `/api/v1/contests`  
The `organizationId` is extracted from the admin's JWT automatically — you never pass it in the request body.

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| POST | `/contests` | ✓ | Create a new contest |
| GET | `/contests` | ✓ | List all contests (paginated) |
| GET | `/contests/:contestId` | ✓ | Get single contest detail |
| PATCH | `/contests/:contestId` | ✓ | Update contest (DRAFT only) |
| DELETE | `/contests/:contestId` | ✓ | Soft-delete contest (DRAFT only) |
| POST | `/contests/:contestId/publish` | ✓ | Publish contest (starts lifecycle) |
| GET | `/contests/:contestId/participants` | ✓ | List participants (paginated) |
| GET | `/contests/:contestId/participants/:participantId` | ✓ | Get participant detail |
| PATCH | `/contests/:contestId/participants/:participantId/disqualify` | ✓ | Disqualify participant |
| POST | `/contests/:contestId/evaluate` | ✓ | Trigger bulk evaluation |
| POST | `/contests/:contestId/declare-results` | ✓ | Publish leaderboard |
| GET | `/contests/:contestId/leaderboard` | ✗ | Public leaderboard |
| POST | `/contests/register/:contestSlug` | ✗ | Public participant registration |

---

## Contest Status Lifecycle

```
DRAFT → PUBLISHED → REGISTRATION_CLOSED → LIVE → EVALUATION → RESULTS_OUT → COMPLETED
                                                                       ↑
                                                              CANCELLED (from any)
```

Only `DRAFT` contests can be edited or deleted. Publishing triggers all BullMQ scheduled jobs automatically.

---

## POST `/contests`

Create a new contest in `DRAFT` status.

**Auth required:** ✓

### Request Body

```json
{
  "title": "DSA Championship 2025",
  "description": "A competitive quiz on Data Structures and Algorithms",
  "details": "## About\nThis quiz covers arrays, graphs, DP and more.",
  "topics": ["DSA", "Algorithms", "Data Structures"],
  "rules": [
    "No external resources allowed",
    "One submission per participant",
    "Results in 24 hours"
  ],
  "paymentEnabled": true,
  "paymentConfig": {
    "amount": 199,
    "currency": "INR",
    "description": "DSA Championship entry fee"
  },
  "duration": 90,
  "cutoffScore": 60,
  "maxParticipants": 500,
  "registrationDeadline": "2025-06-10T18:00:00.000Z",
  "startTime": "2025-06-15T10:00:00.000Z",
  "shuffleQuestions": true,
  "shuffleOptions": false,
  "showResultsAfter": 24,
  "prizes": [
    {
      "rankFrom": 1,
      "rankTo": 1,
      "amount": 5000,
      "currency": "INR",
      "label": "Gold",
      "benefits": ["Cash prize", "Certificate", "Internship opportunity"]
    },
    {
      "rankFrom": 2,
      "rankTo": 3,
      "amount": 2000,
      "currency": "INR",
      "label": "Silver",
      "benefits": ["Cash prize", "Certificate"]
    }
  ]
}
```

| Field | Type | Rules | Required |
|-------|------|-------|:---:|
| `title` | string | 3–200 chars | ✓ |
| `description` | string | Free text | ✗ |
| `details` | string | Rich text / markdown | ✗ |
| `topics` | string[] | Tag array | ✗ |
| `rules` | string[] | Rule strings | ✗ |
| `paymentEnabled` | boolean | Default: false | ✗ |
| `paymentConfig.amount` | number | Integer (₹, not paise) | If payment enabled |
| `paymentConfig.currency` | string | Default: "INR" | ✗ |
| `duration` | number | Minutes, 10–480 | ✓ |
| `cutoffScore` | number | 0–100 (percentage) | ✗ |
| `maxParticipants` | number | Positive integer | ✗ |
| `registrationDeadline` | ISO date | Must be before startTime | ✓ |
| `startTime` | ISO date | Must be in future | ✓ |
| `shuffleQuestions` | boolean | Default: true | ✗ |
| `shuffleOptions` | boolean | Default: false | ✗ |
| `showResultsAfter` | number | Hours 0–168, default: 24 | ✗ |
| `prizes` | Prize[] | Rank brackets | ✗ |

### Response `201`

```json
{
  "success": true,
  "message": "Contest created",
  "data": {
    "id": "01HCONT...",
    "slug": "dsa-championship-2025",
    "status": "DRAFT",
    "joinCode": null
  }
}
```

---

## GET `/contests`

List all contests for the organization with pagination and filters.

**Auth required:** ✓

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | enum | — | Filter by status |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `search` | string | — | Search by title |

**Status options:** `DRAFT`, `PUBLISHED`, `REGISTRATION_CLOSED`, `LIVE`, `EVALUATION`, `RESULTS_OUT`, `COMPLETED`, `CANCELLED`

### Response `200`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "01HCONT...",
        "title": "DSA Championship 2025",
        "slug": "dsa-championship-2025",
        "status": "PUBLISHED",
        "startTime": "2025-06-15T10:00:00.000Z",
        "endTime": "2025-06-15T11:30:00.000Z",
        "registrationDeadline": "2025-06-10T18:00:00.000Z",
        "duration": 90,
        "paymentEnabled": true,
        "maxParticipants": 500,
        "_count": { "participants": 142, "questions": 50 }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

## GET `/contests/:contestId`

Full detail of a single contest including questions count, payment config, and prizes.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "01HCONT...",
    "title": "DSA Championship 2025",
    "slug": "dsa-championship-2025",
    "status": "DRAFT",
    "description": "...",
    "details": "...",
    "topics": ["DSA", "Algorithms"],
    "rules": ["No external resources allowed"],
    "paymentEnabled": true,
    "paymentConfig": {
      "amount": 199,
      "currency": "INR",
      "description": "Entry fee"
    },
    "duration": 90,
    "cutoffScore": 60,
    "maxParticipants": 500,
    "registrationDeadline": "2025-06-10T18:00:00.000Z",
    "startTime": "2025-06-15T10:00:00.000Z",
    "endTime": "2025-06-15T11:30:00.000Z",
    "joinCode": null,
    "shuffleQuestions": true,
    "shuffleOptions": false,
    "showResultsAfter": 24,
    "prizes": [
      {
        "id": "01HPRZ...",
        "rankFrom": 1,
        "rankTo": 1,
        "amount": "5000",
        "currency": "INR",
        "label": "Gold",
        "benefits": ["Cash prize", "Certificate"]
      }
    ],
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

## PATCH `/contests/:contestId`

Update any field of a contest. Only works when `status === "DRAFT"`.  
All fields are optional — send only what changed.

**Auth required:** ✓

### Request Body

Same shape as `POST /contests` but all fields are optional.

### Response `200`

```json
{
  "success": true,
  "data": { /* Updated contest object */ }
}
```

### Errors

| Status | When |
|--------|------|
| 400 | Contest is not in DRAFT status |
| 404 | Contest not found |

---

## DELETE `/contests/:contestId`

Soft-deletes a contest. Only DRAFT contests can be deleted.  
The data is retained in DB with `isDeleted: true` for audit purposes.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "message": "Contest deleted"
}
```

---

## POST `/contests/:contestId/publish`

Transitions contest from `DRAFT` to `PUBLISHED`.  
This is a critical action that:
- Generates a random 5-character `joinCode`
- Schedules 24h and 1h reminder notifications
- Schedules contest start, time warnings, and auto-submit via BullMQ

**Preconditions (all must pass):**
- Contest must have at least 1 question assigned
- `registrationDeadline` must be in the future
- Contest must be in `DRAFT` status

**Auth required:** ✓

### Request Body

None.

### Response `200`

```json
{
  "success": true,
  "message": "Contest published",
  "data": {
    "status": "PUBLISHED",
    "joinCode": "XK9PQ"
  }
}
```

> Save the `joinCode` — display it to the admin. Participants need it to verify their identity at quiz entry.

### Errors

| Status | When |
|--------|------|
| 400 | No questions assigned |
| 400 | Registration deadline already passed |
| 400 | Contest not in DRAFT status |

---

## GET `/contests/:contestId/participants`

Paginated list of participants for admin management view.

**Auth required:** ✓

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page |
| `status` | enum | — | Filter by participant status |
| `search` | string | — | Search by name or email |

**Status options:** `REGISTERED`, `CHECKED_IN`, `IN_WAITING`, `IN_QUIZ`, `SUBMITTED`, `DISQUALIFIED`, `ABSENT`

### Response `200`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "01HPART...",
        "registrationRef": "QB-2025-00001",
        "status": "REGISTERED",
        "joinedAt": null,
        "contact": {
          "firstName": "Rahul",
          "lastName": "Mehta",
          "email": "rahul@example.com",
          "phone": "+919876543210",
          "college": "IIT Bombay"
        },
        "payment": {
          "status": "SUCCESS",
          "amount": 199,
          "paidAt": "2025-06-01T12:00:00.000Z"
        }
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 142, "totalPages": 3 }
  }
}
```

---

## GET `/contests/:contestId/participants/:participantId`

Full profile of a single participant.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "01HPART...",
    "registrationRef": "QB-2025-00001",
    "status": "SUBMITTED",
    "joinedAt": "2025-06-15T10:02:00.000Z",
    "checkedInAt": "2025-06-15T10:01:00.000Z",
    "contact": {
      "id": "01HCON...",
      "firstName": "Rahul",
      "lastName": "Mehta",
      "email": "rahul@example.com",
      "phone": "+919876543210",
      "college": "IIT Bombay",
      "department": "Computer Science",
      "city": "Mumbai",
      "state": "Maharashtra"
    },
    "payment": {
      "status": "SUCCESS",
      "amount": 199,
      "currency": "INR",
      "paidAt": "2025-06-01T12:00:00.000Z"
    }
  }
}
```

---

## PATCH `/contests/:contestId/participants/:participantId/disqualify`

Disqualify a participant. Sends a disqualification email automatically.

**Auth required:** ✓

### Request Body

```json
{
  "reason": "Suspected use of external resources during quiz"
}
```

### Response `200`

```json
{
  "success": true,
  "message": "Participant disqualified"
}
```

---

## POST `/contests/:contestId/evaluate`

Trigger bulk evaluation for all `SUBMITTED` submissions. Enqueues one evaluation BullMQ job per submission. Idempotent — safe to call multiple times.

**Precondition:** Contest must be in `LIVE` status.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "message": "Evaluation triggered",
  "data": { "status": "EVALUATION" }
}
```

---

## POST `/contests/:contestId/declare-results`

Publishes the leaderboard. Sends a results-notification message to all participants.

**Preconditions:**
- Contest must be in `EVALUATION` status
- Leaderboard must already be built (evaluation must be complete)

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "message": "Results declared",
  "data": { "status": "RESULTS_OUT" }
}
```

### Errors

| Status | When |
|--------|------|
| 400 | Leaderboard not built yet (evaluation still running) |
| 400 | Contest not in EVALUATION status |

---

## GET `/contests/:contestId/leaderboard`

Public endpoint — no auth required. Returns published leaderboard entries.

**Auth required:** No (public)

### Query Parameters

| Param | Type | Default |
|-------|------|---------|
| `page` | number | 1 |
| `limit` | number | 50 |

### Response `200`

```json
{
  "success": true,
  "entries": [
    {
      "rank": 1,
      "score": "95.00",
      "percentage": "95.00",
      "timeTakenSecs": 3240,
      "prizeId": "01HPRZ...",
      "participant": {
        "registrationRef": "QB-2025-00001",
        "contact": {
          "firstName": "Rahul",
          "lastName": "Mehta"
        }
      }
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 142, "totalPages": 3 }
}
```

> Email and phone are NOT included in this response. Only name and registrationRef.
