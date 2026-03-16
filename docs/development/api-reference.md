# API Reference

Complete reference for all CoachFit API endpoints.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Client Endpoints](#client-endpoints)
4. [Coach Endpoints](#coach-endpoints)
5. [Admin Endpoints](#admin-endpoints)
6. [Common Patterns](#common-patterns)

---

## Overview

### Base URL

```
Local: http://localhost:3000/api
Production: https://your-domain.vercel.app/api
```

### Authentication

All protected endpoints require authentication via Clerk session.

### Response Format

**Success**:
```json
{
  "data": { /* result */ }
}
```

**Error**:
```json
{
  "error": "Error message",
  "details": [] // optional
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (not authorized)
- `404` - Not Found
- `500` - Internal Server Error

---

## Authentication Endpoints

### POST /api/auth/signup

Create new user account with email/password.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"  // optional
}
```

**Response**:
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "roles": ["CLIENT"]
    }
  }
}
```

**Validation**:
- Email: must be valid email format
- Password: minimum 8 characters

### Authentication (Clerk Managed)

Authentication is handled entirely by Clerk. Sign-in, sign-up, and session management are managed via Clerk's pre-built components and middleware.

**Providers** (configured in Clerk Dashboard):
- Google OAuth
- Email/Password

**Webhook**: `POST /api/webhooks` — Clerk webhook handler for user sync (creates local DB user, processes invites, sends welcome email).

See **[Authentication Setup](./authentication.md)** for details.

---

## Client Endpoints

### GET /api/entries

Get authenticated user's entries.

**Auth Required**: CLIENT role

**Query Parameters**:
- `startDate` (optional): Filter entries from this date
- `endDate` (optional): Filter entries to this date

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "date": "2025-01-15",
      "weightLbs": 175.5,
      "steps": 10000,
      "calories": 2000,
      "sleepQuality": 8,
      "perceivedStress": 6,
      "notes": "Great workout today",
      "customResponses": {},
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/entries

Create or update entry for authenticated user.

**Auth Required**: CLIENT role

**Request Body**:
```json
{
  "date": "2025-01-15",
  "weightLbs": 175.5,    // optional
  "steps": 10000,        // optional
  "calories": 2000,      // optional
  "sleepQuality": 8,     // optional (1-10)
  "perceivedStress": 6,  // optional (1-10)
  "notes": "Text",       // optional
  "customResponses": {}  // optional
}
```

**Response**:
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "date": "2025-01-15",
    "weightLbs": 175.5,
    // ... all fields
  }
}
```

**Validation**:
- At least one field must be provided
- Date cannot be in the future
- Sleep quality: 1-10
- Perceived effort: 1-10

**Behavior**: Upserts (creates or updates) based on unique constraint `[userId, date]`.

### GET /api/entries/check-membership

Check if user has a coach assignment.

**Auth Required**: CLIENT role

**Response**:
```json
{
  "data": {
    "hasCoach": true,
    "cohorts": [
      {
        "id": "uuid",
        "name": "Spring 2024 Challenge"
      }
    ]
  }
}
```

### GET /api/entries/check-in-config

Get check-in configuration for user's cohorts.

**Auth Required**: CLIENT role

**Response**:
```json
{
  "data": {
    "enabledPrompts": ["weight", "steps", "calories", "sleepQuality"],
    "customPrompts": []
  }
}
```

### GET /api/client/settings

Get authenticated client's settings.

**Auth Required**: CLIENT role

**Response**:
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "client@example.com",
      "name": "Client Name",
      "emailVerified": null,
      "image": null,
      "roles": ["CLIENT"],
      "accounts": [
        {
          "provider": "google",
          "providerAccountId": "123"
        }
      ]
    }
  }
}
```

### POST /api/client/change-password

Change password for authenticated client.

**Auth Required**: CLIENT role (must have passwordHash)

**Request Body**:
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

**Response**:
```json
{
  "data": {
    "success": true
  }
}
```

---

## Coach Endpoints

### GET /api/cohorts

Get all cohorts for authenticated coach.

**Auth Required**: COACH role

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Spring 2024 Challenge",
      "coachId": "uuid",
      "createdAt": "2024-01-01T00:00:00Z",
      "memberships": [
        {
          "userId": "uuid",
          "user": {
            "id": "uuid",
            "name": "Client Name",
            "email": "client@example.com"
          }
        }
      ],
      "invites": []
    }
  ]
}
```

### POST /api/cohorts

Create new cohort.

**Auth Required**: COACH role

**Request Body**:
```json
{
  "name": "Spring 2024 Challenge",
  "checkInConfig": {  // optional
    "enabledPrompts": ["weight", "steps"],
    "customPrompt1": "How was your energy?",
    "customPrompt1Type": "scale"
  }
}
```

**Response**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Spring 2024 Challenge",
    "coachId": "uuid",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

### GET /api/cohorts/[id]

Get cohort details (ownership required).

**Auth Required**: COACH role + cohort ownership (or ADMIN)

**Response**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Spring 2024 Challenge",
    "coachId": "uuid",
    "createdAt": "2025-01-15T10:00:00Z",
    "memberships": [],
    "invites": []
  }
}
```

### DELETE /api/cohorts/[id]

Delete cohort (ownership required).

**Auth Required**: COACH role + cohort ownership (or ADMIN)

**Response**:
```json
{
  "data": {
    "success": true
  }
}
```

### GET /api/cohorts/[id]/clients

List clients in cohort.

**Auth Required**: COACH role + cohort ownership (or ADMIN)

**Response**:
```json
{
  "data": [
    {
      "userId": "uuid",
      "user": {
        "id": "uuid",
        "name": "Client Name",
        "email": "client@example.com"
      }
    }
  ]
}
```

### POST /api/cohorts/[id]/clients

Invite client to cohort.

**Auth Required**: COACH role + cohort ownership (or ADMIN)

**Request Body**:
```json
{
  "email": "client@example.com"
}
```

**Response**:
```json
{
  "data": {
    "invite": {
      "id": "uuid",
      "email": "client@example.com",
      "cohortId": "uuid",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  }
}
```

### GET /api/cohorts/[id]/analytics

Get cohort analytics.

**Auth Required**: COACH role + cohort ownership (or ADMIN)

**Response**:
```json
{
  "data": {
    "cohortSummary": {
      "activeClients": 5,
      "avgWeightChange": -2.5,
      "avgSteps7Day": 8500,
      "avgSteps30Day": 9000
    },
    "clientMetrics": [
      {
        "userId": "uuid",
        "name": "Client Name",
        "latestWeight": 175.5,
        "weightChange": -2.0,
        "avgSteps7Day": 9000,
        "avgSteps30Day": 9500
      }
    ]
  }
}
```

### GET /api/clients/[id]

Get client details.

**Auth Required**: COACH role (client must be in coach's cohort)

**Response**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Client Name",
    "email": "client@example.com",
    "cohorts": ["Spring 2024 Challenge"]
  }
}
```

### GET /api/clients/[id]/entries

Get client's entries.

**Auth Required**: COACH role (client must be in coach's cohort)

**Query Parameters**:
- `startDate` (optional)
- `endDate` (optional)

**Response**: Same as GET /api/entries

### GET /api/clients/[id]/analytics

Get client analytics.

**Auth Required**: COACH role (client must be in coach's cohort)

**Response**: Analytics data for individual client.

### POST /api/clients/[id]/assign

Assign client to cohort.

**Auth Required**: COACH role

**Request Body**:
```json
{
  "cohortId": "uuid"
}
```

**Response**:
```json
{
  "data": {
    "success": true
  }
}
```

### GET /api/coach-dashboard/overview

Get coach dashboard summary.

**Auth Required**: COACH role

**Response**:
```json
{
  "data": {
    "totalClients": 15,
    "activeClients": 12,
    "pendingInvites": 3,
    "cohorts": 5
  }
}
```

### GET /api/invites

List all invitations (coach's invites).

**Auth Required**: COACH role

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "client@example.com",
      "cohortId": "uuid",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/invites

Create global coach invite (not cohort-specific).

**Auth Required**: COACH role

**Request Body**:
```json
{
  "email": "client@example.com"
}
```

**Response**:
```json
{
  "data": {
    "id": "uuid",
    "email": "client@example.com",
    "coachId": "uuid",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

### DELETE /api/invites/[id]

Cancel invitation.

**Auth Required**: COACH role (ownership required)

**Response**:
```json
{
  "data": {
    "success": true
  }
}
```

---

## Admin Endpoints

### GET /api/admin/users

List all users.

**Auth Required**: ADMIN role

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "roles": ["CLIENT", "COACH"],
      "createdAt": "2025-01-01T00:00:00Z",
      "accounts": [
        {
          "provider": "google"
        }
      ],
      "cohortMemberships": [],
      "coachedCohorts": []
    }
  ]
}
```

### POST /api/admin/users/[id]/roles

Update user roles.

**Auth Required**: ADMIN role

**Request Body**:
```json
{
  "roles": ["CLIENT", "COACH"]
}
```

**Response**:
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "roles": ["CLIENT", "COACH"]
    }
  }
}
```

### POST /api/admin/users/[id]/reset-password

Reset user password.

**Auth Required**: ADMIN role

**Request Body**:
```json
{
  "newPassword": "newpassword123"
}
```

**Response**:
```json
{
  "data": {
    "success": true
  }
}
```

### GET /api/admin/coaches

List all coaches.

**Auth Required**: ADMIN role

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "coach@example.com",
      "name": "Coach Name",
      "roles": ["COACH"],
      "cohortCount": 5,
      "clientCount": 15
    }
  ]
}
```

### POST /api/admin/coaches

Create new coach account.

**Auth Required**: ADMIN role

**Request Body**:
```json
{
  "email": "coach@example.com",
  "name": "Coach Name",
  "password": "password123"
}
```

**Response**:
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "coach@example.com",
      "name": "Coach Name",
      "roles": ["COACH"]
    }
  }
}
```

### GET /api/admin/cohorts

List all cohorts (platform-wide).

**Auth Required**: ADMIN role

**Response**: Similar to GET /api/cohorts but includes all cohorts.

### POST /api/admin/cohorts/[id]/assign-coach

Assign coach to cohort.

**Auth Required**: ADMIN role

**Request Body**:
```json
{
  "coachId": "uuid"
}
```

**Response**:
```json
{
  "data": {
    "success": true
  }
}
```

---

## iOS Companion App Endpoints (Device Token Auth)

These endpoints use `X-Pairing-Token` header authentication instead of Clerk sessions. They accept either an 8-char pairing code or a 64-char hex device token.

### POST /api/pair

Pair an iOS app with a coach using a pairing code. Returns a long-lived device token for subsequent API calls.

**Auth Required**: None (pairing code acts as auth)

**Request Body**:
```json
{
  "code": "AB3KM7NP"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully paired with coach",
  "client_id": "uuid",
  "device_token": "64-char-hex-string",
  "coach": { "id": "uuid", "name": "Coach Name" },
  "client": { "id": "uuid", "name": "Client Name" },
  "paired_at": "2025-01-15T10:00:00Z"
}
```

**Behavior**:
- Validates the 8-char pairing code
- Generates a 64-char hex device token (stored on PairingCode.deviceToken)
- Links client to coach via `invitedByCoachId`
- iOS app should persist `device_token` for all future API calls

### POST /api/ingest/entry

Submit a daily check-in from the iOS app.

**Auth Required**: `X-Pairing-Token` header (device token or pairing code)

**Request Body**:
```json
{
  "client_id": "uuid",
  "date": "2025-01-15",
  "weightLbs": 175.5,
  "steps": 10000,
  "calories": 2000,
  "proteinGrams": 150,
  "carbsGrams": 200,
  "fatGrams": 70,
  "fiberGrams": 30,
  "sleepQuality": 8,
  "perceivedStress": 4,
  "notes": "Good day"
}
```

All fields except `client_id` and `date` are optional.

**Response** (created):
```json
{
  "success": true,
  "action": "created",
  "entry_id": "uuid"
}
```

**Response** (merged with existing entry):
```json
{
  "success": true,
  "action": "merged",
  "fields_updated": ["weightLbs", "steps"],
  "entry_id": "uuid"
}
```

**Merge strategy**: Only fills null fields on existing entries. Never overwrites data from HealthKit or Cronometer.

### POST /api/ingest/cronometer

Import Cronometer CSV data via device token auth.

**Auth Required**: `X-Pairing-Token` header (device token or pairing code)

**Request Body**:
```json
{
  "client_id": "uuid",
  "rows": [
    {
      "date": "2025-01-15",
      "calories": 2000,
      "proteinGrams": 150,
      "carbsGrams": 200,
      "fatGrams": 70,
      "fiberGrams": 30,
      "weightLbs": 175.5
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "processed": 5,
  "created": 3,
  "merged": 2,
  "skipped": 0,
  "results": [
    { "date": "2025-01-15", "action": "created", "fieldsUpdated": ["calories", "proteinGrams"] }
  ]
}
```

**Behavior**: Same merge strategy as POST /api/ingest/entry. On success, sets `cronometerLinked: true` on the user.

---

## Common Patterns

### Authentication Pattern

```typescript
import { getSession } from "@/lib/auth"

const session = await getSession()
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

### Authorization Pattern

```typescript
import { isCoach, isAdmin } from "@/lib/permissions"

if (!isCoach(session.user)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

### Validation Pattern

```typescript
import { createEntrySchema } from "@/lib/validations"

const body = await request.json()
const parsed = createEntrySchema.safeParse(body)

if (!parsed.success) {
  return NextResponse.json(
    { error: "Validation failed", details: parsed.error.errors },
    { status: 400 }
  )
}
```

### Error Handling Pattern

```typescript
try {
  // Your logic
  return NextResponse.json({ data: result })
} catch (error) {
  console.error("Error:", error)
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  )
}
```

---

## Rate Limiting

Currently not implemented. Future consideration for:
- Login attempts
- API endpoints
- Email sending

---

## Next Steps

- **[Review Architecture](./architecture.md)**
- **[Deploy to Production](./deployment.md)**
- **[Start Contributing](../misc/CONTRIBUTING.md)**

---

**Last Updated**: March 2026
