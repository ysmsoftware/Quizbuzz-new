# 11 — Analytics
**Wave 8 | Depends on: Wave 3 (contests exist)**

Analytics endpoints power the admin dashboard charts and summary cards. Snapshots are pre-computed every 15 minutes by the analytics worker — responses are fast because they read from `ContestAnalyticsSnapshot`, not live queries.

Base path: `/api/v1/analytics`

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| GET | `/analytics/:contestId` | ✓ | Full analytics snapshot for a contest |
| GET | `/analytics/:contestId/live` | ✓ | Real-time live count from Redis |
| GET | `/analytics/:contestId/score-distribution` | ✓ | Score histogram data |
| POST | `/analytics/:contestId/refresh` | ✓ | Force refresh snapshot (admin action) |

---

## GET `/analytics/:contestId`

Returns the pre-computed analytics snapshot. Refreshed every 15 minutes automatically by the analytics worker.

**Auth required:** ✓  
**Rate limited:** 30 requests per minute per org (analytics limiter)

### Response `200`

```json
{
  "success": true,
  "data": {
    "contestId": "01HCONT...",
    "snapshotAt": "2025-06-15T10:15:00.000Z",
    "registrations": {
      "total": 142,
      "paid": 138,
      "free": 4,
      "refunded": 2
    },
    "revenue": {
      "total": "27562.00",
      "currency": "INR",
      "averagePerParticipant": "199.00"
    },
    "participation": {
      "totalCheckedIn": 138,
      "totalJoined": 127,
      "totalSubmitted": 124,
      "totalAbsent": 4,
      "submissionRate": 0.873
    },
    "scores": {
      "average": "68.42",
      "highest": "196.00",
      "lowest": "12.00",
      "median": "72.00",
      "passingCount": 98,
      "failingCount": 26
    },
    "timing": {
      "averageTimeTakenSecs": 4721,
      "fastestTimeSecs": 1840,
      "slowestTimeSecs": 5395
    }
  }
}
```

---

## GET `/analytics/:contestId/live`

Returns real-time participant count pulled directly from Redis heartbeat data. Use this for the "Active Now" counter on the admin live dashboard. Lightweight — does not hit the DB.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": {
    "activeNow": 121,
    "inWaitingRoom": 14,
    "inQuiz": 107,
    "submittedLast5Min": 8,
    "updatedAt": "2025-06-15T10:28:47.000Z"
  }
}
```

---

## GET `/analytics/:contestId/score-distribution`

Returns bucketed score data for rendering a histogram chart showing how scores are distributed.

**Auth required:** ✓

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `buckets` | number | 10 | Number of histogram buckets (5–20) |

### Response `200`

```json
{
  "success": true,
  "data": {
    "buckets": [
      { "range": "0–20",   "count": 4  },
      { "range": "20–40",  "count": 11 },
      { "range": "40–60",  "count": 28 },
      { "range": "60–80",  "count": 52 },
      { "range": "80–100", "count": 29 }
    ],
    "totalEvaluated": 124,
    "cutoffScore": 60,
    "passCount": 81,
    "failCount": 43
  }
}
```

Render this as a bar chart using Recharts, Chart.js, or similar.

---

## POST `/analytics/:contestId/refresh`

Force-trigger a snapshot recomputation outside the normal 15-minute cycle. Useful after evaluation completes.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "message": "Analytics snapshot queued for refresh",
  "data": { "jobId": "analytics-01HCONT..." }
}
```

The snapshot will be updated within a few seconds. Poll `GET /analytics/:contestId` after a 3-second delay to get the fresh data.

---

## Frontend Dashboard Integration Pattern

```ts
// On contest detail page load
async function loadAnalytics(contestId: string) {
  const [snapshot, live] = await Promise.all([
    apiFetch(`/api/v1/analytics/${contestId}`),
    apiFetch(`/api/v1/analytics/${contestId}/live`)
  ]);

  // Render summary cards from snapshot
  renderSummaryCards(snapshot.data);

  // Render live counter separately (refresh every 10s during LIVE status)
  renderLiveCounter(live.data.activeNow);
}

// Poll live count during active quiz
function startLivePolling(contestId: string) {
  return setInterval(async () => {
    const live = await apiFetch(`/api/v1/analytics/${contestId}/live`);
    renderLiveCounter(live.data.activeNow);
  }, 10_000);
}
```
