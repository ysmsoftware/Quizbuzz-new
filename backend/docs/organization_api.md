# 🏢 Organization Module API Documentation

This document provides details for all 6 endpoints related to organization management, team member invitations, and role configuration.

---

## 📑 Table of Contents
1. [Update Organization](#1-update-organization)
2. [Get Members](#2-get-members)
3. [Invite Member](#3-invite-member)
4. [Update Member Role](#4-update-member-role)
5. [Remove Member](#5-remove-member)
6. [Accept Invitation](#6-accept-invitation)

---

## 1. Update Organization
Modify the core details of your organization.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/org`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | No | 2-100 characters. |
| `logoUrl` | `string` | No | Valid URL for the logo image. |
| `website` | `string` | No | Valid URL for the official website. |

```json
{
  "name": "QuizBuzz Global",
  "logoUrl": "https://cdn.example.com/logo.png",
  "website": "https://quizbuzz.io"
}
```

---

## 2. Get Members
List all team members currently associated with the organization.

- **Method:** `GET`
- **Endpoint:** `/api/v1/org/members`
- **Auth:** Admin

**Response Body:** Returns an array of member objects containing `userId`, `email`, `role`, and `name`.

---

## 3. Invite Member
Send an invitation link to a new team member via email.

- **Method:** `POST`
- **Endpoint:** `/api/v1/org/members/invite`
- **Auth:** Admin

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | Recipient's email address. |
| `role` | `enum` | Yes | `OWNER`, `ADMIN`, or `VIEWER`. |

```json
{
  "email": "colleague@example.com",
  "role": "ADMIN"
}
```

---

## 4. Update Member Role
Change the permissions of an existing team member.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/org/members/:userId/role`
- **Auth:** Admin

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `role` | `enum` | Yes | `OWNER`, `ADMIN`, or `VIEWER`. |

---

## 5. Remove Member
Revoke a user's access to the organization.

- **Method:** `DELETE`
- **Endpoint:** `/api/v1/org/members/:userId`
- **Auth:** Admin

---

## 6. Accept Invitation
Finalize the onboarding of a new member using their unique invitation token.

- **Method:** `POST`
- **Endpoint:** `/api/v1/org/members/invite/accept`
- **Auth:** **Public**

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `token` | `string` | Yes | Unique token from the invitation email. |

```json
{
  "token": "inv_abc123..."
}
```
