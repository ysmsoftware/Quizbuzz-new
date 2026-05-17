# 13 — Leaderboard
**Wave 9 | Depends on: Wave 8 (evaluation complete)**

The leaderboard is built automatically by the leaderboard worker after evaluation completes. The admin publishes it by calling `declare-results` (see `03-contests.md`). Public endpoint requires no auth.

Base path: `/api/v1/contests`

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| GET | `/contests/:contestId/leaderboard` | ✗ | Public leaderboard (after declare-results) |
| POST | `/contests/:contestId/leaderboard/build` | ✓ | Admin: manual leaderboard rebuild |

---

## GET `/contests/:contestId/leaderboard`

Public endpoint. Returns published leaderboard entries. Returns 404 if results have not been declared yet.

**Auth required:** No

### Query Parameters

| Param | Type | Default |
|-------|------|---------|
| `page` | number | 1 |
| `limit` | number | 50 (max: 100) |

### Response `200`

```json
{
  "success": true,
  "data": {
    "contestTitle": "DSA Championship 2025",
    "totalEntries": 124,
    "entries": [
      {
        "rank": 1,
        "score": "196.00",
        "percentage": "98.00",
        "timeTakenSecs": 2840,
        "prizeLabel": "Gold",
        "prizeBenefits": ["₹5000", "Certificate", "Internship opportunity"],
        "participant": {
          "registrationRef": "QB-2025-00007",
          "contact": {
            "firstName": "Priya",
            "lastName": "Singh"
          }
        }
      },
      {
        "rank": 2,
        "score": "188.00",
        "percentage": "94.00",
        "timeTakenSecs": 3120,
        "prizeLabel": "Silver",
        "prizeBenefits": ["₹2000", "Certificate"],
        "participant": {
          "registrationRef": "QB-2025-00023",
          "contact": {
            "firstName": "Rahul",
            "lastName": "Mehta"
          }
        }
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 124, "totalPages": 3 }
  }
}
```

### Response `404` (results not declared yet)

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Results have not been declared yet. Check back later."
  }
}
```

---

## POST `/contests/:contestId/leaderboard/build`

Force a manual leaderboard rebuild. Use this if the automated build failed for any reason.

**Auth required:** ✓

### Request Body

None.

### Response `200`

```json
{
  "success": true,
  "message": "Leaderboard rebuild queued",
  "data": { "queued": true }
}
```

---

# 14 — Certificates
**Wave 9 | Depends on: Wave 9a (leaderboard + declare-results complete)**

Base path: `/api/v1/certificates`

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| POST | `/certificates/issue/:contestId` | ✓ | Issue certificate to one participant |
| POST | `/certificates/bulk-issue/:contestId` | ✓ | Bulk issue to all eligible participants |
| GET | `/certificates/contests/:contestId` | ✓ | List all certificates for a contest |
| GET | `/certificates/participants/:participantId` | ✗ | Public: get participant's certificate URL |
| POST | `/certificates/:certificateId/retry` | ✓ | Retry a failed generation |
| DELETE | `/certificates/:certificateId` | ✓ | Delete and regenerate a certificate |

---

## POST `/certificates/issue/:contestId`

Issue a certificate to a specific participant. Enqueues a BullMQ certificate generation job. The PDF is generated asynchronously by Puppeteer and uploaded to S3.

**Auth required:** ✓

### Request Body

```json
{
  "participantId": "01HPART...",
  "templateData": {
    "rank": 1,
    "score": "196.00",
    "percentage": "98.00",
    "prizeLabel": "Gold"
  }
}
```

| Field | Type | Required |
|-------|------|:---:|
| `participantId` | string | ✓ |
| `templateData` | object | ✗ (auto-populated from leaderboard if omitted) |

### Response `201`

```json
{
  "success": true,
  "message": "Certificate generation queued",
  "data": {
    "certificateId": "01HCERT...",
    "status": "QUEUED",
    "participantId": "01HPART..."
  }
}
```

---

## POST `/certificates/bulk-issue/:contestId`

Issue certificates to all evaluated participants who meet the cutoff score. Enqueues one job per participant. Safe to call multiple times — already-issued certificates are skipped.

**Auth required:** ✓

### Request Body

```json
{
  "cutoffPercentage": 60
}
```

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `cutoffPercentage` | number | From contest config | Participants below this are skipped |

### Response `200`

```json
{
  "success": true,
  "data": {
    "queued": 98,
    "skipped": 26,
    "alreadyIssued": 14
  }
}
```

---

## GET `/certificates/contests/:contestId`

Admin view of all certificate generation statuses for a contest.

**Auth required:** ✓

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `status` | enum | `PENDING`, `QUEUED`, `GENERATING`, `GENERATED`, `FAILED`, `DELIVERED` |
| `page` | number | Default: 1 |
| `limit` | number | Default: 50 |

### Response `200`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "01HCERT...",
        "status": "GENERATED",
        "fileUrl": "https://s3.amazonaws.com/bucket/certs/01HCERT....pdf",
        "generatedAt": "2025-06-15T14:00:00.000Z",
        "deliveredAt": "2025-06-15T14:01:00.000Z",
        "participant": {
          "registrationRef": "QB-2025-00007",
          "contact": { "firstName": "Priya", "lastName": "Singh", "email": "priya@example.com" }
        }
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 98, "totalPages": 2 },
    "summary": {
      "generated": 84,
      "failed": 4,
      "pending": 10
    }
  }
}
```

---

## GET `/certificates/participants/:participantId`

Public endpoint. Participants use this to download their certificate after they receive the notification message.

**Auth required:** No

### Response `200`

```json
{
  "success": true,
  "data": {
    "certificateId": "01HCERT...",
    "status": "GENERATED",
    "fileUrl": "https://s3.amazonaws.com/bucket/certs/01HCERT....pdf",
    "generatedAt": "2025-06-15T14:00:00.000Z",
    "contest": {
      "title": "DSA Championship 2025",
      "organizationName": "QuizBuzz Ltd"
    }
  }
}
```

### Response `404`

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Certificate not found or not yet generated"
  }
}
```

---

## POST `/certificates/:certificateId/retry`

Retry a failed certificate generation. Enqueues a new BullMQ job.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "message": "Certificate regeneration queued",
  "data": { "status": "QUEUED" }
}
```

---

# 15 — Contacts
**Wave 10 | Can be integrated any time after Wave 2**

Contacts are the deduplicated identity records for participants. One contact can appear in many contests.

Base path: `/api/v1/contacts`

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| GET | `/contacts` | ✓ | List all contacts for the org |
| GET | `/contacts/:contactId` | ✓ | Full contact profile |
| GET | `/contacts/:contactId/history` | ✓ | All contests this contact participated in |
| PATCH | `/contacts/:contactId` | ✓ | Update contact information |

---

## GET `/contacts`

**Auth required:** ✓

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search by name, email, or phone |
| `college` | string | Filter by college name |
| `page` | number | Default: 1 |
| `limit` | number | Default: 50 |

### Response `200`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "01HCON...",
        "email": "rahul@example.com",
        "phone": "+919876543210",
        "firstName": "Rahul",
        "lastName": "Mehta",
        "college": "IIT Bombay",
        "department": "CS",
        "city": "Mumbai",
        "state": "Maharashtra",
        "createdAt": "2025-04-01T10:00:00.000Z",
        "_count": { "participants": 3 }
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 412, "totalPages": 9 }
  }
}
```

---

## GET `/contacts/:contactId`

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "01HCON...",
    "email": "rahul@example.com",
    "phone": "+919876543210",
    "firstName": "Rahul",
    "lastName": "Mehta",
    "college": "IIT Bombay",
    "department": "Computer Science",
    "city": "Mumbai",
    "state": "Maharashtra",
    "createdAt": "2025-04-01T10:00:00.000Z",
    "updatedAt": "2025-06-01T10:00:00.000Z"
  }
}
```

---

## GET `/contacts/:contactId/history`

All contests this contact has participated in, with payment and submission summary.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": [
    {
      "participantId": "01HPART...",
      "registrationRef": "QB-2025-00142",
      "status": "SUBMITTED",
      "joinedAt": "2025-06-15T10:02:00.000Z",
      "contest": {
        "id": "01HCONT...",
        "title": "DSA Championship 2025",
        "startTime": "2025-06-15T10:00:00.000Z",
        "status": "RESULTS_OUT"
      },
      "payment": { "status": "SUCCESS", "amount": 199 },
      "submission": {
        "score": "144.00",
        "percentage": "72.00",
        "rank": 18
      }
    }
  ]
}
```

---

## PATCH `/contacts/:contactId`

Update a contact's information. Only fields provided are updated.

**Auth required:** ✓

### Request Body

```json
{
  "phone": "+919876543211",
  "college": "IIT Delhi",
  "city": "Delhi"
}
```

### Response `200`

```json
{
  "success": true,
  "data": { /* Updated contact */ }
}
```

---

# 16 — Messaging
**Wave 10 | Can be integrated any time after Wave 2**

Message logs are a read-only view. Actual messages are sent automatically by the backend (contest reminders, payment confirmations, certificate delivery). This module lets the admin view delivery status and retry failed messages.

Base path: `/api/v1/messages`

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| GET | `/messages/contests/:contestId` | ✓ | All messages for a contest |
| GET | `/messages/:messageId` | ✓ | Single message detail |
| POST | `/messages/:messageId/retry` | ✓ | Retry a failed message |
| POST | `/messages/bulk` | ✓ | Send a custom message to all participants |

---

## GET `/messages/contests/:contestId`

**Auth required:** ✓

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `channel` | enum | `WHATSAPP`, `EMAIL` |
| `status` | enum | `QUEUED`, `PROCESSING`, `SENT`, `DELIVERED`, `FAILED` |
| `template` | string | Filter by message template name |
| `page` | number | Default: 1 |
| `limit` | number | Default: 50 |

### Response `200`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "01HMSG...",
        "channel": "WHATSAPP",
        "template": "REGISTRATION_SUCCESSFUL",
        "recipient": "+919876543210",
        "status": "DELIVERED",
        "sentAt": "2025-06-01T12:00:00.000Z",
        "deliveredAt": "2025-06-01T12:00:05.000Z",
        "retryCount": 0,
        "participant": {
          "contact": { "firstName": "Rahul", "lastName": "Mehta" }
        }
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 284, "totalPages": 6 },
    "summary": {
      "sent": 280,
      "failed": 4,
      "pending": 0
    }
  }
}
```

---

## POST `/messages/:messageId/retry`

Re-enqueue a failed message. Safe to call multiple times.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "message": "Message re-queued for delivery"
}
```

---

## POST `/messages/bulk`

Send a custom message to all participants of a contest. Useful for announcements (result delay, event update, etc.).

**Auth required:** ✓

### Request Body

```json
{
  "contestId": "01HCONT...",
  "channel": "EMAIL",
  "subject": "Results Delayed — DSA Championship 2025",
  "body": "Due to a technical issue, results will be published by 6:00 PM today. Sorry for the inconvenience.",
  "template": "CUSTOM"
}
```

| Field | Type | Required | Notes |
|-------|------|:---:|-------|
| `contestId` | string | ✓ | |
| `channel` | enum | ✓ | `EMAIL` or `WHATSAPP` |
| `subject` | string | Email only | Email subject line |
| `body` | string | ✓ | Message content |
| `template` | string | ✓ | Use `CUSTOM` for admin-written messages |

### Response `200`

```json
{
  "success": true,
  "data": {
    "queued": 142,
    "message": "Bulk message job queued. Delivery will start shortly."
  }
}
```
