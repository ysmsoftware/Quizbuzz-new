# 👤 Contact Module API Documentation

This document covers all 9 endpoints for managing the master list of potential participants (Contacts).

---

## 📑 Table of Contents
1. [Create Contact](#1-create-contact)
2. [Lookup Contact](#2-lookup-contact)
3. [List Contacts](#3-list-contacts)
4. [Get Contact by ID](#4-get-contact-by-id)
5. [Update Contact](#5-update-contact)
6. [Delete Contact](#6-delete-contact)
7. [Get Contact Registrations](#7-get-contact-registrations)
8. [Get Contact Message History](#8-get-contact-message-history)
9. [Get Contact Certificates](#9-get-contact-certificates)

---

## 1. Create Contact
**Description:** Manually add a person to the organization's contact database.
**Business Logic:** Validates the contact's email or phone, ensuring uniqueness within the organization's scope, and stores their profile (name, college, city) for future event registrations or marketing.

- **Method:** `POST`
- **Endpoint:** `/api/v1/contacts`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | Valid email address. |
| `phone` | `string` | No | E.164 format (e.g. +919876543210). |
| `firstName` | `string` | Yes | Max 100 chars. |
| `lastName` | `string` | No | Max 100 chars. |
| `college` | `string` | No | |
| `city` | `string` | No | |

```json
{
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+919876543211",
  "college": "Stanford"
}
```

---

## 2. Lookup Contact
**Description:** Find a specific contact by their email address or phone number.
**Business Logic:** Performs an exact match query against the organization's contact list using the provided identifiers. Used to quickly check if a user is already in the database before creating a new entry.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts/lookup`
- **Auth:** Admin (Organization JWT)

### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | `string` | No* | One of email or phone must be provided. |
| `phone` | `string` | No* | |

---

## 3. List Contacts
**Description:** Fetch the organization's entire contact list with optional advanced filtering.
**Business Logic:** Supports paginated queries, fuzzy searching on name/email/phone, and exact filtering by institution or city to help admins manage and segment their audience.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts`
- **Auth:** Admin (Organization JWT)

### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `search` | `string` | - | Fuzzy search on name, email, or phone. |
| `college` | `string` | - | Filter by institution. |
| `city` | `string` | - | Filter by location. |
| `page` | `number` | `1` | |
| `limit` | `number` | `20` | Max 100. |

---

## 4. Get Contact by ID
**Description:** Retrieve the full profile and custom fields for a single contact.
**Business Logic:** Queries the database for the complete contact record matching the given ID, ensuring it belongs to the authenticated admin's organization.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts/:id`
- **Auth:** Admin (Organization JWT)

---

## 5. Update Contact
**Description:** Modify an existing contact's profile information.
**Business Logic:** Applies partial updates to the contact's demographic data (name, phone, college, etc.) while ensuring the changes don't violate uniqueness constraints within the org.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/contacts/:id`
- **Auth:** Admin (Organization JWT)

---

## 6. Delete Contact
**Description:** Soft-delete a contact from the database.
**Business Logic:** Flags the contact as deleted rather than permanently erasing the record. This hides them from active lists but retains referential integrity for historical contest records and logs.

- **Method:** `DELETE`
- **Endpoint:** `/api/v1/contacts/:id`
- **Auth:** Admin (Organization JWT)

---

## 7. Get Contact Registrations
**Description:** List all contests this contact has registered for.
**Business Logic:** Queries the participants/registrations table filtering by the specific contact ID to show a history of their engagement across the organization's events.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts/:id/contests`
- **Auth:** Admin (Organization JWT)

---

## 8. Get Contact Message History
**Description:** List all Email and WhatsApp communications sent to this specific contact.
**Business Logic:** Aggregates message logs tied to the contact's email or phone number to provide a complete audit trail of the organization's outreach to them.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts/:id/messages`
- **Auth:** Admin (Organization JWT)

---

## 9. Get Contact Certificates
**Description:** Fetch all certificates issued to this contact across different contests.
**Business Logic:** Retrieves the metadata and download links for all digital certificates the contact has successfully earned within the organization's events.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts/:id/certificates`
- **Auth:** Admin (Organization JWT)
