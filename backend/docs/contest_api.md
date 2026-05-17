# 🏆 Contest Module API Documentation

This document provides a detailed breakdown of all 13 routes within the Contest module. This module manages the lifecycle of a contest, from creation and question assignment to participant registration and results declaration.

---

## 📑 Table of Contents
1. [Create Contest](#1-create-contest)
2. [List Contests](#2-list-contests)
3. [Register Participant (Public)](#3-register-participant-public)
4. [Get Contest by ID](#4-get-contest-by-id)
5. [Update Contest](#5-update-contest)
6. [Delete Contest](#6-delete-contest)
7. [Publish Contest](#7-publish-contest)
8. [List Participants (Admin)](#8-list-participants-admin)
9. [Get Participant Details (Admin)](#9-get-participant-details-admin)
10. [Disqualify Participant (Admin)](#10-disqualify-participant-admin)
11. [Trigger Evaluation](#11-trigger-evaluation)
12. [Declare Results](#12-declare-results)
13. [Get Leaderboard (Public)](#13-get-leaderboard-public)

---

## 1. Create Contest
Initialize a new contest in `DRAFT` status.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | Yes | Minimum 3 characters. |
| `description` | `string` | No | Short summary. |
| `details` | `string` | No | Full markdown description. |
| `topics` | `string[]` | No | List of categories/topics. |
| `rules` | `string[]` | No | List of rules for the quiz. |
| `paymentEnabled`| `boolean` | No | Default: `false`. |
| `paymentConfig` | `object` | No | Required if payment enabled. Contains `amount` (int), `currency` (string). |
| `duration` | `number` | Yes | In minutes (10 - 480). |
| `cutoffScore` | `number` | No | Passing score percentage (0-100). |
| `maxParticipants`| `number` | No | Cap on registrations. |
| `registrationDeadline` | `ISO8601`| Yes | Must be before `startTime`. |
| `startTime` | `ISO8601`| Yes | Must be in the future. |
| `shuffleQuestions`| `boolean` | No | Default: `true`. |
| `shuffleOptions` | `boolean` | No | Default: `false`. |
| `showResultsAfter`| `number` | No | Hours after end time to show leaderboard (default 24). |
| `prizes` | `array` | No | Array of prize objects (rank ranges and amounts). |

```json
{
  "title": "Tech Wizards 2024",
  "description": "Annual tech challenge",
  "duration": 45,
  "startTime": "2024-12-01T10:00:00Z",
  "registrationDeadline": "2024-11-30T23:59:59Z",
  "topics": ["React", "NodeJS", "System Design"],
  "rules": ["No cheating", "Single attempt only"],
  "shuffleQuestions": true
}
```

---

## 2. List Contests
Fetch all contests belonging to the admin's organization.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests`
- **Auth:** Admin (Organization JWT)

### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `status` | `string` | - | Filter by status (`DRAFT`, `PUBLISHED`, `LIVE`, `COMPLETED`, `CANCELLED`). |
| `page` | `number` | `1` | Pagination page. |
| `limit` | `number` | `20` | Results per page (max 100). |
| `search` | `string` | - | Fuzzy search on title. |

---

## 3. Register Participant (Public)
Public endpoint for users to register for a contest via its slug.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/register/:contestSlug`
- **Auth:** **Public** (Requires valid `contactToken` from OTP verification)

### Path Parameters
| Parameter | Description |
| :--- | :--- |
| `:contestSlug` | The URL-friendly version of the contest title (e.g., `tech-wizards-2024`). |

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `contactToken` | `string` | Yes | JWT obtained after verifying Phone/Email OTP. |
| `email` | `string` | Yes | Must match the email in `contactToken`. |
| `firstName` | `string` | Yes | Participant's first name. |
| `phone` | `string` | No | E.164 format (e.g. +919876543210). |
| `college` | `string` | No | Name of institution. |
| `city` | `string` | No | Location details. |

```json
{
  "contactToken": "eyJhbG...",
  "email": "alice@example.com",
  "firstName": "Alice",
  "lastName": "Smith",
  "college": "MIT",
  "city": "Boston"
}
```

---

## 4. Get Contest by ID
Retrieve full configuration and status of a single contest.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId`
- **Auth:** Admin

---

## 5. Update Contest
Modify contest settings. Only allowed while status is `DRAFT`.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/contests/:contestId`
- **Auth:** Admin
- **Request Body:** Partial of [Create Contest](#1-create-contest).

---

## 6. Delete Contest
Soft-delete a contest. Only allowed if status is `DRAFT`.

- **Method:** `DELETE`
- **Endpoint:** `/api/v1/contests/:contestId`
- **Auth:** Admin

---

## 7. Publish Contest
Moves a contest from `DRAFT` to `PUBLISHED`. Generates the `joinCode` and makes the contest available for public registration.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/:contestId/publish`
- **Auth:** Admin

---

## 8. List Participants (Admin)
List all users who have registered for a specific contest.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/participants`
- **Auth:** Admin

### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `status` | `string` | - | Filter by `REGISTERED`, `DISQUALIFIED`, etc. |
| `page` | `number` | `1` | Pagination page. |
| `limit` | `number` | `50` | Results per page. |

---

## 9. Get Participant Details (Admin)
Get detailed info about a specific participant, including their registration status and registration reference.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/participants/:participantId`
- **Auth:** Admin

---

## 10. Disqualify Participant (Admin)
Manually disqualify a participant. Prevents them from joining the quiz or receiving a certificate.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/contests/:contestId/participants/:participantId/disqualify`
- **Auth:** Admin

### Request Body (JSON)
```json
{
  "reason": "Suspicious activity detected in proctoring logs."
}
```

---

## 11. Trigger Evaluation
Manually trigger the evaluation engine for all submitted entries. This calculates scores based on correct/incorrect answers and timing.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/:contestId/evaluate`
- **Auth:** Admin

---

## 12. Declare Results
Official declaration of results. Moves the contest to `COMPLETED` and publishes the final rankings to the public leaderboard.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/:contestId/declare-results`
- **Auth:** Admin

---

## 13. Get Leaderboard (Public)
Retrieve the rankings and scores for a contest.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/leaderboard`
- **Auth:** **Public** (But only works if results have been declared)

### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `number` | `1` | Pagination page. |
| `limit` | `number` | `50` | Results per page. |
