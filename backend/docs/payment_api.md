# 💳 Payment Module API Documentation

This document covers all 7 endpoints for managing contest entry fees and processing payments via Razorpay.

---

## 📑 Table of Contents
1. [Create Order (Participant)](#1-create-order-participant)
2. [Verify Payment (Participant)](#2-verify-payment-participant)
3. [Retry Payment](#3-retry-payment)
4. [List Contest Payments (Admin)](#4-list-contest-payments-admin)
5. [List All Payments (Admin)](#5-list-all-payments-admin)
6. [Get Payment Details (Admin)](#6-get-payment-details-admin)
7. [Cancel Payment](#7-cancel-payment)

---

## 1. Create Order (Participant)
Initiate a payment for a paid contest. This returns a `razorpayOrderId` which must be used with the Razorpay Checkout SDK.

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
Verify the payment signature after a successful transaction on the client-side.

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
Regenerate an order for a participant whose previous attempt failed or expired.

- **Method:** `POST`
- **Endpoint:** `/api/v1/payment/retry`
- **Auth:** Public / Participant

---

## 4. List Contest Payments (Admin)
Fetch all payment transactions associated with a specific contest.

- **Method:** `GET`
- **Endpoint:** `/api/v1/payment/events/:contestId`
- **Auth:** Admin

---

## 5. List All Payments (Admin)
Global view of all transactions in the organization.

- **Method:** `GET`
- **Endpoint:** `/api/v1/payment`
- **Auth:** Admin

### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `status` | `enum` | - | `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`. |
| `limit` | `number` | `50` | |
| `contactId`| `string` | - | Filter by a specific customer. |

---

## 6. Get Payment Details (Admin)
Retrieve full transaction logs and Razorpay metadata for a specific payment record.

- **Method:** `GET`
- **Endpoint:** `/api/v1/payment/:paymentId`
- **Auth:** Admin

---

## 7. Cancel Payment
Mark a pending payment order as cancelled.

- **Method:** `POST`
- **Endpoint:** `/api/v1/payment/:paymentId/cancel`
- **Auth:** Admin
