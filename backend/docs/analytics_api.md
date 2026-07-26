# 📊 Analytics Module API Documentation

This document covers endpoints for retrieving performance insights, leaderboards, and real-time monitoring data for contests.

---

## 📑 Table of Contents
1. [Get Contest Analytics](#1-get-contest-analytics)
2. [Get Live Analytics](#2-get-live-analytics)
3. [Refresh Analytics](#3-refresh-analytics)
4. [Get Score Distribution](#4-get-score-distribution)

---

## 1. Get Contest Analytics
**Description:** Retrieve a comprehensive report of a completed or ongoing contest.
**Business Logic:** Aggregates participant performance, average scores, completion rates, and compiles the full leaderboard. It is used to present the final overview of a contest's success metrics.

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
**Description:** Fetch real-time participation statistics during a live quiz.
**Business Logic:** Queries active sessions, submission velocity, and proctoring alerts over a sliding window. Ideal for live "War Room" dashboards monitoring ongoing contests.

- **Method:** `GET`
- **Endpoint:** `/api/v1/analytics/:id/live`
- **Auth:** Admin (Organization JWT)

### Data Points Returned:
- **Active Sessions:** Number of participants currently taking the quiz.
- **Submissions per Minute:** Velocity of quiz completions.
- **Violation Alerts:** Count of proctoring flags raised in the last 5 minutes.
- **Question Difficulty Heatmap:** Which questions are currently being skipped or answered incorrectly the most.

---

## 3. Refresh Analytics
**Description:** Force the system to recalculate leaderboard and aggregated statistics.
**Business Logic:** Enqueues a background job to rebuild the analytics materialized views and invalidates the current cache. Often triggered manually if live data appears stale.

- **Method:** `POST`
- **Endpoint:** `/api/v1/analytics/:id/refresh`
- **Auth:** Admin (Organization JWT)

---

## 4. Get Score Distribution
**Description:** Retrieve the score distribution histogram for a contest.
**Business Logic:** Calculates the number of participants falling into specific score buckets (e.g., 0-10, 11-20). Used to visualize the performance curve of the cohort.

- **Method:** `GET`
- **Endpoint:** `/api/v1/analytics/:id/score-distribution`
- **Auth:** Admin (Organization JWT)
