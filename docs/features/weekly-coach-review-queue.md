# Weekly Coach Review Queue

## Overview

The Weekly Coach Review Queue is a coach-focused feature that provides a centralized dashboard for reviewing all clients' weekly progress, recording Loom video responses, and generating copyable email drafts.

## Features

### 1. Weekly Review Queue Dashboard

**Route:** `/coach-dashboard/weekly-review`

The main dashboard displays:
- Week selector (defaults to current week)
- List of all clients in the coach's cohorts
- Weekly aggregated stats for each client:
  - Check-in count and adherence rate
  - Average weight and weight trend
  - Average steps per day
  - Average calories per day
  - Average sleep duration per night
- Last check-in date for each client

### 2. Per-Client Actions

For each client in the queue, coaches can:

#### Open Detailed Review
- Links to the full weekly review page for that client
- URL includes weekStart parameter to tie review to specific week

#### Record Loom Video
- Input field for Loom video URL
- Saved per client per week
- Optional field (can be left blank)

#### Add Private Notes
- Text area for weekly coaching notes
- Private notes not visible to client
- Saved per client per week

#### Copy Email Draft
- Generates a pre-filled email with weekly stats
- Includes Loom URL if provided
- Copy-to-clipboard functionality
- **Does not send email automatically**

### 3. Email Draft Template

The generated email includes:
- Subject line with week date
- Client's weekly stats summary
- Loom video link (if provided)
- Personalized greeting using client's name

Example:
```
Subject: Weekly Check-In Summary – Week of 2026-01-13

Hey John,

Here's your weekly summary:

• Check-ins: 5/7 (71%)
• Avg weight: 185.2 lbs (-1.5 lbs this week)
• Avg steps: 8,234
• Avg calories: 1,850
• Avg sleep: 7h 30m

I recorded a Loom update for you here:
https://www.loom.com/share/abc123

Let me know if you have any questions for next week!

Best,
[Your Name]
```

## API Endpoints

### GET /api/coach-dashboard/weekly-summaries

Fetches weekly summary stats for all clients in coach's cohorts.

**Query Parameters:**
- `weekStart` (optional): YYYY-MM-DD format, defaults to current week's Monday

**Response:**
```json
{
  "weekStart": "2026-01-13",
  "weekEnd": "2026-01-19",
  "clients": [
    {
      "clientId": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "stats": {
        "checkInCount": 5,
        "checkInRate": 0.71,
        "avgWeight": 185.2,
        "weightTrend": -1.5,
        "avgSteps": 8234,
        "avgCalories": 1850,
        "avgSleepMins": 450
      },
      "lastCheckInDate": "2026-01-18"
    }
  ]
}
```

### POST /api/coach-dashboard/weekly-response

Save or update weekly coaching response for a client.

**Request Body:**
```json
{
  "clientId": "uuid",
  "weekStart": "2026-01-13",
  "loomUrl": "https://www.loom.com/share/abc123",
  "note": "Great progress this week!"
}
```

**Response:**
```json
{
  "id": "uuid",
  "coachId": "uuid",
  "clientId": "uuid",
  "weekStart": "2026-01-13",
  "loomUrl": "https://www.loom.com/share/abc123",
  "note": "Great progress this week!",
  "createdAt": "2026-01-17T10:00:00Z",
  "updatedAt": "2026-01-17T10:00:00Z"
}
```

### GET /api/coach-dashboard/weekly-response

Fetch existing weekly response for a client.

**Query Parameters:**
- `clientId`: UUID
- `weekStart`: YYYY-MM-DD

**Response:**
Same as POST response, or empty object if no response exists.

## Database Schema

### WeeklyCoachResponse Model

```prisma
model WeeklyCoachResponse {
  id        String   @id @default(uuid())
  coachId   String
  clientId  String
  weekStart DateTime @db.Date
  loomUrl   String?
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  client    User     @relation("ClientWeeklyResponses", fields: [clientId], references: [id], onDelete: Cascade)
  coach     User     @relation("CoachWeeklyResponses", fields: [coachId], references: [id], onDelete: Cascade)

  @@unique([coachId, clientId, weekStart])
  @@index([coachId, clientId])
  @@index([weekStart])
}
```

## User Workflow

### Sunday Weekly Review Process

1. Coach navigates to `/coach-dashboard/weekly-review`
2. Reviews the current week's client summaries
3. For each client:
   - Reviews stats to identify progress or concerns
   - Records a personalized Loom video
   - Pastes the Loom URL into the input field
   - Adds any private notes for internal tracking
   - Clicks "Save" to store the response
4. Clicks "Copy Email Draft" to get pre-filled email text
5. Pastes into email client and sends to client
6. Optionally clicks "Open Review" for detailed day-by-day breakdown

### Mid-Week Follow-Up

Coaches can:
- Select previous weeks to review past responses
- Add or update Loom URLs for any week
- View client's detailed weekly review page

## Technical Details

### Week Calculation

All dates are normalized to Monday-Sunday weeks:
- Monday = start of week (weekStart)
- Sunday = end of week (weekEnd)

The `getMonday()` utility function ensures consistent week boundaries:
```typescript
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}
```

### Stats Aggregation

All stats are computed on-the-fly (no pre-aggregation):
- Fetches entries for week range (Monday 00:00 to Sunday 23:59)
- Calculates averages, counts, and trends in-memory
- Batch queries used for performance (all clients at once)

### Authorization

- Only users with COACH or ADMIN role can access
- Coaches can only see clients in their cohorts
- Admins can see all clients

## Future Enhancements

Potential improvements for future iterations:

1. **Pre-aggregated Stats**: Store weekly summaries for faster load times
2. **Automatic Email Sending**: Optional integration to send emails directly
3. **Client-Facing Weekly Form**: Long-form Sunday check-in for clients
4. **Reminder Emails**: Automated Sunday reminder to clients
5. **Response Templates**: Save and reuse common email templates
6. **Bulk Actions**: Select multiple clients and perform actions at once
7. **Analytics**: Track response rates and client engagement over time

## Related Features

- Client Weekly Review Page (`/clients/[id]/weekly-review`)
- Coach Notes (Private notes system)
- Weekly Summary API (`/api/clients/[id]/weekly-summary`)
- Email Infrastructure (`lib/email.ts`)
