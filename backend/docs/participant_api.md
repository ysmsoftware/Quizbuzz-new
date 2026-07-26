# 👥 Participant Module API Documentation

This document covers administrative endpoints for managing users who have registered for a specific contest. While registration is handled by the Contest module, management and auditing are handled here.

---

## 📑 Table of Contents
1. [List Participants](#1-list-participants)
2. [Get Participant Status Summary](#2-get-participant-status-summary)
3. [Bulk Status Override](#3-bulk-status-override)
4. [Get Participant Details](#4-get-participant-details)
5. [Disqualify Participant](#5-disqualify-participant)
6. [Trigger Export](#6-trigger-export)
7. [Get Export Status](#7-get-export-status)

---

## 1. List Participants
**Description:** Fetch all users registered for a contest.
**Business Logic:** Queries the database for all participants linked to a given contest ID, supporting filters by status and pagination for the admin interface.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/participants`
- **Auth:** Admin (Organization JWT)

### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `status` | `string` | - | Filter by lifecycle status. |
| `page` | `number` | `1` | |
| `limit` | `number` | `50` | |
| `search` | `string` | - | Search by name or email. |

**Response Body:**
```json
{
  "success": true,
  "data": {
    "participants": [
      {
        "id": "part_123",
        "status": "REGISTERED",
        "registrationRef": "QB-2024-X8Y9",
        "contact": {
          "firstName": "John",
          "email": "john@example.com"
        }
      }
    ],
    "pagination": { "total": 1, "totalPages": 1 }
  }
}
```

---

## 2. Get Participant Status Summary
**Description:** Get aggregated counts of participants grouped by their current status.
**Business Logic:** Calculates the distribution of participants across all possible lifecycle states (e.g., REGISTERED, IN_PROGRESS, SUBMITTED) for dashboard analytics.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/participants/status-summary`
- **Auth:** Admin (Organization JWT)

---

## 3. Bulk Status Override
**Description:** Forcefully update the status of multiple participants simultaneously.
**Business Logic:** Primarily used by admins to resolve systemic issues by bulk transitioning participants (e.g. from IN_PROGRESS to SUBMITTED if a contest crashes).

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/:contestId/participants/bulk-status`
- **Auth:** Admin (Organization JWT)

---

## 4. Get Participant Details
**Description:** Retrieve detailed information about a participant's engagement with a specific contest.
**Business Logic:** Fetches the comprehensive registration record, including proctoring snapshots, answers submitted, and metadata related to a specific participant.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/participants/:participantId`
- **Auth:** Admin (Organization JWT)

---

## 5. Disqualify Participant
**Description:** Manually remove a participant from the contest for a specific reason.
**Business Logic:** Updates the participant status to DISQUALIFIED, which prevents them from resuming the quiz, appearing on the leaderboard, or receiving a certificate.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/contests/:contestId/participants/:participantId/disqualify`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `reason` | `string` | Yes | Min 5, Max 500 characters. |

```json
{
  "reason": "Violation of proctoring rules: Multiple face detections."
}
```

---

## 6. Trigger Export
**Description:** Initiate a background job to export participant data to a CSV.
**Business Logic:** Enqueues an asynchronous task to generate a CSV file containing all participant details and responses, preventing long-running requests from timing out.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/:contestId/participants/export`
- **Auth:** Admin (Organization JWT)

---

## 7. Get Export Status
**Description:** Check the status or retrieve the download link for a triggered CSV export.
**Business Logic:** Queries the export job state, returning `PENDING` if it's still generating, or a signed cloud storage URL once the CSV file is ready for download.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/participants/export/:exportId`
- **Auth:** Admin (Organization JWT)
