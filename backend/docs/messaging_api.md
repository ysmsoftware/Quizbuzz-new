# 📨 Messaging Module API Documentation

This document covers all endpoints for managing Email and WhatsApp communications within the QuizBuzz platform.

---

## 📑 Table of Contents
1. [Get Templates](#1-get-templates)
2. [Send Single Message](#2-send-single-message)
3. [Get Message Details](#3-get-message-details)
4. [Retry Specific Message](#4-retry-specific-message)
5. [Bulk Retry Failed Messages](#5-bulk-retry-failed-messages)
6. [List Messages by Contact](#6-list-messages-by-contact)
7. [List Messages by Contest](#7-list-messages-by-contest)
8. [List Messages for Contact in Contest](#8-list-messages-for-contact-in-contest)

---

## 1. Get Templates
**Description:** Retrieve all available message templates.
**Business Logic:** Returns the predefined Email and WhatsApp templates configured in the system that admins can use for automated or manual outreach.

- **Method:** `GET`
- **Endpoint:** `/api/v1/messaging/templates`
- **Auth:** Admin (Organization JWT)

---

## 2. Send Single Message
**Description:** Trigger an immediate Email or WhatsApp message to a recipient.
**Business Logic:** Enqueues a messaging job using either a predefined template or custom body content, attaching context like participant or contest IDs for tracking.

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

---

## 3. Get Message Details
**Description:** Check the delivery status of a specific message.
**Business Logic:** Retrieves the full log and current status (`PENDING`, `SENT`, `FAILED`, `DELIVERED`) of a message by its unique ID.

- **Method:** `GET`
- **Endpoint:** `/api/v1/messaging/:id`
- **Auth:** Admin (Organization JWT)

---

## 4. Retry Specific Message
**Description:** Manually trigger a retry for a specific failed message.
**Business Logic:** Resets the state of a previously failed message and re-enqueues it to the worker queue for a fresh delivery attempt.

- **Method:** `POST`
- **Endpoint:** `/api/v1/messaging/:id/retry`
- **Auth:** Admin (Organization JWT)

---

## 5. Bulk Retry Failed Messages
**Description:** Trigger a background job to retry all failed messages.
**Business Logic:** Queries for all messages marked as `FAILED` within the organization and bulk re-enqueues them to the delivery workers.

- **Method:** `POST`
- **Endpoint:** `/api/v1/messaging/retry-failed`
- **Auth:** Admin (Organization JWT)

---

## 6. List Messages by Contact
**Description:** Retrieve the full communication history for a specific contact.
**Business Logic:** Fetches a paginated list of all emails and WhatsApps sent to a given contact across all contests organized by the current organization.

- **Method:** `GET`
- **Endpoint:** `/api/v1/messaging/contact/:contactId`
- **Auth:** Admin (Organization JWT)

---

## 7. List Messages by Contest
**Description:** Retrieve all communications sent related to a specific contest.
**Business Logic:** Fetches a paginated list of all messages (e.g., registration confirmations, reminders) tied to a specific contest ID.

- **Method:** `GET`
- **Endpoint:** `/api/v1/messaging/contest/:contestId`
- **Auth:** Admin (Organization JWT)

---

## 8. List Messages for Contact in Contest
**Description:** Filter communication history for a specific person within a specific contest.
**Business Logic:** Returns the targeted message history for a single participant within the scoped context of one particular contest.

- **Method:** `GET`
- **Endpoint:** `/api/v1/messaging/contest/:contestId/contact/:contactId`
- **Auth:** Admin (Organization JWT)
