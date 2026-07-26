# ❓ Question Module API Documentation

This document covers all endpoints for managing your organization's question bank and their assignments to specific contests.

---

## 📑 Table of Contents
1. [List Questions](#1-list-questions)
2. [Create Question](#2-create-question)
3. [Bulk Create Questions](#3-bulk-create-questions)
4. [Get Question Tags](#4-get-question-tags)
5. [Get Question by ID](#5-get-question-by-id)
6. [Update Question](#6-update-question)
7. [Delete Question](#7-delete-question)
8. [Get Contest Questions](#8-get-contest-questions)
9. [Assign Questions to Contest](#9-assign-questions-to-contest)
10. [Auto Generate Questions](#10-auto-generate-questions)
11. [Remove Question from Contest](#11-remove-question-from-contest)
12. [Update Contest Question](#12-update-contest-question)

---

## 1. List Questions
**Description:** Search and filter the organizational question library.
**Business Logic:** Queries the global question bank for the organization, allowing admins to filter by difficulty, tags, or free-text search to find suitable questions.

- **Method:** `GET`
- **Endpoint:** `/api/v1/questions`
- **Auth:** Admin (Organization JWT)

### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `difficulty` | `string` | - | Filter by `EASY`, `MEDIUM`, `HARD`. |
| `tags` | `string` | - | Comma-separated list (e.g., `React,Hooks`). |
| `search` | `string` | - | Fuzzy search on question text. |
| `contestId` | `string` | - | List questions already assigned to this contest. |
| `unassignedFor`| `string` | - | List questions NOT yet assigned to this contestId. |
| `page` | `number` | `1` | Pagination page. |
| `limit` | `number` | `20` | Results per page (max 100). |

---

## 2. Create Question
**Description:** Add a new question with multiple-choice options to the organization's library.
**Business Logic:** Validates the question schema (e.g., ensuring exactly one correct option) and persists a new reusable question record to the organization's question bank.

- **Method:** `POST`
- **Endpoint:** `/api/v1/questions`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `questionText` | `string` | Yes | 5-2000 characters. |
| `difficulty` | `enum` | Yes | `EASY`, `MEDIUM`, `HARD`. |
| `options` | `array` | Yes | Array of 2-6 options. Exactly one must be correct. |
| `hint` | `string` | No | Optional hint for participants. |
| `explanation` | `string` | No | Detailed explanation shown after the quiz. |
| `tags` | `string[]` | No | Max 10 tags, each max 50 chars. |

```json
{
  "questionText": "What is the primary purpose of React Hooks?",
  "difficulty": "MEDIUM",
  "tags": ["React", "Frontend"],
  "options": [
    { "text": "To manage state in class components", "isCorrect": false, "position": 0 },
    { "text": "To use state and lifecycle in functional components", "isCorrect": true, "position": 1 },
    { "text": "To replace the Virtual DOM", "isCorrect": false, "position": 2 }
  ],
  "explanation": "Hooks allow functional components to have state and side effects."
}
```

---

## 3. Bulk Create Questions
**Description:** Import multiple questions into the library in a single request.
**Business Logic:** Processes an array of question payloads, performing bulk validation and atomic insertion to speed up the onboarding of large existing question datasets.

- **Method:** `POST`
- **Endpoint:** `/api/v1/questions/bulk`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
```json
{
  "questions": [
    { "questionText": "Q1...", "difficulty": "EASY", "options": [...] },
    { "questionText": "Q2...", "difficulty": "HARD", "options": [...] }
  ]
}
```

---

## 4. Get Question Tags
**Description:** Retrieve all unique tags currently used in your organization's question library.
**Business Logic:** Executes a distinct aggregation query on the tags field of all questions owned by the organization, serving autocomplete dropdowns in the admin UI.

- **Method:** `GET`
- **Endpoint:** `/api/v1/questions/tags`
- **Auth:** Admin (Organization JWT)

---

## 5. Get Question by ID
**Description:** Retrieve full details of a single question, including all options and metadata.
**Business Logic:** Fetches the complete document for a specific question ID, verifying that it belongs to the admin's organization before returning it.

- **Method:** `GET`
- **Endpoint:** `/api/v1/questions/:questionId`
- **Auth:** Admin (Organization JWT)

---

## 6. Update Question
**Description:** Modify an existing question.
**Business Logic:** Applies a partial update to the question data. Changes here apply globally and will reflect in all future and currently active contests using this question.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/questions/:questionId`
- **Auth:** Admin (Organization JWT)

---

## 7. Delete Question
**Description:** Soft-delete a question from the library.
**Business Logic:** Marks the question as deleted so it no longer appears in search results, while preserving it for any historical contest records where it was already used.

- **Method:** `DELETE`
- **Endpoint:** `/api/v1/questions/:questionId`
- **Auth:** Admin (Organization JWT)

---

## 8. Get Contest Questions
**Description:** Retrieve all questions currently assigned to a specific contest.
**Business Logic:** Fetches the relational mapping of questions tied to a contest, including contest-specific metadata like overridden marks, negative marks, and ordering positions.

- **Method:** `GET`
- **Endpoint:** `/api/v1/questions/contests/:contestId/questions`
- **Auth:** Admin (Organization JWT)

---

## 9. Assign Questions to Contest
**Description:** Link existing questions from the library to a specific contest.
**Business Logic:** Creates new records in the join table linking a contest ID to question IDs, initializing their position and marking scheme for this specific quiz execution.

- **Method:** `POST`
- **Endpoint:** `/api/v1/questions/contests/:contestId/assign-questions`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `questions` | `array` | Yes | List of mappings. |
| `questionId` | `string` | Yes | ID from library. |
| `position` | `number` | Yes | Order in the quiz (must be unique). |
| `marks` | `number` | Yes | Score for correct answer. |
| `negativeMark` | `number` | No | Penalty for wrong answer (default 0). |

---

## 10. Auto Generate Questions
**Description:** Use AI to automatically generate and add questions to a contest.
**Business Logic:** Triggers a prompt to the configured LLM using provided topics and difficulty parameters, saves the generated questions to the library, and assigns them to the contest.

- **Method:** `POST`
- **Endpoint:** `/api/v1/questions/contests/:contestId/auto-generate`
- **Auth:** Admin (Organization JWT)

---

## 11. Remove Question from Contest
**Description:** Unlink a specific question from a contest.
**Business Logic:** Deletes the relationship record in the join table, removing the question from the quiz payload without deleting it from the organization's main library.

- **Method:** `DELETE`
- **Endpoint:** `/api/v1/questions/contests/:contestId/questions/:questionId`
- **Auth:** Admin (Organization JWT)

---

## 12. Update Contest Question
**Description:** Update scoring or ordering for a question specifically within one contest context.
**Business Logic:** Modifies the mapping record to change the question's sequence position or override its default marks and negative marks just for this specific contest.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/questions/contests/:contestId/questions/:questionId`
- **Auth:** Admin (Organization JWT)
