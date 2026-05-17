# 👥 Participant Module API Documentation

This document covers administrative endpoints for managing users who have registered for a specific contest. While registration is handled by the Contest module, management and auditing are handled here.

---

## 📑 Table of Contents
1. [List Participants](#1-list-participants)
2. [Get Participant Details](#2-get-participant-details)
3. [Disqualify Participant](#3-disqualify-participant)

---

## 1. List Participants
Fetch all users registered for a contest. Includes their current status (e.g., `REGISTERED`, `IN_PROGRESS`, `SUBMITTED`, `DISQUALIFIED`).

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

## 2. Get Participant Details
Retrieve detailed information about a participant's engagement with a specific contest.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/participants/:participantId`
- **Auth:** Admin

---

## 3. Disqualify Participant
Manually remove a participant from the contest for a specific reason. This is irreversible and prevents them from joining the live quiz or accessing results.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/contests/:contestId/participants/:participantId/disqualify`
- **Auth:** Admin

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `reason` | `string` | Yes | Min 5, Max 500 characters. |

```json
{
  "reason": "Violation of proctoring rules: Multiple face detections."
}
```
