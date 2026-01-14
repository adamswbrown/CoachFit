# Log Entry Functionality Audit Report
## CoachSync Web Application

**Date:** January 2025  
**Audit Scope:** Complete Log Entry feature implementation, data flow, storage, and user interaction

---

## Executive Summary

The Log Entry functionality is a simplified daily health tracking system designed for coach-client relationships. Clients log daily entries containing weight, steps, and calories, which coaches can view and analyze. The system uses a Next.js frontend with React, TypeScript, and Prisma ORM for database interactions, storing data in PostgreSQL.

---

## 1. Architecture Overview

### Frontend Component
- **Location:** `app/client-dashboard/page.tsx`
- **Technology:** Next.js 14+ with React, TypeScript
- **State Management:** React hooks (useState, useEffect)
- **Session Management:** NextAuth.js for authentication
- **Routing:** Next.js App Router

### Backend API Routes
- **Location:** `app/api/entries/route.ts`
- **Technology:** Next.js API Routes (Route Handlers)
- **Database:** Prisma ORM with PostgreSQL
- **Authentication:** NextAuth.js session-based auth
- **Validation:** Zod schema validation

### Data Flow
```
User Input (React Client Component) 
  → API Route Handler (Next.js API Route) 
  → Prisma ORM (Database Client) 
  → PostgreSQL Database
```

---

## 2. Data Collected

### 2.1 Standard Entry Fields

The following fields are collected per entry:

| Field | Type | Storage Format | Required | Validation Rules |
|-------|------|----------------|----------|------------------|
| **weightLbs** | Float | Numeric (lbs) | Yes | Must be positive (> 0) |
| **steps** | Integer | Whole number | Yes | Non-negative integer (≥ 0) |
| **calories** | Integer | Whole number (kcal) | Yes | Non-negative integer (≥ 0) |
| **date** | Date | YYYY-MM-DD format | Yes | Must be valid date, cannot be in future |

**Key Characteristics:**
- **Fixed Fields:** Only three measurement fields (no extensibility)
- **Date-based:** One entry per user per date (enforced by unique constraint)
- **All Required:** All fields must be provided (no partial entries)
- **Imperial Units:** Weight stored in pounds (lbs), no unit conversion
- **Integer Types:** Steps and calories must be whole numbers

### 2.2 Metadata Fields

| Field | Type | Auto-generated | Description |
|-------|------|----------------|-------------|
| **id** | UUID | Yes | Primary key (auto-generated) |
| **userId** | UUID | Yes | Foreign key to User table |
| **date** | Date | No (user-provided) | Entry date |
| **createdAt** | DateTime | Yes | Timestamp of record creation |

**Key Constraints:**
- **Unique Constraint:** `@@unique([userId, date])` - One entry per user per date
- **Cascade Delete:** When user is deleted, all entries are deleted (onDelete: Cascade)

---

## 3. Database Schema

### 3.1 Entry Model (Prisma Schema)

```prisma
model Entry {
  id        String   @id @default(uuid())
  userId    String
  date      DateTime @db.Date
  weightLbs Float
  steps     Int
  calories  Int
  createdAt DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, date])
}
```

**Key Features:**
- **Primary Key:** UUID (auto-generated)
- **Foreign Key:** `userId` references `User.id`
- **Date Storage:** `@db.Date` type (date only, no time)
- **Unique Constraint:** Composite unique constraint on `(userId, date)` prevents duplicates
- **Cascade Delete:** Entries deleted when user is deleted

### 3.2 User Model Relationship

```prisma
model User {
  // ... other fields
  entries  Entry[]
  // ... other relations
}
```

**Relationship:**
- One-to-Many: One User can have many Entries
- Bidirectional: User.entries[] and Entry.user

### 3.3 Database Features

- **Database:** PostgreSQL
- **ORM:** Prisma Client
- **Connection:** Managed via Prisma Client connection pooling
- **Migrations:** Managed via Prisma Migrate

---

## 4. Data Storage and Persistence

### 4.1 Storage Pattern: CREATE (No Update)

**Important:** Unlike the Hitsona CheckIn system, the Log Entry system does NOT support updates:
- **Create Only:** New entries can only be created
- **No Updates:** Once created, entries cannot be modified
- **No Deletes:** No delete functionality exposed in API
- **Duplicate Prevention:** Unique constraint prevents multiple entries for same date

**Duplicate Handling:**
```typescript
// Check for existing entry
const existing = await db.entry.findUnique({
  where: {
    userId_date: {
      userId: session.user.id,
      date: date,
    },
  },
})

if (existing) {
  return NextResponse.json(
    { error: "Entry already exists for this date" },
    { status: 409 } // Conflict status
  )
}
```

### 4.2 Date Normalization

Dates are normalized to start of day (midnight):
```typescript
const date = new Date(validated.date)
date.setHours(0, 0, 0, 0) // Normalize to start of day
```

This ensures consistent date comparison regardless of time component.

### 4.3 Validation Schema (Zod)

```typescript
export const createEntrySchema = z.object({
  weightLbs: z.number().positive("Weight must be greater than 0"),
  steps: z.number().int("Steps must be an integer").nonnegative("Steps cannot be negative"),
  calories: z.number().int("Calories must be an integer").nonnegative("Calories cannot be negative"),
  date: z.string().refine(
    (date) => {
      const dateObj = new Date(date)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      return dateObj <= today && !isNaN(dateObj.getTime())
    },
    {
      message: "Date must be a valid date and not in the future",
    }
  ),
})
```

**Validation Rules:**
- **weightLbs:** Must be positive number (> 0)
- **steps:** Must be non-negative integer (≥ 0)
- **calories:** Must be non-negative integer (≥ 0)
- **date:** Must be valid date, cannot be in future

---

## 5. User Interaction Flow

### 5.1 Client Dashboard - Entry Creation

**Location:** `app/client-dashboard/page.tsx`

#### Initial Load

1. **Authentication Check:**
   - Verifies user is authenticated (NextAuth session)
   - Redirects to `/login` if unauthenticated
   - Redirects to `/coach-dashboard` if user is COACH

2. **Cohort Membership Check:**
   - Calls `/api/entries/check-membership`
   - Determines if client has been added to a coach's cohort
   - If no membership: Shows warning banner, disables form
   - If membership exists: Enables form for entry creation

3. **Fetch Existing Entries:**
   - Calls `GET /api/entries`
   - Retrieves user's entry history (paginated, default 20 entries)
   - Orders by date descending (most recent first)

4. **Form Initialization:**
   - Defaults date to today (`new Date().toISOString().split("T")[0]`)
   - All fields empty
   - Form enabled/disabled based on cohort membership

#### Form Fields

**Weight:**
- Type: `number` input
- Step: `0.1` (allows decimals)
- Unit: `lbs` (displayed as suffix)
- Required: Yes
- Placeholder: "0.0"

**Steps:**
- Type: `number` input
- Step: `1` (whole numbers only)
- Unit: `steps` (displayed as suffix)
- Required: Yes
- Placeholder: "0"

**Calories:**
- Type: `number` input
- Step: `1` (whole numbers only)
- Unit: `kcal` (displayed as suffix)
- Required: Yes
- Placeholder: "0"

**Date:**
- Type: `date` input
- Default: Today
- Max: Today (cannot select future dates)
- Required: Yes
- Format: YYYY-MM-DD

#### Form Submission

1. **User fills form:**
   - All fields required
   - Date cannot be in future
   - Weight must be positive
   - Steps and calories must be non-negative

2. **Client-side validation:**
   - HTML5 validation (required fields)
   - Date max attribute prevents future dates
   - Number inputs enforce numeric values

3. **API Call:**
   ```typescript
   POST /api/entries
   {
     weightLbs: parseFloat(formData.weightLbs),
     steps: parseInt(formData.steps),
     calories: parseInt(formData.calories),
     date: formData.date
   }
   ```

4. **Response Handling:**
   - **Success (201):** Shows success message, clears form, refreshes entry list
   - **Conflict (409):** Shows error "Entry already exists for this date"
   - **Validation Error (400):** Shows validation errors
   - **Error (500):** Shows generic error message

5. **After Submission:**
   - Form resets to default values
   - Entry list refreshes to show new entry
   - Success message displayed briefly

### 5.2 Entry History Display

**Location:** Same page (`client-dashboard/page.tsx`), right side

#### Entry List Features

1. **Display Format:**
   - Cards showing date and three measurements
   - Most recent entries first
   - Today's entry highlighted with blue background

2. **Date Formatting:**
   - "Today" for today's entry
   - "Yesterday" for yesterday's entry
   - Otherwise: "Mon, Jan 1" format (weekday, month, day)

3. **Entry Card Layout:**
   ```
   [Date Label] [Latest Badge if today]
   [Weight: X lbs] [Steps: X] [Calories: X]
   ```

4. **Visual Indicators:**
   - Today's entry: Blue background (`bg-blue-50 border-blue-200`)
   - Other entries: Gray background (`bg-slate-50 border-slate-100`)
   - Hover effect: Slight shadow on hover

5. **Empty State:**
   - Shows message if no entries exist
   - Different message if client has no coach yet

### 5.3 Quick Stats Display

**Location:** Top of dashboard, above entry form

**Calculated Stats:**

1. **Latest Weight:**
   - Displays most recent entry's weight
   - Format: "{weight} lbs"
   - Shows "—" if no entries

2. **Average Steps (7 days):**
   - Calculates average steps from last 7 days
   - Rounds to whole number
   - Format: "{avgSteps}" (no decimal)
   - Shows "—" if no entries in last 7 days

3. **Total Entries (7 days):**
   - Counts entries from last 7 days
   - Format: "{count} / 7"
   - Shows "—" if no entries

**Calculation Logic:**
```typescript
const weekEntries = entries.filter((e) => {
  const entryDate = new Date(e.date)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  return entryDate >= weekAgo
})

const avgStepsThisWeek = weekEntries.length > 0 
  ? Math.round(weekEntries.reduce((sum, e) => sum + e.steps, 0) / weekEntries.length)
  : 0
```

### 5.4 Coach View - Client Entries

**Location:** `app/clients/[id]/entries/page.tsx`

#### Access Control

1. **Authentication:**
   - Must be authenticated
   - Must have COACH role
   - CLIENT users redirected to `/client-dashboard`

2. **Authorization:**
   - Verifies client exists
   - Verifies client is in at least one cohort owned by coach
   - API route: `/api/clients/[id]/entries`

#### Display Features

1. **Client Information:**
   - Shows client name or email
   - "Back to Dashboard" link to return to coach dashboard

2. **Summary Statistics (Analytics):**
   - Fetches from `/api/clients/[id]/analytics`
   - Displays 4 summary cards:
     - Latest Weight
     - Weight Change (from first to latest entry, color-coded: green for loss, red for gain)
     - Average Steps (30 days)
     - Average Calories (30 days)

3. **Charts (Recharts):**
   - **Weight Trend Chart:**
     - Line chart showing weight over time
     - X-axis: Date (formatted as locale date string)
     - Y-axis: Weight (lbs)
     - Blue line with dots
   
   - **Steps Trend Chart:**
     - Line chart showing steps over time
     - X-axis: Date (formatted as locale date string)
     - Y-axis: Steps count
     - Green line with dots

4. **Entries Table:**
   - Tabular view of all entries
   - Columns: Date, Weight (lbs), Steps, Calories
   - Ordered by date descending
   - Paginated (default 20 entries)

---

## 6. API Endpoints

### 6.1 Client Entry Endpoints

| Method | Endpoint | Description | Auth Required | Role Required |
|--------|----------|-------------|---------------|---------------|
| POST | `/api/entries` | Create new entry | Yes (NextAuth) | CLIENT |
| GET | `/api/entries` | List user's entries | Yes | CLIENT |
| GET | `/api/entries/check-membership` | Check if client has coach | Yes | CLIENT |

### 6.2 Coach Entry Endpoints

| Method | Endpoint | Description | Auth Required | Role Required |
|--------|----------|-------------|---------------|---------------|
| GET | `/api/clients/[id]/entries` | Get client's entries | Yes | COACH (with authorization check) |
| GET | `/api/clients/[id]/analytics` | Get client's analytics | Yes | COACH or ADMIN (with authorization check) |

### 6.3 API Endpoint Details

#### POST /api/entries

**Request Body:**
```json
{
  "weightLbs": 150.5,
  "steps": 10000,
  "calories": 2000,
  "date": "2025-01-15"
}
```

**Validation:**
- Uses `createEntrySchema` (Zod)
- Validates all fields according to schema rules

**Response (201 Created):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "date": "2025-01-15T00:00:00.000Z",
  "weightLbs": 150.5,
  "steps": 10000,
  "calories": 2000,
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- **400 Bad Request:** Validation error (ZodError)
- **401 Unauthorized:** Not authenticated
- **403 Forbidden:** Not CLIENT role
- **409 Conflict:** Entry already exists for this date
- **500 Internal Server Error:** Server error

#### GET /api/entries

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Entries per page (default: 20)

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "date": "2025-01-15T00:00:00.000Z",
    "weightLbs": 150.5,
    "steps": 10000,
    "calories": 2000,
    "createdAt": "2025-01-15T10:30:00.000Z"
  },
  // ... more entries
]
```

**Pagination:**
- Orders by `date` descending (most recent first)
- Supports skip/take pagination
- Default: 20 entries per page

#### GET /api/entries/check-membership

**Response (200 OK):**
```json
{
  "hasMembership": true
}
```

**Purpose:** Checks if client has been added to any cohort (has a coach)

#### GET /api/clients/[id]/entries

**Authorization:**
- Verifies client exists
- Verifies client is in at least one cohort owned by coach
- Returns 403 if authorization fails

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Entries per page (default: 20)

**Response (200 OK):**
Same format as GET /api/entries (array of entries)

#### GET /api/clients/[id]/analytics

**Authorization:**
- Verifies client exists
- Verifies client is in cohort owned by coach (if COACH role)
- Admins can access any client

**Response (200 OK):**
```json
{
  "summary": {
    "latestWeight": 150.5,
    "firstWeight": 155.0,
    "weightChange": -4.5,
    "avgSteps7d": 8500,
    "avgSteps30d": 9000,
    "avgCalories7d": 1900,
    "avgCalories30d": 2000
  },
  "entries": [
    {
      "date": "2025-01-15",
      "weightLbs": 150.5,
      "steps": 10000,
      "calories": 2000
    },
    // ... more entries (ordered by date ascending for charts)
  ]
}
```

**Analytics Calculations:**
- **latestWeight:** Most recent entry's weight
- **firstWeight:** First (oldest) entry's weight
- **weightChange:** latestWeight - firstWeight
- **avgSteps7d:** Average steps from last 7 days
- **avgSteps30d:** Average steps from last 30 days
- **avgCalories7d:** Average calories from last 7 days
- **avgCalories30d:** Average calories from last 30 days

---

## 7. Authorization and Security

### 7.1 Client Access Control

**Entry Creation (POST /api/entries):**
- Must be authenticated (NextAuth session)
- Must have CLIENT role
- Entries are automatically associated with authenticated user's ID
- Users cannot create entries for other users

**Entry Retrieval (GET /api/entries):**
- Must be authenticated
- Must have CLIENT role
- Only returns entries for authenticated user
- No user ID parameter (uses session.user.id)

### 7.2 Coach Access Control

**Client Entry Access (GET /api/clients/[id]/entries):**
- Must be authenticated
- Must have COACH role
- Must verify client exists
- Must verify client is in at least one cohort owned by coach
- Uses `CohortMembership` join to verify relationship

**Client Analytics Access (GET /api/clients/[id]/analytics):**
- Must be authenticated
- Must have COACH or ADMIN role
- COACH: Must verify client is in cohort owned by coach
- ADMIN: Can access any client's analytics

### 7.3 Duplicate Prevention

**Database Level:**
- Unique constraint: `@@unique([userId, date])`
- Prevents multiple entries for same user/date combination
- Returns Prisma error P2002 if violated

**Application Level:**
- Explicit check before creating entry
- Returns 409 Conflict if duplicate detected
- User-friendly error message: "Entry already exists for this date"

### 7.4 Data Validation

**Server-side (Zod):**
- All input validated via Zod schema
- Type checking (number, integer)
- Range validation (positive, non-negative)
- Date validation (not in future, valid date)

**Client-side:**
- HTML5 form validation (required fields)
- Date max attribute prevents future dates
- Number inputs enforce numeric values

---

## 8. Special Features

### 8.1 No Update/Delete Support

**Important Design Decision:**
- Entries are immutable once created
- No UPDATE endpoint exists
- No DELETE endpoint exists
- Once submitted, entry cannot be changed

**Rationale (implied):**
- Ensures data integrity for coaching relationships
- Prevents tampering with historical data
- Simpler implementation (no conflict resolution)

**Workaround (if needed):**
- Would require direct database access or admin tool
- Not exposed via API

### 8.2 Cohort Membership Requirement

**Client Entry Creation:**
- Client must be in at least one cohort to create entries
- Form is disabled if no cohort membership
- Warning banner shown if no coach assigned

**Check Endpoint:**
- `/api/entries/check-membership` checks `CohortMembership` table
- Returns boolean indicating if client has coach

### 8.3 Date Restriction

**Future Dates Prevented:**
- Client-side: `max={new Date().toISOString().split("T")[0]}`
- Server-side: Zod validation checks date <= today
- Error message: "Date must be a valid date and not in the future"

### 8.4 Analytics and Visualization

**Client Dashboard:**
- Simple stats: Latest weight, avg steps (7d), entry count (7d)
- Calculated client-side from fetched entries

**Coach Dashboard:**
- Comprehensive analytics via `/api/clients/[id]/analytics`
- Summary statistics: Weight change, averages
- Charts: Weight trend line, Steps trend line
- Uses Recharts library for visualization

---

## 9. Comparison with Hitsona CheckIn

### 9.1 Key Differences

| Feature | CoachSync Log Entry | Hitsona CheckIn |
|---------|---------------------|-----------------|
| **Update Support** | ❌ No updates | ✅ UPSERT pattern |
| **Delete Support** | ❌ No deletes | ✅ Partial deletes (set fields to null) |
| **Fields** | 3 fixed fields | 8+ standard + unlimited custom |
| **Units** | Fixed (lbs only) | User preference (kg/lbs, cm/inches) |
| **Date Selection** | Date picker (today or past) | Calendar with full history |
| **Custom Measurements** | ❌ Not supported | ✅ Unlimited custom categories |
| **Mood Tracking** | ❌ Not supported | ✅ Included |
| **Sleep Tracking** | ❌ Not supported | ✅ Separate component |
| **Fasting Tracking** | ❌ Not supported | ✅ Widget included |
| **Body Fat Calculation** | ❌ Not supported | ✅ BMI & U.S. Navy methods |
| **Calorie Aggregation** | ❌ Manual only | ✅ Auto-aggregate from diet |
| **Multi-User Access** | ✅ Coach-client relationship | ✅ Family/shared access |
| **Authorization Model** | Role-based (CLIENT/COACH) | Permission-based (checkin permission) |

### 9.2 Similarities

- Both are date-based entry systems
- Both prevent duplicates per date
- Both support pagination for entry lists
- Both show entry history
- Both validate input data
- Both use PostgreSQL database

### 9.3 Use Case Differences

**CoachSync Log Entry:**
- Designed for coach-client accountability
- Immutable entries ensure integrity
- Simple, focused on core metrics
- Coach can view and analyze client progress

**Hitsona CheckIn:**
- Designed for personal health tracking
- Flexible, extensible measurement system
- Supports multiple tracking types (mood, sleep, fasting)
- Focus on user flexibility and customization

---

## 10. Error Handling

### 10.1 Frontend Error Handling

**Form Submission:**
- Try/catch around fetch call
- Error state stored in component state
- Error message displayed in UI
- Loading state prevents duplicate submissions

**API Errors:**
- Status code checking (res.ok)
- Error message from response body
- User-friendly error messages displayed
- Generic fallback for unexpected errors

**Empty States:**
- Handles no entries gracefully
- Different messages based on coach membership status
- Loading states during data fetch

### 10.2 Backend Error Handling

**Validation Errors:**
- Zod validation catches invalid input
- Returns 400 with error details
- Type-safe error handling

**Database Errors:**
- Prisma error codes handled (P2002 for unique constraint)
- Returns 409 for duplicate entries
- Returns 404 for not found
- Returns 403 for authorization failures
- Generic 500 for unexpected errors

**Authentication Errors:**
- 401 for unauthenticated requests
- 403 for unauthorized (wrong role)
- Session validation via NextAuth

---

## 11. Performance Considerations

### 11.1 Database Queries

**Pagination:**
- Default limit: 20 entries
- Skip/take pagination for large datasets
- Orders by date (indexed field)

**Analytics Calculations:**
- Fetches all entries for date range
- Calculates averages in application layer
- Could be optimized with database aggregations

**Indexing:**
- Prisma automatically creates indexes on foreign keys
- Unique constraint creates index on (userId, date)
- Consider additional indexes for date-based queries if scaling

### 11.2 Frontend Optimization

**Data Fetching:**
- Fetches entries on component mount
- No automatic refresh (manual refresh via form submission)
- Could benefit from SWR or React Query for caching

**Rendering:**
- Simple list rendering (no virtualization)
- Efficient for small datasets (< 100 entries)
- May need optimization for large entry lists

### 11.3 Analytics Performance

**Current Implementation:**
- Fetches all entries for client
- Calculates stats in application layer
- Filters date ranges in JavaScript

**Potential Optimizations:**
- Use database aggregation functions (AVG, SUM)
- Add date range filtering to database query
- Cache analytics results if frequently accessed

---

## 12. Security Considerations

### 12.1 Authentication

- NextAuth.js session-based authentication
- Secure session management
- Session tokens stored in HTTP-only cookies

### 12.2 Authorization

- Role-based access control (CLIENT, COACH, ADMIN)
- Defensive checks at API route level
- Cohort membership verification for coach access

### 12.3 Input Validation

- Zod schema validation on all inputs
- Type checking prevents injection attacks
- Range validation prevents invalid data

### 12.4 Data Isolation

- Users can only access their own entries (CLIENT role)
- Coaches can only access clients in their cohorts
- Database-level foreign key constraints
- Cascade delete ensures data consistency

---

## 13. Limitations and Considerations

### 13.1 Known Limitations

1. **No Update/Delete:**
   - Entries are immutable once created
   - No way to correct mistakes
   - May require admin intervention for data fixes

2. **Fixed Fields:**
   - Only 3 measurement fields
   - Cannot extend with custom measurements
   - Limited flexibility for different tracking needs

3. **Fixed Units:**
   - Weight only in pounds (lbs)
   - No unit conversion support
   - May not suit international users

4. **Simple Analytics:**
   - Basic calculations only
   - No advanced statistical analysis
   - No trend detection or insights

5. **No Bulk Operations:**
   - Must create entries one at a time
   - No import/export functionality
   - No batch operations

### 13.2 Design Considerations

1. **Simplicity Over Flexibility:**
   - Trade-off: Simple, focused system vs. flexible, extensible
   - Good for specific use case (coach-client tracking)
   - May need extension for broader use cases

2. **Data Integrity:**
   - Immutable entries ensure historical accuracy
   - Good for accountability and auditing
   - May frustrate users who make mistakes

3. **Coach-Client Model:**
   - Designed around coach viewing client data
   - Supports cohort-based organization
   - May not suit peer-to-peer or self-tracking scenarios

---

## 14. Future Enhancement Opportunities

### 14.1 Suggested Improvements

1. **Update/Delete Support:**
   - Add UPDATE endpoint for correcting entries
   - Add DELETE endpoint with audit trail
   - Consider soft deletes instead of hard deletes

2. **Additional Fields:**
   - Body measurements (waist, hips, etc.)
   - Body fat percentage
   - Notes/comments field
   - Photos/attachments

3. **Unit Conversion:**
   - Support metric units (kg, cm)
   - User preference for units
   - Automatic conversion on display

4. **Advanced Analytics:**
   - Trend analysis
   - Goal tracking
   - Progress predictions
   - Comparative analysis (vs. cohort averages)

5. **Bulk Operations:**
   - CSV import for historical data
   - Export functionality
   - Batch entry creation

6. **Notifications:**
   - Reminders to log entries
   - Coach notifications when client logs entry
   - Goal achievement notifications

7. **Mobile App:**
   - Native mobile app for easier entry
   - Integration with fitness trackers
   - Push notifications

8. **Data Visualization:**
   - More chart types (bar, area, scatter)
   - Interactive charts with zoom/pan
   - Comparative charts (multiple clients)

---

## Appendix A: File Locations

### Frontend
- Client Dashboard: `app/client-dashboard/page.tsx`
- Coach Client Entries View: `app/clients/[id]/entries/page.tsx`

### Backend API Routes
- Entry Routes: `app/api/entries/route.ts`
- Check Membership: `app/api/entries/check-membership/route.ts`
- Client Entries (Coach): `app/api/clients/[id]/entries/route.ts`
- Client Analytics: `app/api/clients/[id]/analytics/route.ts`

### Database
- Prisma Schema: `prisma/schema.prisma`
- Prisma Client: Generated from schema

### Validation
- Zod Schemas: `lib/validations.ts`

### Authentication
- NextAuth Config: `lib/auth.ts`

---

## Appendix B: Database Schema Diagram

```
User
├── id (uuid, PK)
├── email (string, unique)
├── name (string, nullable)
├── roles (Role[], default: [CLIENT])
└── entries (Entry[])

Entry
├── id (uuid, PK)
├── userId (uuid, FK → User.id)
├── date (Date)
├── weightLbs (Float)
├── steps (Int)
├── calories (Int)
├── createdAt (DateTime)
└── user (User)

CohortMembership
├── userId (uuid, FK → User.id)
├── cohortId (uuid, FK → Cohort.id)
└── @@id([userId, cohortId])

Cohort
├── id (uuid, PK)
├── name (string)
├── coachId (uuid, FK → User.id)
└── memberships (CohortMembership[])

Constraints:
- Entry: @@unique([userId, date])
- Entry.userId → User.id (CASCADE DELETE)
```

---

## Conclusion

The Log Entry functionality in CoachSync/Web is a focused, simplified health tracking system designed specifically for coach-client relationships. It prioritizes data integrity and simplicity over flexibility, making it well-suited for accountability and progress tracking in a coaching context.

The system's immutability ensures historical accuracy but limits user flexibility. The fixed fields and units make it easy to use but may not suit all use cases. The coach-client authorization model provides secure access control while enabling coaches to track and analyze client progress.

Compared to the Hitsona CheckIn system, this is a more streamlined approach that sacrifices extensibility for simplicity and focused functionality.

---

**End of Audit Report**
