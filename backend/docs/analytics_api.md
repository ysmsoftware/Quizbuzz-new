# 📊 Analytics Module API Documentation

This document covers endpoints for retrieving performance insights, leaderboards, and real-time monitoring data for contests.

---

## 📑 Table of Contents
1. [Get Contest Analytics](#1-get-contest-analytics)
2. [Get Live Analytics](#2-get-live-analytics)
3. [Refresh Analytics](#3-refresh-analytics)

---

## 1. Get Contest Analytics
Retrieve a comprehensive report of a completed or ongoing contest. Includes average scores, completion rates, and the full leaderboard.

- **Method:** `GET`
- **Endpoint:** `/api/v1/analytics/:id`
- **Auth:** Admin (Organization JWT)

### Response Body Snippet
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalParticipants": 150,
      "averageScore": 75.5,
      "completionRate": "92%",
      "averageTimeTaken": "12m 30s"
    },
    "leaderboard": [
      { "rank": 1, "name": "Alice", "score": 100, "timeTaken": 600 },
      { "rank": 2, "name": "Bob", "score": 95, "timeTaken": 550 }
    ]
  }
}
```

---

## 2. Get Live Analytics
Fetch real-time participation statistics during a live quiz. Useful for "War Room" dashboards.

- **Method:** `GET`
- **Endpoint:** `/api/v1/analytics/:id/live`
- **Auth:** Admin

### Data Points Returned:
- **Active Sessions:** Number of participants currently taking the quiz.
- **Submissions per Minute:** Velocity of quiz completions.
- **Violation Alerts:** Count of proctoring flags raised in the last 5 minutes.
- **Question Difficulty Heatmap:** Which questions are currently being skipped or answered incorrectly the most.

---

## 3. Refresh Analytics
Force the system to re-calculate the leaderboard and aggregated statistics. This is typically handled by background workers but can be manually triggered if data looks stale.

- **Method:** `POST`
- **Endpoint:** `/api/v1/analytics/:id/refresh`
- **Auth:** Admin
