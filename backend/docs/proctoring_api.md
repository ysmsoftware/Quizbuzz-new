# 🛡️ Proctoring Module API Documentation

This document covers all 4 administrative endpoints for monitoring quiz integrity and managing proctoring violations.

---

## 📑 Table of Contents
1. [Contest Proctoring Overview](#1-contest-proctoring-overview)
2. [List Flagged Participants](#2-list-flagged-participants)
3. [Get Participant Violation Events](#3-get-participant-violation-events)
4. [Update Violation Status](#4-update-violation-status)

---

## 1. Contest Proctoring Overview
Get a high-level summary of integrity alerts for a specific contest.

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
Retrieve a list of participants who have exceeded the violation threshold or have specific high-severity flags.

- **Method:** `GET`
- **Endpoint:** `/api/v1/proctoring/contests/:contestId/flagged`
- **Auth:** Admin

---

## 3. Get Participant Violation Events
Audit the specific timeline of violations for a single participant. This includes timestamps and metadata (e.g. coordinates of face detection).

- **Method:** `GET`
- **Endpoint:** `/api/v1/proctoring/contests/:contestId/participants/:participantId/events`
- **Auth:** Admin

### Violation Types:
- `TAB_SWITCH`: Detected when the browser tab loses focus.
- `FULLSCREEN_EXIT`: Detected when the user exits the mandatory fullscreen mode.
- `MULTIPLE_FACES`: Detected by AI if more than one person is visible.
- `NO_FACE`: Detected if the participant leaves the camera view.
- `UNKNOWN_DEVICE`: Detected if a second session is attempted.

---

## 4. Update Violation Status
Manually dismiss or confirm a violation flag. This can be used by human proctors to override AI detections (e.g., dismissing a "Multiple Faces" flag if it was just a poster in the background).

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/proctoring/scores/:scoreId/status`
- **Auth:** Admin

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
