# 🚀 Onboarding Module API Documentation

This document covers all endpoints for managing the initial setup and plan selection flow for new organizations.

---

## 📑 Table of Contents
1. [Get Onboarding Status](#1-get-onboarding-status)
2. [Save Step Progress](#2-save-step-progress)
3. [Complete Onboarding](#3-complete-onboarding)
4. [Get Subscription Plans](#4-get-subscription-plans)
5. [Create Handoff](#5-create-handoff)

---

## 1. Get Onboarding Status
**Description:** Retrieve the current completion state of the onboarding workflow.
**Business Logic:** Queries the database for the organization's onboarding progress flags (e.g., current step, completed steps) to resume the setup flow correctly upon login.

- **Method:** `GET`
- **Endpoint:** `/api/v1/onboarding/status`
- **Auth:** Admin (Organization JWT)

---

## 2. Save Step Progress
**Description:** Persist data for a specific step in the onboarding flow.
**Business Logic:** Validates the payload for the specified setup step (e.g., organization details, branding, plan selection) and updates the corresponding fields in the organization record.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/onboarding/step/:step`
- **Auth:** Admin (Organization JWT)

---

## 3. Complete Onboarding
**Description:** Finalize the onboarding process and activate the organization.
**Business Logic:** Verifies that all mandatory setup steps have been successfully completed, transitions the organization status to ACTIVE, and redirects the admin to the main dashboard.

- **Method:** `POST`
- **Endpoint:** `/api/v1/onboarding/complete`
- **Auth:** Admin (Organization JWT)

---

## 4. Get Subscription Plans
**Description:** Fetch available billing plans and pricing tiers.
**Business Logic:** Returns the hardcoded or database-driven list of subscription plans (e.g., Starter, Pro, Enterprise) available for the organization to select during the onboarding billing step.

- **Method:** `GET`
- **Endpoint:** `/api/v1/onboarding/plans`
- **Auth:** Admin (Organization JWT)

---

## 5. Create Handoff
**Description:** Generate a secure handoff link for external payment/billing setup.
**Business Logic:** If billing is handled via a third-party checkout provider (like Stripe or Razorpay subscriptions), this generates a secure, timed link and redirects the client to complete the transaction.

- **Method:** `POST`
- **Endpoint:** `/api/v1/onboarding/handoff`
- **Auth:** Admin (Organization JWT)
