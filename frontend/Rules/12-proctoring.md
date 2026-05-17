# 12 — Proctoring
**Wave 8 | Depends on: Wave 6 (quiz running or completed)**

Base path: `/api/v1/proctoring`

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| GET | `/proctoring/:contestId/overview` | ✓ | Aggregate proctoring summary |
| GET | `/proctoring/:contestId/flagged` | ✓ | List flagged participants |
| GET | `/proctoring/:contestId/events` | ✓ | Full violation event log |
| GET | `/proctoring/:contestId/participant/:participantId` | ✓ | Single participant proctoring detail |
| PATCH | `/proctoring/:contestId/participant/:participantId/review` | ✓ | Mark violations as reviewed/dismissed |

---

## GET `/proctoring/:contestId/overview`

Summary stats for the proctoring panel header cards.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": {
    "totalParticipants": 127,
    "flaggedCount": 4,
    "disqualifiedCount": 2,
    "cleanCount": 121,
    "averageTrustScore": 91.4,
    "totalViolations": 38,
    "byType": {
      "TAB_SWITCH": 12,
      "FULLSCREEN_EXIT": 8,
      "FACE_NOT_DETECTED": 6,
      "WINDOW_BLUR": 7,
      "MULTIPLE_FACES": 2,
      "GAZE_AWAY": 3
    }
  }
}
```

---

## GET `/proctoring/:contestId/flagged`

List participants whose violation score crossed the threshold. Sorted by trust score ascending (lowest trust first).

**Auth required:** ✓

### Query Parameters

| Param | Type | Default |
|-------|------|---------|
| `page` | number | 1 |
| `limit` | number | 20 |

### Response `200`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "participantId": "01HPART...",
        "totalViolations": 14,
        "highSeverityCount": 3,
        "violationScore": 28.5,
        "trustScore": 42.0,
        "isFlagged": true,
        "flaggedAt": "2025-06-15T10:35:00.000Z",
        "participant": {
          "registrationRef": "QB-2025-00042",
          "status": "SUBMITTED",
          "contact": {
            "firstName": "Demo",
            "lastName": "User",
            "email": "demo@example.com"
          }
        }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 4, "totalPages": 1 }
  }
}
```

---

## GET `/proctoring/:contestId/events`

Full paginated violation event log for the contest.

**Auth required:** ✓

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `participantId` | string | Filter by participant |
| `type` | enum | Filter by violation type |
| `severity` | number | Filter by severity (1, 2, 3) |
| `dismissed` | boolean | Filter dismissed/active violations |
| `page` | number | Default: 1 |
| `limit` | number | Default: 50 |

### Response `200`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "01HPEV...",
        "participantId": "01HPART...",
        "type": "TAB_SWITCH",
        "severity": 2,
        "metadata": { "timestamp": 1718441040000 },
        "occurredAt": "2025-06-15T10:24:00.000Z",
        "reviewedAt": null,
        "dismissed": false,
        "participant": {
          "contact": { "firstName": "Demo", "lastName": "User" }
        }
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 38, "totalPages": 1 }
  }
}
```

---

## GET `/proctoring/:contestId/participant/:participantId`

Complete proctoring profile for one participant — score, all events, and snapshots.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": {
    "score": {
      "totalViolations": 14,
      "highSeverityCount": 3,
      "violationScore": 28.5,
      "trustScore": 42.0,
      "isFlagged": true,
      "flaggedAt": "2025-06-15T10:35:00.000Z"
    },
    "events": [
      {
        "id": "01HPEV...",
        "type": "FACE_NOT_DETECTED",
        "severity": 3,
        "occurredAt": "2025-06-15T10:20:00.000Z",
        "dismissed": false,
        "metadata": {}
      }
    ]
  }
}
```

---

## PATCH `/proctoring/:contestId/participant/:participantId/review`

Admin reviews and either dismisses or confirms violations for a participant. Dismissing reduces the effective violation score.

**Auth required:** ✓

### Request Body

```json
{
  "dismiss": true,
  "eventIds": ["01HPEV1...", "01HPEV2..."],
  "note": "Verified these were accidental — participant has poor internet"
}
```

| Field | Type | Required | Notes |
|-------|------|:---:|-------|
| `dismiss` | boolean | ✓ | `true` = dismiss events, `false` = confirm as violations |
| `eventIds` | string[] | ✓ | Specific event IDs to review |
| `note` | string | ✗ | Internal admin note |

### Response `200`

```json
{
  "success": true,
  "message": "2 violation(s) reviewed",
  "data": {
    "dismissed": 2,
    "newTrustScore": 68.5
  }
}
```
