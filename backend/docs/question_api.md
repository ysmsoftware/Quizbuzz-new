# ❓ Question Module API Documentation

This document covers all 10 endpoints for managing your organization's question bank and their assignments to specific contests.

---

## 📑 Table of Contents
1. [Create Question](#1-create-question)
2. [List Questions](#2-list-questions)
3. [Get Question by ID](#3-get-question-by-id)
4. [Update Question](#4-update-question)
5. [Delete Question](#5-delete-question)
6. [Bulk Create Questions](#6-bulk-create-questions)
7. [Assign Questions to Contest](#7-assign-questions-to-contest)
8. [Reorder Questions in Contest](#8-reorder-questions-in-contest)
9. [Update Contest Question Marks](#9-update-contest-question-marks)
10. [Get Question Tags](#10-get-question-tags)

---

## 1. Create Question
Add a new question with multiple-choice options to the organization's library.

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

## 2. List Questions
Search and filter the organizational question library.

- **Method:** `GET`
- **Endpoint:** `/api/v1/questions`
- **Auth:** Admin

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

## 3. Get Question by ID
Retrieve full details of a single question, including all options and metadata.

- **Method:** `GET`
- **Endpoint:** `/api/v1/questions/:id`
- **Auth:** Admin

---

## 4. Update Question
Modify an existing question. Note: Providing the `options` array will replace all previous options.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/questions/:id`
- **Auth:** Admin

---

## 5. Delete Question
Soft-delete a question. This removes it from future search results but preserves it for existing contest records.

- **Method:** `DELETE`
- **Endpoint:** `/api/v1/questions/:id`
- **Auth:** Admin

---

## 6. Bulk Create Questions
Import multiple questions in a single request.

- **Method:** `POST`
- **Endpoint:** `/api/v1/questions/bulk`
- **Auth:** Admin

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

## 7. Assign Questions to Contest
Link questions from your library to a specific contest.

- **Method:** `POST`
- **Endpoint:** `/api/v1/questions/assign/:contestId`
- **Auth:** Admin

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `questions` | `array` | Yes | List of mappings. |
| `questionId` | `string` | Yes | ID from library. |
| `position` | `number` | Yes | Order in the quiz (must be unique). |
| `marks` | `number` | Yes | Score for correct answer. |
| `negativeMark` | `number` | No | Penalty for wrong answer (default 0). |

---

## 8. Reorder Questions in Contest
Batch update the sequence of questions for a specific quiz.

- **Method:** `POST`
- **Endpoint:** `/api/v1/questions/reorder/:contestId`
- **Auth:** Admin

### Request Body (JSON)
```json
{
  "order": ["questionId1", "questionId2", "questionId3"]
}
```

---

## 9. Update Contest Question Marks
Update scoring for a question specifically within one contest context.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/questions/contest-questions/:id`
- **Auth:** Admin

---

## 10. Get Question Tags
Retrieve all unique tags currently used in your organization's question library.

- **Method:** `GET`
- **Endpoint:** `/api/v1/questions/tags`
- **Auth:** Admin
