# 10 — Submissions
**Wave 8 | Depends on: Wave 6 (quiz completed)**

Submission endpoints are admin-only views for inspecting how participants answered questions. Evaluation is triggered from the contest module (see `03-contests.md`).

Base path: `/api/v1/submissions`

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| GET | `/submissions/contests/:contestId` | ✓ | List all submissions for a contest |
| GET | `/submissions/:submissionId` | ✓ | Full submission with answer breakdown |
| GET | `/submissions/participants/:participantId` | ✓ | Get a participant's submission |
| POST | `/submissions/:submissionId/invalidate` | ✓ | Invalidate a submission |

---

## GET `/submissions/contests/:contestId`

Paginated list of all submissions for a contest, with score summary.

**Auth required:** ✓

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `status` | enum | `PENDING`, `SUBMITTED`, `EVALUATED`, `INVALIDATED` |
| `page` | number | Default: 1 |
| `limit` | number | Default: 50 |

### Response `200`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "01HSUB...",
        "participantId": "01HPART...",
        "status": "EVALUATED",
        "submittedAt": "2025-06-15T11:22:00.000Z",
        "evaluatedAt": "2025-06-15T11:25:00.000Z",
        "totalQuestions": 50,
        "attempted": 48,
        "correct": 38,
        "wrong": 10,
        "skipped": 2,
        "score": "144.00",
        "percentage": "72.00",
        "timeTakenSecs": 4920,
        "participant": {
          "registrationRef": "QB-2025-00142",
          "contact": {
            "firstName": "Rahul",
            "lastName": "Mehta",
            "email": "rahul@example.com"
          }
        }
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 138, "totalPages": 3 },
    "summary": {
      "totalSubmitted": 138,
      "totalEvaluated": 124,
      "totalPending": 14,
      "averageScore": "68.42",
      "highestScore": "196.00",
      "lowestScore": "12.00"
    }
  }
}
```

---

## GET `/submissions/:submissionId`

Full submission detail including every question and what the participant answered. Available only after evaluation.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "01HSUB...",
    "status": "EVALUATED",
    "submittedAt": "2025-06-15T11:22:00.000Z",
    "totalQuestions": 50,
    "attempted": 48,
    "correct": 38,
    "wrong": 10,
    "skipped": 2,
    "score": "144.00",
    "percentage": "72.00",
    "timeTakenSecs": 4920,
    "answers": [
      {
        "questionId": "01HQUES1...",
        "selectedOptionId": "01HOPT2...",
        "isCorrect": true,
        "marksAwarded": "4.00",
        "answeredAt": "2025-06-15T10:04:30.000Z",
        "question": {
          "questionText": "What is the time complexity of QuickSort?",
          "difficulty": "MEDIUM",
          "options": [
            { "id": "01HOPT1...", "text": "O(n)",       "isCorrect": false, "position": 0 },
            { "id": "01HOPT2...", "text": "O(n log n)", "isCorrect": true,  "position": 1 },
            { "id": "01HOPT3...", "text": "O(n²)",      "isCorrect": false, "position": 2 },
            { "id": "01HOPT4...", "text": "O(log n)",   "isCorrect": false, "position": 3 }
          ],
          "explanation": "QuickSort has O(n log n) average case..."
        }
      }
    ]
  }
}
```

---

## GET `/submissions/participants/:participantId`

Get the submission for a specific participant. Useful when navigating from the participant list.

**Auth required:** ✓

### Response `200`

Same shape as `GET /submissions/:submissionId`.

---

## POST `/submissions/:submissionId/invalidate`

Mark a submission as invalid (e.g. participant cheated). This removes them from the leaderboard.

**Auth required:** ✓

### Request Body

```json
{
  "reason": "Caught sharing answers via external channel"
}
```

### Response `200`

```json
{
  "success": true,
  "message": "Submission invalidated",
  "data": { "status": "INVALIDATED" }
}
```
