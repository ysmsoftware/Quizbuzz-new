# 04 — Questions
**Wave 3 | Depends on: Wave 1 (login), Wave 2 (org), Wave 3a (contests)**

Questions live in an org-wide **question bank**. They are created independently of contests, then assigned to specific contests with position and scoring configuration.

Base path: `/api/v1/questions`

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| POST | `/questions` | ✓ | Create one question |
| POST | `/questions/bulk` | ✓ | Bulk create up to 500 questions |
| GET | `/questions` | ✓ | List question bank (paginated, filterable) |
| GET | `/questions/:questionId` | ✓ | Get single question with options |
| PATCH | `/questions/:questionId` | ✓ | Update question |
| DELETE | `/questions/:questionId` | ✓ | Soft-delete question |
| GET | `/questions/contests/:contestId/questions` | ✓ | Get questions assigned to a contest |
| POST | `/questions/contests/:contestId/questions` | ✓ | Assign questions to a contest |
| PATCH | `/questions/contests/:contestId/questions/:questionId` | ✓ | Update marks/negativeMark for assignment |
| DELETE | `/questions/contests/:contestId/questions/:questionId` | ✓ | Remove question from contest |

---

## POST `/questions`

Create a single question in the org's question bank.

**Auth required:** ✓

### Request Body

```json
{
  "questionText": "What is the time complexity of QuickSort in the average case?",
  "difficulty": "MEDIUM",
  "hint": "Think about the partition step",
  "explanation": "QuickSort has O(n log n) average case due to balanced partitioning on average.",
  "tags": ["Sorting", "DSA", "Time Complexity"],
  "options": [
    { "text": "O(n)",      "isCorrect": false, "position": 0 },
    { "text": "O(n log n)","isCorrect": true,  "position": 1 },
    { "text": "O(n²)",     "isCorrect": false, "position": 2 },
    { "text": "O(log n)",  "isCorrect": false, "position": 3 }
  ]
}
```

| Field | Type | Rules | Required |
|-------|------|-------|:---:|
| `questionText` | string | 5–2000 chars | ✓ |
| `difficulty` | enum | `EASY`, `MEDIUM`, `HARD` | ✓ |
| `hint` | string | Max 500 chars | ✗ |
| `explanation` | string | Max 2000 chars | ✗ |
| `tags` | string[] | Max 10 tags, each max 50 chars | ✗ |
| `options` | Option[] | 2–6 options, exactly 1 correct | ✓ |
| `options[].text` | string | 1–500 chars | ✓ |
| `options[].isCorrect` | boolean | Exactly one must be `true` | ✓ |
| `options[].position` | number | 0–9, must be unique in array | ✓ |

### Response `201`

```json
{
  "success": true,
  "message": "Question created",
  "data": {
    "id": "01HQUES...",
    "questionText": "What is the time complexity of QuickSort in the average case?",
    "difficulty": "MEDIUM"
  }
}
```

### Validation Rules

- Exactly one option must have `isCorrect: true`
- All `position` values must be unique within the options array
- 2 to 6 options per question

---

## POST `/questions/bulk`

Create up to 500 questions in a single request. Useful for importing questions from a spreadsheet or external system.

**Auth required:** ✓

### Request Body

```json
{
  "questions": [
    {
      "questionText": "What is Big O notation?",
      "difficulty": "EASY",
      "tags": ["DSA"],
      "options": [
        { "text": "A way to measure algorithm complexity", "isCorrect": true, "position": 0 },
        { "text": "A sorting algorithm", "isCorrect": false, "position": 1 },
        { "text": "A data structure", "isCorrect": false, "position": 2 },
        { "text": "A programming language", "isCorrect": false, "position": 3 }
      ]
    },
    {
      "questionText": "Which data structure uses LIFO?",
      "difficulty": "EASY",
      "tags": ["Data Structures"],
      "options": [
        { "text": "Queue", "isCorrect": false, "position": 0 },
        { "text": "Stack", "isCorrect": true,  "position": 1 },
        { "text": "Tree",  "isCorrect": false, "position": 2 },
        { "text": "Graph", "isCorrect": false, "position": 3 }
      ]
    }
  ]
}
```

### Response `201`

```json
{
  "success": true,
  "data": {
    "created": 2,
    "failed": 0,
    "ids": ["01HQUES1...", "01HQUES2..."]
  }
}
```

---

## GET `/questions`

List questions from the org's question bank with filters.

**Auth required:** ✓

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `difficulty` | enum | `EASY`, `MEDIUM`, `HARD` |
| `tags` | string | Comma-separated: `"DSA,Sorting"` |
| `search` | string | Search in question text |
| `contestId` | string | Show questions already in this contest |
| `unassignedFor` | string | Show questions NOT in this contest |
| `page` | number | Default: 1 |
| `limit` | number | Default: 20, max: 100 |

### Response `200`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "01HQUES...",
        "questionText": "What is the time complexity of QuickSort?",
        "difficulty": "MEDIUM",
        "tags": ["Sorting", "DSA"],
        "hint": "Think about partition",
        "options": [
          { "id": "01HOPT1...", "text": "O(n)", "isCorrect": false, "position": 0 },
          { "id": "01HOPT2...", "text": "O(n log n)", "isCorrect": true, "position": 1 },
          { "id": "01HOPT3...", "text": "O(n²)", "isCorrect": false, "position": 2 },
          { "id": "01HOPT4...", "text": "O(log n)", "isCorrect": false, "position": 3 }
        ],
        "createdAt": "2024-01-15T10:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 87, "totalPages": 5 }
  }
}
```

> **UI tip:** Use `unassignedFor=:contestId` when showing a picker to add questions to a contest — it filters out already-assigned questions.

---

## GET `/questions/:questionId`

Get full detail of a single question including all options and explanation.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "01HQUES...",
    "questionText": "What is the time complexity of QuickSort in the average case?",
    "difficulty": "MEDIUM",
    "hint": "Think about the partition step",
    "explanation": "QuickSort has O(n log n) average case...",
    "tags": ["Sorting", "DSA"],
    "options": [
      { "id": "01HOPT1...", "text": "O(n)",      "isCorrect": false, "position": 0 },
      { "id": "01HOPT2...", "text": "O(n log n)","isCorrect": true,  "position": 1 },
      { "id": "01HOPT3...", "text": "O(n²)",     "isCorrect": false, "position": 2 },
      { "id": "01HOPT4...", "text": "O(log n)",  "isCorrect": false, "position": 3 }
    ],
    "isDeleted": false,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

## PATCH `/questions/:questionId`

Update a question. All fields are optional. If `options` is provided, it **replaces all existing options** for this question.

**Auth required:** ✓

### Request Body

```json
{
  "questionText": "Updated question text",
  "difficulty": "HARD",
  "hint": null,
  "tags": ["DSA", "Graphs"],
  "options": [
    { "text": "Option A", "isCorrect": false, "position": 0 },
    { "text": "Option B", "isCorrect": true,  "position": 1 },
    { "text": "Option C", "isCorrect": false, "position": 2 },
    { "text": "Option D", "isCorrect": false, "position": 3 }
  ]
}
```

> When updating options, you can include an `id` field on existing options to update them, or omit it to create new ones. The system replaces all options atomically.

### Response `200`

```json
{
  "success": true,
  "message": "Question updated",
  "data": { /* updated question */ }
}
```

---

## DELETE `/questions/:questionId`

Soft-deletes a question. It will not appear in future contest question banks but historical data is preserved.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "message": "Question deleted"
}
```

---

## GET `/questions/contests/:contestId/questions`

Get all questions currently assigned to a specific contest, ordered by position.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": [
    {
      "id": "01HCQUES...",
      "contestId": "01HCONT...",
      "questionId": "01HQUES...",
      "position": 1,
      "marks": 4,
      "negativeMark": "1.00",
      "question": {
        "id": "01HQUES...",
        "questionText": "What is the time complexity of QuickSort?",
        "difficulty": "MEDIUM",
        "tags": ["DSA"],
        "options": [
          { "id": "01HOPT1...", "text": "O(n)",      "isCorrect": false, "position": 0 },
          { "id": "01HOPT2...", "text": "O(n log n)","isCorrect": true,  "position": 1 },
          { "id": "01HOPT3...", "text": "O(n²)",     "isCorrect": false, "position": 2 },
          { "id": "01HOPT4...", "text": "O(log n)",  "isCorrect": false, "position": 3 }
        ]
      }
    }
  ]
}
```

---

## POST `/questions/contests/:contestId/questions`

Assign one or more questions to a contest with position and scoring.

**Auth required:** ✓  
**Constraint:** Contest must be in `DRAFT` status.

### Request Body

```json
{
  "questions": [
    { "questionId": "01HQUES1...", "position": 1, "marks": 4, "negativeMark": 1 },
    { "questionId": "01HQUES2...", "position": 2, "marks": 4, "negativeMark": 1 },
    { "questionId": "01HQUES3...", "position": 3, "marks": 2, "negativeMark": 0 }
  ]
}
```

| Field | Type | Rules | Required |
|-------|------|-------|:---:|
| `questionId` | string | Must exist in org's question bank | ✓ |
| `position` | number | Positive integer, unique per contest | ✓ |
| `marks` | number | Min 1, default 1 | ✓ |
| `negativeMark` | number | 0–10, default 0 | ✗ |

### Response `201`

```json
{
  "success": true,
  "message": "3 question(s) assigned",
  "data": {
    "assigned": 3,
    "skipped": 0
  }
}
```

> If a question is already assigned to the contest, it is skipped rather than erroring. The count shows `skipped`.

---

## PATCH `/questions/contests/:contestId/questions/:questionId`

Update the marks or negative mark for a specific question in a contest.

**Auth required:** ✓

### Request Body

```json
{
  "marks": 5,
  "negativeMark": 1.5
}
```

### Response `200`

```json
{
  "success": true,
  "message": "Contest question config updated",
  "data": {
    "contestId": "01HCONT...",
    "questionId": "01HQUES...",
    "marks": 5,
    "negativeMark": "1.50"
  }
}
```

---

## DELETE `/questions/contests/:contestId/questions/:questionId`

Remove a question from a contest assignment. The question itself is not deleted from the bank.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "message": "Question removed from contest"
}
```

---

## Recommended UI Workflow for Contest Builder

1. Open contest detail page (GET `/contests/:contestId`)
2. Navigate to "Questions" tab
3. Show current questions: `GET /questions/contests/:contestId/questions`
4. "Add Questions" button opens a picker:
   - Calls `GET /questions?unassignedFor=:contestId` to show only unassigned questions
   - Supports filter by difficulty, tags, search
5. Admin selects questions and clicks "Assign"
6. Calls `POST /questions/contests/:contestId/questions` with selected questions and positions
7. Admin can reorder (drag-and-drop) → call `PATCH` on each position change
8. Admin can remove a question → call `DELETE /questions/contests/:contestId/questions/:questionId`
