# 🏢 Organization Module API Documentation

This document provides details for all endpoints related to organization management, team member invitations, and role configuration.

---

## 📑 Table of Contents
1. [Get Organization](#1-get-organization)
2. [Update Organization](#2-update-organization)
3. [Update Organization Profile](#3-update-organization-profile)
4. [Get Members](#4-get-members)
5. [Invite Member](#5-invite-member)
6. [Update Member Role](#6-update-member-role)
7. [Remove Member](#7-remove-member)
8. [Accept Invitation](#8-accept-invitation)

---

## 1. Get Organization
**Description:** Retrieve the details of a specific organization.
**Business Logic:** Fetches the core details of an organization using its unique ID, returning its profile and configuration. 

- **Method:** `GET`
- **Endpoint:** `/api/v1/org/:orgId`
- **Auth:** Admin (Organization JWT)

---

## 2. Update Organization
**Description:** Update the core details of an organization.
**Business Logic:** Modifies the fundamental properties of the organization, such as its name, logo, or website. Requires Admin authorization.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/org/:orgId`
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

## 3. Update Organization Profile
**Description:** Update the profile settings of an organization.
**Business Logic:** Allows fine-grained updates to the organization's extended profile details. Handled separately from core details for isolation.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/org/:orgId/profile`
- **Auth:** Admin (Organization JWT)

---

## 4. Get Members
**Description:** List all team members in the organization.
**Business Logic:** Retrieves an array of all members associated with the specified organization along with their respective roles.

- **Method:** `GET`
- **Endpoint:** `/api/v1/org/:orgId/members`
- **Auth:** Admin (Organization JWT)

**Response Body:** Returns an array of member objects containing `userId`, `email`, `role`, and `name`.

---

## 5. Invite Member
**Description:** Send an invitation link to a new team member.
**Business Logic:** Creates an invitation token and dispatches an email to the invitee, specifying their future role (e.g., OWNER, ADMIN, VIEWER).

- **Method:** `POST`
- **Endpoint:** `/api/v1/org/:orgId/members/invite`
- **Auth:** Admin (Organization JWT)

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

## 6. Update Member Role
**Description:** Change the role permissions of an existing team member.
**Business Logic:** Updates a specific member's access level within the organization, altering their privileges based on the newly assigned role.

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/org/:orgId/members/:memberId/role`
- **Auth:** Admin (Organization JWT)

### Request Body (JSON)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `role` | `enum` | Yes | `OWNER`, `ADMIN`, or `VIEWER`. |

---

## 7. Remove Member
**Description:** Revoke a user's access to the organization.
**Business Logic:** Removes the specified member from the organization entirely, stripping them of all access and permissions immediately.

- **Method:** `DELETE`
- **Endpoint:** `/api/v1/org/:orgId/members/:memberId`
- **Auth:** Admin (Organization JWT)

---

## 8. Accept Invitation
**Description:** Finalize the onboarding of a new member.
**Business Logic:** Consumes the unique invitation token received via email and adds the user to the organization with the predefined role.

- **Method:** `POST`
- **Endpoint:** `/api/v1/org/invite/accept`
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
