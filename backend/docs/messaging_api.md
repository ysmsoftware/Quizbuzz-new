# 📨 Messaging Module API Documentation

This document covers all 7 endpoints for managing Email and WhatsApp communications within the QuizBuzz platform.

---

## 📑 Table of Contents
1. [Send Single Message](#1-send-single-message)
2. [Get Message Details](#2-get-message-details)
3. [Retry Specific Message](#3-retry-specific-message)
4. [Bulk Retry Failed Messages](#4-bulk-retry-failed-messages)
5. [List Messages by Contact](#5-list-messages-by-contact)
6. [List Messages by Contest](#6-list-messages-by-contest)
7. [List Messages for Contact in Contest](#7-list-messages-for-contact-in-contest)

---

## 1. Send Single Message
Trigger an immediate Email or WhatsApp message to a recipient. This can use predefined templates or custom body content.

- **Method:** `POST`
- **Endpoint:** `/api/v1/messaging/send`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `channel` | `enum` | Yes | `EMAIL` or `WHATSAPP`. |
| `template` | `enum` | Yes | `REGISTRATION_SUCCESS`, `OTP_VERIFICATION`, `CERTIFICATE_ISSUED`, `QUIZ_REMINDER`, `CUSTOM`. |
| `recipient` | `string` | Yes | Email address or phone number (with country code). |
| `subject` | `string` | No | Required for EMAIL if template is CUSTOM. |
| `body` | `string` | No | Required for CUSTOM template. |
| `parameters`| `object` | No | Key-value pairs for template variables (e.g. `{"name": "John"}`). |
| `participantId`| `string` | No | Link message to a specific participant record. |
| `contactId` | `string` | No | Link message to a specific contact record. |
| `contestId` | `string` | No | Link message to a specific contest. |

```json
{
  "channel": "EMAIL",
  "template": "QUIZ_REMINDER",
  "recipient": "john@example.com",
  "parameters": {
    "contestName": "Summer Hackathon 2024",
    "startTime": "2:00 PM"
  },
  "contactId": "cont_98765"
}
```

---

## 2. Get Message Details
Check the status of a message (e.g., `PENDING`, `SENT`, `FAILED`, `DELIVERED`).

- **Method:** `GET`
- **Endpoint:** `/api/v1/messaging/:id`
- **Auth:** Admin

---

## 3. Retry Specific Message
Manually trigger a retry for a message that has previously failed.

- **Method:** `POST`
- **Endpoint:** `/api/v1/messaging/:id/retry`
- **Auth:** Admin

---

## 4. Bulk Retry Failed Messages
Trigger a background job to retry all failed messages for the current organization.

- **Method:** `POST`
- **Endpoint:** `/api/v1/messaging/retry-failed`
- **Auth:** Admin

---

## 5. List Messages by Contact
Retrieve the full communication history for a specific contact across all contests.

- **Method:** `GET`
- **Endpoint:** `/api/v1/messaging/contact/:contactId`
- **Auth:** Admin

---

## 6. List Messages by Contest
Retrieve all communications sent related to a specific contest.

- **Method:** `GET`
- **Endpoint:** `/api/v1/messaging/contest/:contestId`
- **Auth:** Admin

---

## 7. List Messages for Contact in Contest
Filter communication history for a specific person within a specific contest context.

- **Method:** `GET`
- **Endpoint:** `/api/v1/messaging/contest/:contestId/contact/:contactId`
- **Auth:** Admin
