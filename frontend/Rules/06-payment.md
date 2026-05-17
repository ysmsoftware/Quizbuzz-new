# 06 — Payment
**Wave 5 | Depends on: Wave 4 (registration)**

All payment processing is done through **Razorpay**. The backend manages order creation, webhook verification, and status tracking. The frontend only needs to open the Razorpay checkout modal and call the verify endpoint on success.

Base path: `/api/v1/payments`

---

## Full Payment Flow

```
POST /contests/register/:contestSlug
  returns: { paymentRequired: true, payment: { orderId, amount, currency, keyId } }
        │
        ▼
Frontend opens Razorpay checkout modal
        │
        ├─── User pays successfully ──► Razorpay calls your backend webhook automatically
        │                                POST /payments/webhook  (server-to-server)
        │                               Participant status → REGISTERED
        │
        └─── Frontend also calls:
             POST /payments/verify    ← manual verify after modal closes
                  │
                  ▼
             Show success screen with registrationRef
```

> The webhook and the verify endpoint are both idempotent. Whichever arrives first sets the payment as SUCCESS. The second call is a no-op.

---

## Endpoints at a Glance

| Method | Path | Auth | Description |
|--------|------|:---:|-------------|
| POST | `/payments/verify` | ✗ (public) | Verify payment after Razorpay checkout |
| POST | `/payments/webhook` | ✗ (Razorpay signature) | Razorpay server webhook |
| POST | `/payments/retry` | ✗ (public) | Create a new order for failed payment |
| GET | `/payments/status/:participantId` | ✗ (public) | Check payment status |
| GET | `/payments/events/:contestId` | ✓ Admin | List all payments for a contest |
| GET | `/payments/:paymentId` | ✓ Admin | Get single payment detail |
| POST | `/payments/:paymentId/refund` | ✓ Admin | Issue a refund |

---

## POST `/payments/verify`

Called by the **frontend** immediately after the Razorpay checkout modal reports a successful payment. This is a safety net alongside the webhook.

**Auth required:** No (public)  
**Idempotency:** Supported via `Idempotency-Key` header — send the `orderId` as the key.

### Request Headers

```
Idempotency-Key: order_ABC123XYZ
Content-Type: application/json
```

### Request Body

```json
{
  "razorpayOrderId":   "order_ABC123XYZ",
  "razorpayPaymentId": "pay_DEF456UVW",
  "razorpaySignature": "abc123def456...",
  "participantId":     "01HPART..."
}
```

| Field | Type | Source | Required |
|-------|------|--------|:---:|
| `razorpayOrderId` | string | Razorpay checkout response | ✓ |
| `razorpayPaymentId` | string | Razorpay checkout response | ✓ |
| `razorpaySignature` | string | Razorpay checkout response | ✓ |
| `participantId` | string | From registration response | ✓ |

### Response `200`

```json
{
  "success": true,
  "message": "Payment verified",
  "data": {
    "status": "SUCCESS",
    "participantId": "01HPART...",
    "registrationRef": "QB-2025-00142",
    "amount": 199,
    "currency": "INR",
    "paidAt": "2025-06-01T12:00:00.000Z"
  }
}
```

### Errors

| Status | Code | When |
|--------|------|------|
| 400 | `INVALID_SIGNATURE` | Signature mismatch — possible tampering |
| 404 | `NOT_FOUND` | Order ID not found |
| 409 | `ALREADY_PROCESSED` | Payment already verified (idempotent — return 200 instead) |

---

## POST `/payments/webhook`

Razorpay calls this endpoint server-to-server. **Do not call this from the frontend.**  
Configure this URL in your Razorpay dashboard under Webhooks.

**Auth required:** No (verified via `X-Razorpay-Signature` header)

### Webhook URL to configure in Razorpay Dashboard

```
https://your-domain.com/api/v1/payments/webhook
```

### Events Handled

| Event | Action |
|-------|--------|
| `payment.captured` | Mark payment SUCCESS, set participant REGISTERED, enqueue confirmation message |
| `payment.failed` | Mark payment FAILED, record failure reason |
| `refund.created` | Mark payment REFUNDED |

---

## POST `/payments/retry`

Creates a new Razorpay order for a participant whose previous payment failed or expired. The old failed payment record is retained for audit.

**Auth required:** No (public)  
**Idempotency:** Supported via `Idempotency-Key` header

### Request Body

```json
{
  "participantId": "01HPART..."
}
```

### Response `200`

```json
{
  "success": true,
  "data": {
    "orderId":  "order_NEW123XYZ",
    "amount":   19900,
    "currency": "INR",
    "keyId":    "rzp_live_xxxx"
  }
}
```

### Errors

| Status | When |
|--------|------|
| 400 | Previous payment already succeeded — no retry needed |
| 404 | Participant not found |

---

## GET `/payments/status/:participantId`

Check payment status for a participant. Shown on the registration confirmation page.

**Auth required:** No (public)

### Response `200`

```json
{
  "success": true,
  "data": {
    "status":   "SUCCESS",
    "amount":   199,
    "currency": "INR",
    "paidAt":   "2025-06-01T12:00:00.000Z"
  }
}
```

**Status values:** `CREATED`, `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`, `REFUNDED`

---

## GET `/payments/events/:contestId`

Admin view — list all payments for a contest with pagination and filters.

**Auth required:** ✓

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `status` | enum | Filter by payment status |
| `page` | number | Default: 1 |
| `limit` | number | Default: 50 |

### Response `200`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "01HPAY...",
        "amount": 199,
        "currency": "INR",
        "status": "SUCCESS",
        "provider": "RAZORPAY",
        "razorpayOrderId": "order_ABC123XYZ",
        "razorpayPaymentId": "pay_DEF456UVW",
        "paidAt": "2025-06-01T12:00:00.000Z",
        "attempts": 1,
        "participant": {
          "id": "01HPART...",
          "registrationRef": "QB-2025-00142"
        },
        "contact": {
          "firstName": "Rahul",
          "lastName": "Mehta",
          "email": "rahul@example.com"
        }
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 142, "totalPages": 3 },
    "summary": {
      "totalRevenue": 28258,
      "successCount": 142,
      "failedCount": 8,
      "refundedCount": 2
    }
  }
}
```

---

## GET `/payments/:paymentId`

Full detail of a single payment record.

**Auth required:** ✓

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "01HPAY...",
    "amount": 199,
    "currency": "INR",
    "status": "SUCCESS",
    "provider": "RAZORPAY",
    "razorpayOrderId": "order_ABC123XYZ",
    "razorpayPaymentId": "pay_DEF456UVW",
    "razorpayStatus": "captured",
    "paidAt": "2025-06-01T12:00:00.000Z",
    "webhookConfirmed": true,
    "attempts": 1,
    "failureReason": null,
    "metadata": { "vpa": "rahul@upi", "method": "upi" },
    "participant": {
      "id": "01HPART...",
      "registrationRef": "QB-2025-00142",
      "contact": {
        "firstName": "Rahul",
        "lastName": "Mehta",
        "email": "rahul@example.com",
        "phone": "+919876543210"
      }
    }
  }
}
```

---

## POST `/payments/:paymentId/refund`

Issue a refund for a successful payment. The participant's status is set to `REGISTERED → ABSENT`. A refund notification message is sent.

**Auth required:** ✓ (OWNER or ADMIN)

### Request Body

```json
{
  "reason": "Participant requested withdrawal due to medical emergency"
}
```

### Response `200`

```json
{
  "success": true,
  "message": "Refund initiated",
  "data": {
    "paymentId": "01HPAY...",
    "status": "REFUNDED",
    "amount": 199
  }
}
```

---

## Frontend Razorpay Integration

Install the Razorpay checkout script in your HTML:

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

Or load it dynamically:

```ts
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
```

Complete payment handler after registration returns `paymentRequired: true`:

```ts
async function openRazorpayCheckout(payment: {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}, participantId: string, contactEmail: string) {

  await loadRazorpay();

  const options = {
    key: payment.keyId,
    amount: payment.amount,          // in paise (19900 = ₹199)
    currency: payment.currency,
    order_id: payment.orderId,
    name: "QuizBuzz",
    description: "Contest Registration Fee",
    handler: async (response: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      // Payment succeeded in Razorpay — now verify with backend
      const verifyRes = await fetch("/api/v1/payments/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": response.razorpay_order_id
        },
        body: JSON.stringify({
          razorpayOrderId:   response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
          participantId
        })
      });
      const data = await verifyRes.json();
      if (data.success) {
        // Navigate to success screen
        router.push(`/quiz/registration-success?ref=${data.data.registrationRef}`);
      }
    },
    prefill: { email: contactEmail },
    theme: { color: "#6366f1" },
    modal: {
      ondismiss: () => {
        // User closed without paying — show retry option
        setShowRetry(true);
      }
    }
  };

  const rzp = new (window as any).Razorpay(options);
  rzp.open();
}
```

### Retry Failed Payment

If the user closes the modal or payment fails:

```ts
async function retryPayment(participantId: string) {
  const res = await fetch("/api/v1/payments/retry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `retry-${participantId}-${Date.now()}`
    },
    body: JSON.stringify({ participantId })
  });
  const data = await res.json();
  if (data.success) {
    // Re-open Razorpay with new order
    openRazorpayCheckout(data.data, participantId, contactEmail);
  }
}
```
