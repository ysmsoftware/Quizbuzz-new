# 🎓 Certificate Module API Documentation

This document covers endpoints for issuing, retrying, and retrieving digital certificates for contest participants.

---

## 📑 Table of Contents
1. [Issue Single Certificate](#1-issue-single-certificate)
2. [Bulk Issue Certificates](#2-bulk-issue-certificates)
3. [Retry Failed Certificates](#3-retry-failed-certificates)
4. [Get Certificate by ID](#4-get-certificate-by-id)
5. [List Certificates by Contest](#5-list-certificates-by-contest)
6. [List Certificates by Contact](#6-list-certificates-by-contact)
7. [Get Specific Contact/Contest Certificate](#7-get-specific-contactcontest-certificate)

---

## 1. Issue Single Certificate
Manually trigger certificate generation for a specific participant.

- **Method:** `POST`
- **Endpoint:** `/api/v1/certificates/issue`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `participantId` | `string` | Yes | |
| `contestId` | `string` | Yes | |

---

## 2. Bulk Issue Certificates
Trigger certificate generation for all eligible participants in a contest (e.g., those who passed or completed).

- **Method:** `POST`
- **Endpoint:** `/api/v1/certificates/bulk-issue`
- **Auth:** Admin

### Request Body (JSON)
```json
{
  "contestId": "contest_abc123",
  "minScore": 50
}
```

---

## 3. Retry Failed Certificates
Bulk retry all certificate generations that failed due to worker or email errors.

- **Method:** `POST`
- **Endpoint:** `/api/v1/certificates/retry-failed`
- **Auth:** Admin

---

## 4. Get Certificate by ID
Retrieve details and the PDF URL for a specific certificate record.

- **Method:** `GET`
- **Endpoint:** `/api/v1/certificates/:id`
- **Auth:** Admin

---

## 5. List Certificates by Contest
List all certificates issued for a particular event.

- **Method:** `GET`
- **Endpoint:** `/api/v1/certificates/contest/:contestId`
- **Auth:** Admin

---

## 6. List Certificates by Contact
Retrieve all certificates earned by a specific person across all organization contests.

- **Method:** `GET`
- **Endpoint:** `/api/v1/certificates/contact/:contactId`
- **Auth:** Admin

---

## 7. Get Specific Contact/Contest Certificate
Helper route to find a certificate if the specific ID is unknown.

- **Method:** `GET`
- **Endpoint:** `/api/v1/certificates/contact/:contactId/contest/:contestId`
- **Auth:** Admin
