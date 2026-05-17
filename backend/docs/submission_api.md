# 📥 Submission Module API Documentation

This document covers all 8 endpoints for managing participant submissions, grading, and status tracking.

---

## 📑 Table of Contents
1. [Submit Quiz (Participant)](#1-submit-quiz-participant)
2. [Get My Submission (Participant)](#2-get-my-submission-participant)
3. [List Contest Submissions (Admin)](#3-list-contest-submissions-admin)
4. [Get Submission Stats (Admin)](#4-get-submission-stats-admin)
5. [Get Submission by ID (Admin)](#5-get-submission-by-id-admin)
6. [Bulk Evaluation (Admin)](#6-bulk-evaluation-admin)
7. [Invalidate Submission (Admin)](#7-invalidate-submission-admin)
8. [List Contact Submissions (Admin)](#8-list-contact-submissions-admin)

---

## 1. Submit Quiz (Participant)
The final step for a participant. Mark the quiz as complete and finalize answers.

- **Method:** `POST`
- **Endpoint:** `/api/v1/:contestId/submit`
- **Auth:** Public / Participant (Token based)
- **Headers:** `X-Idempotency-Key` (Recommended to prevent duplicate submissions)

---

## 2. Get My Submission (Participant)
Check if a submission was successful and retrieve basic results (if configured by the admin to be visible).

- **Method:** `GET`
- **Endpoint:** `/api/v1/submissions/me/:participantId`
- **Auth:** Public / Participant

---

## 3. List Contest Submissions (Admin)
Audit and filter all entries for a specific contest.

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/contests/:contestId/submissions`
- **Auth:** Admin (Organization JWT)

### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `status` | `enum` | - | `PENDING`, `SUBMITTED`, `EVALUATED`, `INVALIDATED`. |
| `minScore` | `number` | - | Filter by performance. |

---

## 4. Get Submission Stats (Admin)
Retrieve a breakdown of submission counts per status for a contest.

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/contests/:contestId/submissions/stats`
- **Auth:** Admin

---

## 5. Get Submission by ID (Admin)
Detailed view of a single participant's work, including specific answers and question-level scores.

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/submissions/:submissionId`
- **Auth:** Admin

---

## 6. Bulk Evaluation (Admin)
Trigger the grading engine to process all submitted quizzes for a contest. This uses background workers.

- **Method:** `POST`
- **Endpoint:** `/api/v1/admin/contests/:contestId/submissions/evaluate`
- **Auth:** Admin

---

## 7. Invalidate Submission (Admin)
Manually mark a submission as invalid (e.g., due to cheating or admin policy). This prevents the score from being included in leaderboards.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/admin/submissions/:submissionId/invalidate`
- **Auth:** Admin

---

## 8. List Contact Submissions (Admin)
Historical view of all quizzes taken by a specific contact across all contests in the organization.

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/contacts/:contactId/submissions`
- **Auth:** Admin
