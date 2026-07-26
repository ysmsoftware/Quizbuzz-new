# 🏆 Contest Module API Documentation

This document provides a detailed breakdown of all routes within the Contest module. This module manages the lifecycle of a contest, from creation and question assignment to participant registration and results declaration.

---

## 📑 Table of Contents
1. [Create Contest](#1-create-contest)
2. [List Contests](#2-list-contests)
3. [Upload Banner](#3-upload-banner)
4. [Register Participant (Public)](#4-register-participant-public)
5. [List Public Contests](#5-list-public-contests)
6. [Get Public Contest by Slug](#6-get-public-contest-by-slug)
7. [List Archived Contests](#7-list-archived-contests)
8. [Get Contest by ID](#8-get-contest-by-id)
9. [Update Contest](#9-update-contest)
10. [Delete Contest](#10-delete-contest)
11. [Archive Contest](#11-archive-contest)
12. [Publish Contest](#12-publish-contest)
13. [Close Registration](#13-close-registration)
14. [List Participants (Admin)](#14-list-participants-admin)
15. [Get Participant Status Summary](#15-get-participant-status-summary)
16. [Get Participant Details (Admin)](#16-get-participant-details-admin)
17. [Disqualify Participant (Admin)](#17-disqualify-participant-admin)
18. [Trigger Evaluation](#18-trigger-evaluation)
19. [Get Results Info](#19-get-results-info)
20. [Declare Results](#20-declare-results)
21. [Get Leaderboard (Public)](#21-get-leaderboard-public)
22. [Get Admin Leaderboard](#22-get-admin-leaderboard)

---

## 1. Create Contest
**Description:** Initialize a new contest in `DRAFT` status.
**Business Logic:** Validates all contest configuration parameters and creates a new database record under the admin's organization, allowing further editing before publication.

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

---

## 2. List Contests
**Description:** Fetch all active contests belonging to the organization.
**Business Logic:** Returns a paginated list of non-archived contests filtered by query parameters like status or search terms to populate the admin dashboard.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests`
- **Auth:** Admin (Organization JWT)

---

## 3. Upload Banner
**Description:** Upload a promotional banner image for a contest.
**Business Logic:** Accepts a multipart form data upload, processes the image file, saves it to a cloud storage bucket, and returns the public URL for the banner.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/upload-banner`
- **Auth:** Admin (Organization JWT)

---

## 4. Register Participant (Public)
**Description:** Allow a user to register for a contest via its public slug.
**Business Logic:** Verifies the `contactToken`, checks if the contest is published and within the registration deadline, and creates a participant registration record.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/register/:contestSlug`
- **Auth:** **Public** (Requires valid `contactToken` from OTP verification)

---

## 5. List Public Contests
**Description:** Fetch all publicly accessible and published contests.
**Business Logic:** Retrieves a paginated feed of live or upcoming contests across organizations that are open for public viewing and registration.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/public`
- **Auth:** **Public**

---

## 6. Get Public Contest by Slug
**Description:** Fetch detailed public information about a contest using its slug.
**Business Logic:** Loads the full public profile (rules, topics, timing, prizes) of a contest required to render its registration landing page.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/public/:slug`
- **Auth:** **Public**

---

## 7. List Archived Contests
**Description:** Fetch all archived contests for the organization.
**Business Logic:** Retrieves a paginated list of contests that have been explicitly archived, removing them from the main active views but retaining historical data.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/archived`
- **Auth:** Admin (Organization JWT)

---

## 8. Get Contest by ID
**Description:** Retrieve full configuration and status of a single contest.
**Business Logic:** Fetches the complete contest payload, including all configurations and current state, verifying the admin's organization access privileges.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId`
- **Auth:** Admin (Organization JWT)

---

## 9. Update Contest
**Description:** Modify contest settings.
**Business Logic:** Applies a partial update to the contest's configuration, enforcing constraints (e.g. major configuration changes are usually restricted if the contest is not DRAFT).

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/contests/:contestId`
- **Auth:** Admin (Organization JWT)

---

## 10. Delete Contest
**Description:** Soft-delete a DRAFT contest.
**Business Logic:** Completely removes or soft-deletes a contest record. This is strictly prohibited if the contest is already published and has participants.

- **Method:** `DELETE`
- **Endpoint:** `/api/v1/contests/:contestId`
- **Auth:** Admin (Organization JWT)

---

## 11. Archive Contest
**Description:** Move a completed or cancelled contest to the archive.
**Business Logic:** Flags the contest as archived, hiding it from active dashboards to reduce clutter while preserving all historical data and analytics.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/contests/:contestId/archive`
- **Auth:** Admin (Organization JWT)

---

## 12. Publish Contest
**Description:** Move a contest from `DRAFT` to `PUBLISHED`.
**Business Logic:** Validates that all prerequisites (e.g. sufficient questions, correct timing) are met, generates access codes, and opens the contest for public registration.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/:contestId/publish`
- **Auth:** Admin (Organization JWT)

---

## 13. Close Registration
**Description:** Manually close the registration window early.
**Business Logic:** Modifies the contest state to reject any further participant registrations, overriding the original automatic registration deadline.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/:contestId/close-registration`
- **Auth:** Admin (Organization JWT)

---

## 14. List Participants (Admin)
**Description:** List all users who have registered for a specific contest.
**Business Logic:** Returns a paginated list of participants associated with a specific contest, allowing filtering by their registration or evaluation status.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/participants`
- **Auth:** Admin (Organization JWT)

---

## 15. Get Participant Status Summary
**Description:** Get aggregated counts of participants by their current status.
**Business Logic:** Calculates a summary distribution (e.g. 50 REGISTERED, 10 COMPLETED, 2 DISQUALIFIED) to provide a quick health check on contest attendance.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/participants/status-summary`
- **Auth:** Admin (Organization JWT)

---

## 16. Get Participant Details (Admin)
**Description:** Get detailed information about a specific participant.
**Business Logic:** Retrieves the comprehensive participant profile, including their registration timestamps, proctoring flags, and current contest state.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/participants/:participantId`
- **Auth:** Admin (Organization JWT)

---

## 17. Disqualify Participant (Admin)
**Description:** Manually disqualify a participant from the contest.
**Business Logic:** Updates the participant's status to DISQUALIFIED, recording a reason, which prevents them from taking the quiz or appearing on the leaderboard.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/contests/:contestId/participants/:participantId/disqualify`
- **Auth:** Admin (Organization JWT)

---

## 18. Trigger Evaluation
**Description:** Manually trigger the evaluation engine for all submitted entries.
**Business Logic:** Submits a background job to cross-reference participant answers with correct options, compute final scores, and update leaderboard tables.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/:contestId/evaluate`
- **Auth:** Admin (Organization JWT)

---

## 19. Get Results Info
**Description:** Retrieve pre-declaration insights about the evaluation.
**Business Logic:** Serves a summary of the evaluation outcomes (e.g. top scores, average scores) to the admin before they officially commit to declaring results.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/results-info`
- **Auth:** Admin (Organization JWT)

---

## 20. Declare Results
**Description:** Officially declare the final results of the contest.
**Business Logic:** Locks the contest state to COMPLETED, finalizes all scores, triggers email notifications to participants, and publishes the public leaderboard.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contests/:contestId/declare-results`
- **Auth:** Admin (Organization JWT)

---

## 21. Get Leaderboard (Public)
**Description:** Retrieve the rankings and scores for a public contest.
**Business Logic:** Returns the publicly visible, paginated leaderboard showing participant ranks and scores. It enforces that results must be declared before data is returned.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/leaderboard`
- **Auth:** **Public**

---

## 22. Get Admin Leaderboard
**Description:** Retrieve the complete leaderboard for admin review.
**Business Logic:** Similar to the public leaderboard but bypasses the "results declared" check, allowing admins to inspect full rankings internally before public release.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contests/:contestId/admin-leaderboard`
- **Auth:** Admin (Organization JWT)
