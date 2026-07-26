# 💸 Payout Module API Documentation

This document covers all endpoints for managing organization payout accounts and tracking revenue transfers (e.g. from Razorpay Route or Stripe Connect).

---

## 📑 Table of Contents
1. [Setup Payout Account](#1-setup-payout-account)
2. [Get Payout Account](#2-get-payout-account)
3. [Attach Linked Account](#3-attach-linked-account)
4. [List Transfers](#4-list-transfers)
5. [Get Transfer Summary](#5-get-transfer-summary)

---

## 1. Setup Payout Account
**Description:** Initialize a payout account configuration for the organization.
**Business Logic:** Triggers the creation of a connected account on the payment gateway (e.g. Razorpay Linked Account) so the organization can receive their share of entry fees.

- **Method:** `POST`
- **Endpoint:** `/api/v1/payout/setup`
- **Auth:** Admin (Organization JWT)
- **Headers:** `X-Idempotency-Key` (Recommended)

---

## 2. Get Payout Account
**Description:** Retrieve the current payout account details and status.
**Business Logic:** Queries the database and payment gateway to check if the organization's linked account is active, pending KYC verification, or suspended.

- **Method:** `GET`
- **Endpoint:** `/api/v1/payout/account`
- **Auth:** Admin (Organization JWT)

---

## 3. Attach Linked Account
**Description:** Finalize the linkage of an external payout account.
**Business Logic:** Accepts the account ID returned by the payment gateway's onboarding flow and links it to the organization's profile for future automated transfers.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/payout/link`
- **Auth:** Admin (Organization JWT)

---

## 4. List Transfers
**Description:** Fetch a ledger of all automated revenue transfers sent to the organization.
**Business Logic:** Returns a paginated list of payout transfers (e.g., weekly settlements from contest ticket sales), including timestamps, amounts, and statuses (processed, failed).

- **Method:** `GET`
- **Endpoint:** `/api/v1/payout/transfers`
- **Auth:** Admin (Organization JWT)

---

## 5. Get Transfer Summary
**Description:** Retrieve aggregated metrics of revenue payouts.
**Business Logic:** Aggregates transfer records to provide a high-level summary of total earnings, pending settlements, and total transferred volume for the organization's finance dashboard.

- **Method:** `GET`
- **Endpoint:** `/api/v1/payout/summary`
- **Auth:** Admin (Organization JWT)
