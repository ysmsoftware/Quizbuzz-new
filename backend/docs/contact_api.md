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
Manually add a person to the organization's database.

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
Quickly find a contact by their unique identifiers (email or phone).

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts/lookup`
- **Auth:** Admin

### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | `string` | No* | One of email or phone must be provided. |
| `phone` | `string` | No* | |

---

## 3. List Contacts
Fetch the entire contact list with advanced filtering.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts`
- **Auth:** Admin

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
Retrieve the full profile and custom fields for a single contact.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts/:id`
- **Auth:** Admin

---

## 5. Update Contact
Modify contact information.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/contacts/:id`
- **Auth:** Admin

---

## 6. Delete Contact
Soft-delete a contact. This removes them from active lists but retains historical contest records.

- **Method:** `DELETE`
- **Endpoint:** `/api/v1/contacts/:id`
- **Auth:** Admin

---

## 7. Get Contact Registrations
List all contests this contact has registered for.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts/:id/contests`
- **Auth:** Admin

---

## 8. Get Contact Message History
List all Email/WhatsApp communications sent to this specific contact.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts/:id/messages`
- **Auth:** Admin

---

## 9. Get Contact Certificates
Fetch all certificates issued to this contact across different contests.

- **Method:** `GET`
- **Endpoint:** `/api/v1/contacts/:id/certificates`
- **Auth:** Admin
