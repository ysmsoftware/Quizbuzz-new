# 🎓 Certificate Module API Documentation

This document covers endpoints for issuing, retrying, and retrieving digital certificates for contest participants.

---

## 📑 Table of Contents
1. [Get Public Certificate](#1-get-public-certificate)
2. [Issue Single Certificate](#2-issue-single-certificate)
3. [Bulk Issue Certificates](#3-bulk-issue-certificates)
4. [Retry Failed Certificates](#4-retry-failed-certificates)
5. [Get Certificate by ID](#5-get-certificate-by-id)
6. [List Certificates by Contest](#6-list-certificates-by-contest)
7. [List Certificates by Contact](#7-list-certificates-by-contact)
8. [Get Specific Contact/Contest Certificate](#8-get-specific-contactcontest-certificate)
9. [Retry Specific Certificate](#9-retry-specific-certificate)

---

## 1. Get Public Certificate
**Description:** View or download a certificate publicly.
**Business Logic:** Serves the certificate payload directly to unauthenticated users, typically accessed via a QR code or shared link by the participant.

- **Method:** `GET`
- **Endpoint:** `/api/v1/certificates/public/:id`
- **Auth:** **Public**

---

## 2. Issue Single Certificate
**Description:** Manually trigger certificate generation for a specific participant.
**Business Logic:** Enqueues a job to generate a PDF certificate based on the contest template and emails it to the participant.

- **Method:** `POST`
- **Endpoint:** `/api/v1/certificates/issue`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `participantId` | `string` | Yes | |
| `contestId` | `string` | Yes | |

---

## 3. Bulk Issue Certificates
**Description:** Trigger certificate generation for all eligible participants in a contest.
**Business Logic:** Iterates over participants who meet the optional criteria (like `minScore`) and enqueues bulk PDF generation and email delivery jobs for them.

- **Method:** `POST`
- **Endpoint:** `/api/v1/certificates/bulk-issue`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
```json
{
  "contestId": "contest_abc123",
  "minScore": 50
}
```

---

## 4. Retry Failed Certificates
**Description:** Bulk retry all failed certificate generation jobs.
**Business Logic:** Queries the database for all certificates marked with a `FAILED` status and re-enqueues them to the background worker for processing.

- **Method:** `POST`
- **Endpoint:** `/api/v1/certificates/retry-failed`
- **Auth:** Admin (Organization JWT)

---

## 5. Get Certificate by ID
**Description:** Retrieve details and the PDF URL for a specific certificate record.
**Business Logic:** Fetches the metadata and storage URL of a generated certificate, verifying that it belongs to the admin's organization.

- **Method:** `GET`
- **Endpoint:** `/api/v1/certificates/:id`
- **Auth:** Admin (Organization JWT)

---

## 6. List Certificates by Contest
**Description:** List all certificates issued for a particular event.
**Business Logic:** Returns a paginated list of all certificate records tied to a given contest, including their current generation/delivery status.

- **Method:** `GET`
- **Endpoint:** `/api/v1/certificates/contest/:contestId`
- **Auth:** Admin (Organization JWT)

---

## 7. List Certificates by Contact
**Description:** Retrieve all certificates earned by a specific person across all organization contests.
**Business Logic:** Aggregates and returns the historical certificates issued to a specific contact (email/user) within the context of the current organization.

- **Method:** `GET`
- **Endpoint:** `/api/v1/certificates/contact/:contactId`
- **Auth:** Admin (Organization JWT)

---

## 8. Get Specific Contact/Contest Certificate
**Description:** Fetch a certificate record using the contact and contest identifiers.
**Business Logic:** Helper route that resolves a certificate if the specific certificate ID is unknown, relying on the unique compound constraint of contact and contest.

- **Method:** `GET`
- **Endpoint:** `/api/v1/certificates/contact/:contactId/contest/:contestId`
- **Auth:** Admin (Organization JWT)

---

## 9. Retry Specific Certificate
**Description:** Retry a single failed certificate generation job.
**Business Logic:** Resets the failure status of a specific certificate and pushes it back into the worker queue for rendering and delivery.

- **Method:** `POST`
- **Endpoint:** `/api/v1/certificates/:id/retry`
- **Auth:** Admin (Organization JWT)
