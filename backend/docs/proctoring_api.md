# 🛡️ Proctoring Module API Documentation

This document covers all administrative endpoints for monitoring quiz integrity and managing proctoring violations.

---

## 📑 Table of Contents
1. [Contest Proctoring Overview](#1-contest-proctoring-overview)
2. [List Flagged Participants](#2-list-flagged-participants)
3. [Get Participant Violation Events](#3-get-participant-violation-events)
4. [Update Violation Status](#4-update-violation-status)
5. [Get Participant Captures](#5-get-participant-captures)

---

## 1. Contest Proctoring Overview
**Description:** Get a high-level summary of integrity alerts for a specific contest.
**Business Logic:** Aggregates proctoring data across all participants in a contest, returning total violation counts and a breakdown of the top violation types to give admins a bird's-eye view.

- **Method:** `GET`
- **Endpoint:** `/api/v1/proctoring/contests/:contestId/overview`
- **Auth:** Admin (Organization JWT)

### Response Body Snippet
```json
{
  "totalViolations": 45,
  "flaggedParticipantsCount": 12,
  "topViolationTypes": [
    { "type": "TAB_SWITCH", "count": 30 },
    { "type": "MULTIPLE_FACES", "count": 10 }
  ]
}
```

---

## 2. List Flagged Participants
**Description:** Retrieve a list of participants who have exceeded the violation threshold.
**Business Logic:** Filters the participant list for a contest to only include those whose proctoring trust score has dropped below the acceptable threshold or who have high-severity flags.

- **Method:** `GET`
- **Endpoint:** `/api/v1/proctoring/contests/:contestId/flagged`
- **Auth:** Admin (Organization JWT)

---

## 3. Get Participant Violation Events
**Description:** Audit the specific timeline of violations for a single participant.
**Business Logic:** Fetches the chronological log of all proctoring events triggered by a participant during their quiz session, including metadata like timestamps.

- **Method:** `GET`
- **Endpoint:** `/api/v1/proctoring/contests/:contestId/participants/:participantId/events`
- **Auth:** Admin (Organization JWT)

### Violation Types:
- `TAB_SWITCH`: Detected when the browser tab loses focus.
- `FULLSCREEN_EXIT`: Detected when the user exits the mandatory fullscreen mode.
- `MULTIPLE_FACES`: Detected by AI if more than one person is visible.
- `NO_FACE`: Detected if the participant leaves the camera view.
- `UNKNOWN_DEVICE`: Detected if a second session is attempted.

---

## 4. Update Violation Status
**Description:** Manually dismiss or confirm a violation flag.
**Business Logic:** Allows human proctors to override AI detections, updating the internal status of a flagged proctoring score record and optionally leaving notes.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/proctoring/scores/:scoreId/status`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `status` | `enum` | Yes | `CONFIRMED`, `DISMISSED`. |
| `notes` | `string` | No | Reason for the override. |

```json
{
  "status": "DISMISSED",
  "notes": "Verified as false positive; user was adjusting glasses."
}
```

---

## 5. Get Participant Captures
**Description:** Retrieve webcam snapshots captured during a participant's quiz session.
**Business Logic:** Returns the securely stored image captures associated with specific points in time or specific violation events for a participant to aid human verification.

- **Method:** `GET`
- **Endpoint:** `/api/v1/proctoring/contests/:contestId/participants/:participantId/captures`
- **Auth:** Admin (Organization JWT)
