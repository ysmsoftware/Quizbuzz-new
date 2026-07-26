# 📥 Submission Module API Documentation

This document covers all endpoints for managing participant submissions, grading, and status tracking.

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
**Description:** The final step for a participant to manually complete their quiz.
**Business Logic:** Closes the participant's active quiz session, tallies their stored answers from Redis, and transitions their state to SUBMITTED, making them eligible for evaluation.

- **Method:** `POST`
- **Endpoint:** `/api/v1/:contestId/submit`
- **Auth:** Public / Participant (Token based)
- **Headers:** `X-Idempotency-Key` (Recommended to prevent duplicate submissions)

---

## 2. Get My Submission (Participant)
**Description:** Retrieve confirmation and basic result data for a participant's own submission.
**Business Logic:** Returns the submission metadata to the participant, optionally including their final score and certificate link if the admin has published the results.

- **Method:** `GET`
- **Endpoint:** `/api/v1/submissions/me/:participantId`
- **Auth:** Public / Participant

---

## 3. List Contest Submissions (Admin)
**Description:** Audit and filter all entries for a specific contest.
**Business Logic:** Serves a paginated view of all completed quizzes within a contest, allowing the admin to filter by status or minimum score to evaluate performance.

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
**Description:** Retrieve a breakdown of submission counts per status for a contest.
**Business Logic:** Performs an aggregate query to provide summary metrics (e.g., how many quizzes are pending evaluation versus fully graded) for the admin dashboard.

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/contests/:contestId/submissions/stats`
- **Auth:** Admin (Organization JWT)

---

## 5. Get Submission by ID (Admin)
**Description:** Detailed view of a single participant's work and question-level scores.
**Business Logic:** Fetches the full JSON payload of a specific submission, including the exact answers selected, timestamps, and correctness booleans for granular auditing.

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/submissions/:submissionId`
- **Auth:** Admin (Organization JWT)

---

## 6. Bulk Evaluation (Admin)
**Description:** Trigger the grading engine to process all submitted quizzes for a contest.
**Business Logic:** Dispatches a background job that cross-references all submitted answers against the correct options, calculates final scores, and generates the leaderboard.

- **Method:** `POST`
- **Endpoint:** `/api/v1/admin/contests/:contestId/submissions/evaluate`
- **Auth:** Admin (Organization JWT)

---

## 7. Invalidate Submission (Admin)
**Description:** Manually mark a submission as invalid to exclude it from results.
**Business Logic:** Modifies the submission's status to INVALIDATED (often due to cheating or policy breaches), completely removing their score from the public leaderboard.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/admin/submissions/:submissionId/invalidate`
- **Auth:** Admin (Organization JWT)

---

## 8. List Contact Submissions (Admin)
**Description:** View all quizzes historically taken by a specific contact across the organization.
**Business Logic:** Aggregates a user's entire contest participation history within the organization's bounds, useful for long-term tracking of their performance.

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/contacts/:contactId/submissions`
- **Auth:** Admin (Organization JWT)
