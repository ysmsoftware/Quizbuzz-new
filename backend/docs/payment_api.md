# 💳 Payment Module API Documentation

This document covers all endpoints for managing contest entry fees and processing payments via Razorpay.

---

## 📑 Table of Contents
1. [Create Order (Participant)](#1-create-order-participant)
2. [Verify Payment (Participant)](#2-verify-payment-participant)
3. [Retry Payment](#3-retry-payment)
4. [Get Payment Status](#4-get-payment-status)
5. [List Contest Payments (Admin)](#5-list-contest-payments-admin)
6. [List All Payments (Admin)](#6-list-all-payments-admin)
7. [Get Payment Details (Admin)](#7-get-payment-details-admin)
8. [Cancel Payment](#8-cancel-payment)

---

## 1. Create Order (Participant)
**Description:** Initiate a payment for a paid contest.
**Business Logic:** Validates the participant's registration and the contest's fee structure, generating a Razorpay `orderId` required by the client SDK to launch the checkout modal.

- **Method:** `POST`
- **Endpoint:** `/api/v1/payment/create-order`
- **Auth:** Public / Participant (Registration reference required in logic)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `contestId` | `string` | Yes | The ID of the paid contest. |
| `participantId`| `string` | Yes | The ID received after registration. |

**Response Body:** Returns `orderId`, `amount`, `currency`, and `key` (Razorpay Key ID).

---

## 2. Verify Payment (Participant)
**Description:** Verify the payment signature after a successful transaction on the client-side.
**Business Logic:** Cryptographically verifies the Razorpay signature sent by the client, updates the internal payment record to SUCCESS, and transitions the participant status to active.

- **Method:** `POST`
- **Endpoint:** `/api/v1/payment/verify`
- **Auth:** Public / Participant

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `razorpayPaymentId`| `string` | Yes | |
| `razorpayOrderId` | `string` | Yes | |
| `razorpaySignature`| `string` | Yes | |

```json
{
  "razorpayPaymentId": "pay_O7pL...",
  "razorpayOrderId": "order_O7pK...",
  "razorpaySignature": "23e5..."
}
```

---

## 3. Retry Payment
**Description:** Regenerate an order for a participant whose previous attempt failed or expired.
**Business Logic:** Creates a fresh Razorpay order for an existing participant record that has a failed or expired payment history, allowing them to re-attempt checkout.

- **Method:** `POST`
- **Endpoint:** `/api/v1/payment/retry`
- **Auth:** Public / Participant

---

## 4. Get Payment Status
**Description:** Check the real-time payment status of a participant.
**Business Logic:** Queries the database for the latest payment record associated with a specific participant ID, returning states like PENDING, SUCCESS, or FAILED.

- **Method:** `GET`
- **Endpoint:** `/api/v1/payment/status/:participantId`
- **Auth:** Public / Participant

---

## 5. List Contest Payments (Admin)
**Description:** Fetch all payment transactions associated with a specific contest.
**Business Logic:** Returns a paginated list of all payment attempts tied to a given contest, aggregating revenue data for the organization's event dashboard.

- **Method:** `GET`
- **Endpoint:** `/api/v1/payment/events/:contestId`
- **Auth:** Admin (Organization JWT)

---

## 6. List All Payments (Admin)
**Description:** Global view of all transactions across the organization.
**Business Logic:** Serves the main billing dashboard, providing a filtered, paginated ledger of all inbound payments across all contests hosted by the organization.

- **Method:** `GET`
- **Endpoint:** `/api/v1/payment`
- **Auth:** Admin (Organization JWT)

### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `status` | `enum` | - | `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`. |
| `limit` | `number` | `50` | |
| `contactId`| `string` | - | Filter by a specific customer. |

---

## 7. Get Payment Details (Admin)
**Description:** Retrieve full transaction logs and metadata for a specific payment record.
**Business Logic:** Looks up the exact transaction payload, including underlying Razorpay response objects and timestamps, for auditing or dispute resolution.

- **Method:** `GET`
- **Endpoint:** `/api/v1/payment/:paymentId`
- **Auth:** Admin (Organization JWT)

---

## 8. Cancel Payment
**Description:** Mark a pending payment order as cancelled.
**Business Logic:** Aborts an ongoing payment intent, updating the local state to CANCELLED to prevent double-charging or stale order completion.

- **Method:** `POST`
- **Endpoint:** `/api/v1/payment/:paymentId/cancel`
- **Auth:** Admin (Organization JWT)
