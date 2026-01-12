# Log Entry Enhancement Proposal
## Extracting Best Features from Hitsona CheckIn

**Date:** January 2025  
**Purpose:** Compare CheckIn (Hitsona) and Log Entry (CoachSync/Web) functionality, extract best features, and propose implementations that maintain core constraints

---

## Executive Summary

This document compares the CheckIn functionality (Hitsona) with the Log Entry functionality (CoachSync/Web), identifies the best features from Hitsona's implementation, and proposes how to enhance the Web product while preserving its core coach-client relationship model and design philosophy.

---

## 1. Core User Model Differences

### 1.1 Hitsona CheckIn Model

**User Relationship:**
- **Personal tracking** with optional family/shared access
- **Individual-centric:** Users track their own data
- **ActiveUser Context:** Supports tracking data for other users (family members)
- **Permission-based:** `checkin` permission granted to users
- **Flexible access:** Users can grant access to family members

**Data Model:**
```
User → Own CheckIn Measurements
User → Can access other users' data via activeUserId
User → Custom categories per user
User → Preferences per user (units, timezone)
```

**Philosophy:**
- User autonomy and flexibility
- Extensibility and customization
- Personal health tracking focus

### 1.2 CoachSync/Web Model

**User Relationship:**
- **Coach-client relationship** with structured accountability
- **Cohort-based:** Clients organized into cohorts managed by coaches
- **Role-based:** CLIENT, COACH, ADMIN roles with clear boundaries
- **Structured access:** Coaches access client data through cohort membership verification

**Data Model:**
```
Client → Own Entries (immutable)
Coach → Can view clients in their cohorts
Cohort → Groups clients for coach management
```

**Philosophy:**
- Accountability and structure
- Simplicity and focus
- Coach-client accountability focus

### 1.3 Key Architectural Differences

| Aspect | Hitsona | CoachSync/Web |
|--------|---------|---------------|
| **Access Model** | Permission-based (`checkin` permission) | Role-based (CLIENT/COACH/ADMIN) |
| **Data Access** | Personal + optional family/shared | Strict client ownership + coach view |
| **Update Pattern** | UPSERT (can update entries) | CREATE only (immutable entries) |
| **Flexibility** | High (custom measurements, extensible) | Low (fixed fields, focused) |
| **Accountability** | Personal tracking | Coach-client accountability |

---

## 2. Feature Comparison Matrix

### 2.1 Standard Measurement Fields

| Feature | Hitsona CheckIn | CoachSync Log Entry | Recommendation |
|---------|-----------------|---------------------|----------------|
| **Weight** | ✅ (kg/lbs conversion) | ✅ (lbs only) | **Enhance:** Add unit conversion |
| **Steps** | ✅ | ✅ | **Keep:** Same |
| **Calories** | ✅ (optional, auto-aggregate) | ✅ (required) | **Enhance:** Make optional, add auto-aggregate |
| **Neck** | ✅ | ❌ | **Add:** Optional field |
| **Waist** | ✅ | ❌ | **Add:** Optional field |
| **Hips** | ✅ | ❌ | **Add:** Optional field |
| **Height** | ✅ | ❌ | **Add:** Optional field (for BMI) |
| **Body Fat %** | ✅ (manual or calculated) | ❌ | **Add:** Optional with calculation |

### 2.2 Advanced Features

| Feature | Hitsona CheckIn | CoachSync Log Entry | Recommendation |
|---------|-----------------|---------------------|----------------|
| **Custom Measurements** | ✅ (unlimited categories) | ❌ | **Add:** Coach-defined custom fields |
| **Unit Conversion** | ✅ (kg↔lbs, cm↔inches) | ❌ | **Add:** User preference for units |
| **Partial Entries** | ✅ (all fields nullable) | ❌ (all required) | **Enhance:** Make fields optional |
| **Date Selection** | ✅ (calendar, history navigation) | ✅ (date picker) | **Enhance:** Add calendar view |
| **Update Support** | ✅ (UPSERT pattern) | ❌ (immutable) | **Consider:** Allow updates with audit trail |
| **Delete Support** | ✅ (partial field deletion) | ❌ | **Consider:** Soft delete with audit trail |
| **Mood Tracking** | ✅ | ❌ | **Add:** Optional mood scale |
| **Notes Field** | ✅ (per measurement) | ❌ | **Add:** General notes field |

### 2.3 Data Management

| Feature | Hitsona CheckIn | CoachSync Log Entry | Recommendation |
|---------|-----------------|---------------------|----------------|
| **Body Fat Calculation** | ✅ (BMI & U.S. Navy) | ❌ | **Add:** Coach-configurable algorithm |
| **Calorie Aggregation** | ✅ (from diet entries) | ❌ | **Add:** If diet tracking added |
| **Recent Activity View** | ✅ (last 20 combined) | ✅ (entry history) | **Enhance:** Add activity timeline |
| **Entry History** | ✅ (with date navigation) | ✅ (list view) | **Enhance:** Add calendar/date navigation |

### 2.4 Analytics and Visualization

| Feature | Hitsona CheckIn | CoachSync Log Entry | Recommendation |
|---------|-----------------|---------------------|----------------|
| **Weight Trend Chart** | ✅ (in reports) | ✅ | **Keep:** Enhance styling |
| **Steps Trend Chart** | ✅ (in reports) | ✅ | **Keep:** Enhance styling |
| **Summary Statistics** | ✅ (extensive) | ✅ (basic) | **Enhance:** Add more metrics |
| **Cohort Comparisons** | ❌ | ❌ | **Add:** Coach-specific feature |

---

## 3. Best Features to Extract from Hitsona

### 3.1 High-Value Features (Priority 1)

#### 3.1.1 Unit Conversion System ⭐⭐⭐
**Value:** High - Makes product international and user-friendly

**Hitsona Implementation:**
- Stores in canonical units (kg, cm)
- Converts to user preference for display
- User preference stored in `user_preferences` table

**Proposed CoachSync Implementation:**
```typescript
// Add to User model or UserPreferences table
model UserPreference {
  id          String  @id @default(uuid())
  userId      String  @unique
  weightUnit  String  @default("lbs") // "lbs" | "kg"
  distanceUnit String @default("miles") // "miles" | "km" (for future distance tracking)
  measurementUnit String @default("inches") // "inches" | "cm"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Entry model enhancement (store in canonical units)
model Entry {
  // ... existing fields
  weightLbs   Float?  // Store as lbs (canonical) - nullable for optional
  weightKg    Float?  // Store as kg (canonical) - nullable for optional
  // OR single weight field converted based on preference
}
```

**Migration Strategy:**
1. Add `UserPreference` model
2. Convert existing `weightLbs` to support both units (store in lbs, convert on display)
3. Add unit conversion utilities
4. Update frontend to show user's preferred unit
5. Add unit selector in user settings

**Constraints Maintained:**
- Coach-client model unchanged
- Immutable entries maintained
- Simple data model preserved

#### 3.1.2 Optional Fields with Partial Entries ⭐⭐⭐
**Value:** High - Allows clients to log partial data, increasing adoption

**Hitsona Implementation:**
- All fields nullable
- Can submit partial data
- Upsert pattern handles missing fields

**Proposed CoachSync Implementation:**
```prisma
model Entry {
  id        String   @id @default(uuid())
  userId    String
  date      DateTime @db.Date
  weightLbs Float?   // Make nullable
  steps     Int?     // Make nullable
  calories  Int?     // Make nullable
  createdAt DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, date])
  
  // Validation: At least one field must be provided
  @@index([userId, date])
}
```

**API Validation Update:**
```typescript
export const createEntrySchema = z.object({
  weightLbs: z.number().positive().optional(),
  steps: z.number().int().nonnegative().optional(),
  calories: z.number().int().nonnegative().optional(),
  date: z.string().refine(/* date validation */),
}).refine((data) => {
  // At least one field must be provided
  return data.weightLbs !== undefined || 
         data.steps !== undefined || 
         data.calories !== undefined
}, {
  message: "At least one measurement field must be provided"
})
```

**Constraints Maintained:**
- Still one entry per date (unique constraint)
- Still immutable after creation
- No update endpoint (maintains simplicity)

#### 3.1.3 Additional Body Measurements ⭐⭐
**Value:** Medium-High - Valuable for body composition tracking

**Hitsona Implementation:**
- Neck, Waist, Hips, Height as separate fields
- All nullable/optional
- Stored in canonical units (cm)

**Proposed CoachSync Implementation:**
```prisma
model Entry {
  // ... existing fields
  neckInches   Float?  // Neck circumference
  waistInches  Float?  // Waist circumference
  hipsInches   Float?  // Hip circumference
  heightInches Float?  // Height
  // All nullable, optional fields
}
```

**Frontend Enhancement:**
- Collapsible "Additional Measurements" section
- Only show if coach has enabled for cohort
- Coach can configure which fields are required/optional per cohort

**Coach Configuration:**
```prisma
model CohortConfig {
  id              String  @id @default(uuid())
  cohortId        String  @unique
  requireWeight   Boolean @default(true)
  requireSteps    Boolean @default(true)
  requireCalories Boolean @default(true)
  enableNeck      Boolean @default(false)
  enableWaist     Boolean @default(false)
  enableHips      Boolean @default(false)
  enableHeight    Boolean @default(false)
  
  cohort Cohort @relation(fields: [cohortId], references: [id], onDelete: Cascade)
}
```

**Constraints Maintained:**
- Coach controls what data to collect
- Maintains coach-client structure
- Optional fields don't complicate core model

#### 3.1.4 Notes Field ⭐⭐
**Value:** Medium - Allows clients to add context to entries

**Hitsona Implementation:**
- Notes per measurement (custom measurements)
- General notes in mood entries

**Proposed CoachSync Implementation:**
```prisma
model Entry {
  // ... existing fields
  notes      String? @db.Text  // Optional general notes
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt  // Add for audit trail if updates allowed
}
```

**Usage:**
- Client can add notes when creating entry
- Coach can view notes in entry history
- Notes searchable in coach dashboard

**Constraints Maintained:**
- Simple text field, no complex structure
- Notes visible to coach (maintains accountability)

### 3.2 Medium-Value Features (Priority 2)

#### 3.2.1 Body Fat Percentage with Calculation ⭐⭐
**Value:** Medium - Useful for body composition tracking

**Hitsona Implementation:**
- Manual entry OR calculated via BMI Method or U.S. Navy Method
- User preference for algorithm selection (`body_fat_algorithm`)
- Two algorithms supported:
  1. **BMI Method**: Requires weight (kg), height (cm), age (years), gender
     - Male: `BFP = 1.20 * BMI + 0.23 * Age - 16.2`
     - Female: `BFP = 1.20 * BMI + 0.23 * Age - 5.4`
     - BMI = weight (kg) / (height (m))²
  2. **U.S. Navy Method**: Requires gender, height (cm), waist (cm), neck (cm), hips (cm, required for females)
     - Male: `BFP = 86.010 * log10(waist - neck) - 70.041 * log10(height) + 36.76`
     - Female: `BFP = 163.205 * log10(waist + hips - neck) - 97.684 * log10(height) - 78.387`
- Option to use most recent measurements for calculation (if available)
- Calculation happens client-side with validation

**Proposed CoachSync Implementation (Matching Hitsona):**
```prisma
model Entry {
  // ... existing fields
  bodyFatPercentage Float?  // Optional, nullable, stored as percentage (e.g., 15.5 for 15.5%)
}

model CohortConfig {
  // ... existing fields
  enableBodyFat     Boolean @default(false)  // Coach can enable/disable per cohort
  bodyFatAlgorithm  String?  // "bmi" | "us_navy" - Coach sets default for cohort, client can override
  requireBodyFat    Boolean @default(false)  // Coach can require body fat if enabled
}

model UserPreference {
  // ... existing fields (if implemented)
  bodyFatAlgorithm String? @default("us_navy") // "bmi" | "us_navy" - Client preference
}
```

**Body Fat Calculation API:**
```typescript
// POST /api/entries/calculate-body-fat
// Calculate body fat percentage using specified algorithm
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { 
    weight,      // Required for BMI method
    height,      // Required for both methods (in canonical unit: inches, converted to cm)
    waist,       // Required for U.S. Navy method (in canonical unit: inches, converted to cm)
    neck,        // Required for U.S. Navy method (in canonical unit: inches, converted to cm)
    hips,        // Required for U.S. Navy method (female only) (in canonical unit: inches, converted to cm)
    age,         // Required for BMI method
    gender,      // Required for both methods: "male" | "female"
    algorithm    // "bmi" | "us_navy" - Optional, defaults to user preference or cohort config
  } = await req.json()

  // Get user's preferred algorithm or cohort default
  const preferredAlgorithm = algorithm || getUserPreference(session.user.id)?.bodyFatAlgorithm || "us_navy"

  let bodyFat: number
  let error: string | null = null

  if (preferredAlgorithm === "bmi") {
    // BMI Method
    if (!weight || !height || !age || !gender) {
      error = "Weight, height, age, and gender are required for BMI Method"
    } else {
      // Convert to metric (kg, cm)
      const weightKg = convertLbsToKg(weight)
      const heightCm = convertInchesToCm(height)
      bodyFat = calculateBodyFatBMI(weightKg, heightCm, age, gender)
    }
  } else {
    // U.S. Navy Method
    if (!gender || !height || !waist || !neck) {
      error = "Gender, height, waist, and neck are required for U.S. Navy Method"
    } else if (gender === "female" && !hips) {
      error = "Hips measurement is required for females with U.S. Navy Method"
    } else {
      // Convert to metric (cm)
      const heightCm = convertInchesToCm(height)
      const waistCm = convertInchesToCm(waist)
      const neckCm = convertInchesToCm(neck)
      const hipsCm = hips ? convertInchesToCm(hips) : undefined
      bodyFat = calculateBodyFatUSNavy(gender, heightCm, waistCm, neckCm, hipsCm)
    }
  }

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ bodyFat: parseFloat(bodyFat.toFixed(2)) })
}

// Helper functions (matching Hitsona implementation)
function calculateBodyFatBMI(
  weight: number,  // in kg
  height: number,  // in cm
  age: number,     // in years
  gender: "male" | "female"
): number {
  const heightInMeters = height / 100
  const bmi = weight / (heightInMeters * heightInMeters)
  
  if (gender === "male") {
    return 1.20 * bmi + 0.23 * age - 16.2
  } else {
    return 1.20 * bmi + 0.23 * age - 5.4
  }
}

function calculateBodyFatUSNavy(
  gender: "male" | "female",
  height: number,  // in cm
  waist: number,   // in cm
  neck: number,    // in cm
  hips?: number    // in cm, required for females
): number {
  if (gender === "male") {
    return 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76
  } else {
    if (!hips) throw new Error("Hips measurement required for females")
    return 163.205 * Math.log10(waist + hips - neck) - 97.684 * Math.log10(height) - 78.387
  }
}
```

**Coach-Client Model:**
- **Coach Configuration (Cohort-Level):**
  - Coach can enable/disable body fat tracking per cohort via `CohortConfig.enableBodyFat`
  - Coach can set default algorithm for cohort (`CohortConfig.bodyFatAlgorithm`)
  - Coach can require body fat if enabled (`CohortConfig.requireBodyFat`)
  - Coach can configure which measurements are required (waist, neck, hips) for U.S. Navy method

- **Client Calculation:**
  - Client can manually enter body fat percentage OR use calculation
  - Calculation button appears if body fat is enabled for cohort
  - Client can choose algorithm (defaults to cohort config or user preference)
  - Option to use most recent measurements for calculation (if available)
  - Validation ensures required measurements are present for selected algorithm

- **Calculation UI (Client Entry Form):**
```tsx
// Body Fat Section (if enabled for cohort)
{cohortConfig?.enableBodyFat && (
  <div className="space-y-2">
    <Label htmlFor="bodyFat">Body Fat %</Label>
    <div className="flex gap-2">
      <Input
        id="bodyFat"
        type="number"
        step="0.1"
        value={bodyFatPercentage || ""}
        onChange={(e) => setBodyFatPercentage(e.target.value)}
        placeholder="Enter or calculate"
      />
      <Button
        type="button"
        onClick={handleCalculateBodyFat}
        disabled={!canCalculateBodyFat}
        variant="outline"
      >
        Calculate
      </Button>
    </div>
    <Select value={bodyFatAlgorithm} onValueChange={setBodyFatAlgorithm}>
      <SelectTrigger>
        <SelectValue placeholder="Select algorithm" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="bmi">BMI Method</SelectItem>
        <SelectItem value="us_navy">U.S. Navy Method</SelectItem>
      </SelectContent>
    </Select>
    {bodyFatAlgorithm === "bmi" && (
      <p className="text-sm text-gray-500">
        Requires: Weight, Height, Age, Gender
      </p>
    )}
    {bodyFatAlgorithm === "us_navy" && (
      <p className="text-sm text-gray-500">
        Requires: Height, Waist, Neck {gender === "female" && ", Hips"}
      </p>
    )}
    {mostRecentMeasurementsAvailable && (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={useMostRecent}
          onChange={(e) => setUseMostRecent(e.target.checked)}
        />
        Use most recent measurements for calculation
      </label>
    )}
  </div>
)}
```

**Coach View & Analytics:**
- Coach can view body fat percentage in client entry history
- Coach can see body fat trends in analytics (chart showing body fat over time)
- Coach can filter entries by body fat range (e.g., entries with body fat > 20%)
- Coach can compare body fat across clients in cohort
- Coach can export body fat data for analysis

**Implementation Notes:**
- Body fat stored as percentage (e.g., 15.5 for 15.5%), not decimal (not 0.155)
- All measurements converted to canonical units (inches → cm, lbs → kg) for calculation
- Calculations match Hitsona formulas exactly
- Validation ensures required fields are present before calculation
- Error messages clearly indicate which measurements are missing

#### 3.2.2 Calendar Date Navigation ⭐
**Value:** Medium - Better UX for date selection

**Hitsona Implementation:**
- Calendar picker with previous/next day buttons
- Shows existing entries in calendar view

**Proposed CoachSync Implementation:**
- Add calendar component to date picker
- Highlight dates with existing entries
- Show entry count per date in calendar
- Keep current date picker as fallback

**Implementation:**
```tsx
// Enhanced date picker component
<Calendar
  mode="single"
  selected={selectedDate}
  onSelect={handleDateSelect}
  modifiers={{
    hasEntry: (date) => entries.some(e => e.date === format(date, 'yyyy-MM-dd'))
  }}
  modifiersClassNames={{
    hasEntry: "bg-blue-100"
  }}
/>
```

#### 3.2.3 Coach-Defined Custom Fields ⭐⭐
**Value:** Medium-High - Allows coaches to collect cohort-specific data

**Hitsona Implementation:**
- User-created custom categories
- Unlimited custom measurements
- Flexible data types (numeric/text)

**Proposed CoachSync Implementation (Coach-Centric):**
```prisma
model CohortCustomField {
  id              String   @id @default(uuid())
  cohortId        String
  name            String   // e.g., "Resting Heart Rate"
  displayName     String   // e.g., "Resting HR"
  fieldType       String   // "numeric" | "text" | "select"
  unit            String?  // e.g., "bpm", "hours"
  required        Boolean  @default(false)
  order           Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  cohort Cohort @relation(fields: [cohortId], references: [id], onDelete: Cascade)
  
  @@index([cohortId])
}

model EntryCustomValue {
  id              String   @id @default(uuid())
  entryId         String
  customFieldId   String
  value           String   @db.Text  // Stored as text for flexibility
  createdAt       DateTime @default(now())
  
  entry        Entry            @relation(fields: [entryId], references: [id], onDelete: Cascade)
  customField  CohortCustomField @relation(fields: [customFieldId], references: [id], onDelete: Cascade)
  
  @@unique([entryId, customFieldId])
  @@index([entryId])
}
```

**Coach Workflow:**
1. Coach creates custom fields for cohort
2. Fields appear in entry form for clients in that cohort
3. Coach can view custom field values in analytics
4. Coach can export custom field data

**Constraints Maintained:**
- Coach controls custom fields (not clients)
- Maintains structure and accountability
- Custom fields tied to cohort (not individual users)

### 3.3 Lower-Value Features (Priority 3)

#### 3.3.1 Mood Tracking ⭐
**Value:** Low-Medium - Nice to have but not core

**Proposed Implementation (Optional):**
```prisma
model MoodEntry {
  id        String   @id @default(uuid())
  userId    String
  date      DateTime @db.Date
  moodValue Int      // 0-100 scale
  notes     String?  @db.Text
  createdAt DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, date])
}
```

**Coach-Client Model:**
- Coach can enable/disable mood tracking per cohort
- Mood appears as separate widget on client dashboard
- Coach can view mood trends in analytics

**Note:** Lower priority - may not align with core fitness tracking focus

#### 3.3.2 Entry Update Support (with Audit Trail) ⭐⭐⭐
**Value:** High - But conflicts with immutability philosophy

**Consideration:** This is a **design decision** more than a feature extraction.

**Option A: Maintain Immutability (Current)**
- **Pros:** Data integrity, audit trail, accountability
- **Cons:** User frustration when mistakes are made

**Option B: Allow Updates with Audit Trail**
```prisma
model Entry {
  // ... existing fields
  updatedAt  DateTime?  // Null if never updated
  updatedBy  String?    // userId who made update (null if never updated)
  
  // Add EntryUpdateHistory table
}

model EntryUpdateHistory {
  id          String   @id @default(uuid())
  entryId     String
  fieldName   String   // "weightLbs", "steps", etc.
  oldValue    String?  @db.Text
  newValue    String?  @db.Text
  updatedBy   String   // userId
  updatedAt   DateTime @default(now())
  reason      String?  @db.Text  // Optional reason for update
  
  entry Entry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  
  @@index([entryId])
}
```

**Coach-Client Model:**
- Coach can enable/disable update permission per cohort
- Updates require coach approval (if strict accountability needed)
- OR allow self-service updates with full audit trail
- Coach can see update history in entry details

**Recommendation:** **Allow updates with audit trail** - improves UX while maintaining accountability through audit history.

---

## 4. Coach Pathways and Workflows

This section ensures all required pathways and points are provided for coaches to perform their coaching functions based on the enhancements. Every enhancement feature must have corresponding coach-facing functionality.

### 4.1 Onboarding and Client Onboarding Review

#### 4.1.1 Coach Views Pending Client Onboarding Data

**Pathway:** Coach Dashboard → Pending Clients → View Onboarding Details

**Functionality:**
- Coach can see list of clients who have completed onboarding but not yet assigned to cohort
- Coach can view full onboarding data:
  - Gender
  - Date of Birth (age calculated)
  - Current Weight (baseline)
  - Height (baseline)
  - Unit preferences (weight: lbs/kg, height: inches/cm)
- Coach can see baseline entry created during onboarding
- Coach can review data before deciding to accept/reject client

**API Endpoints:**
```typescript
// GET /api/coach-dashboard/overview
// Returns: { pendingClients: [{ id, email, name, onboardingData, baselineEntry }] }

// GET /api/clients/:id/onboarding
// Returns: Full onboarding data including baseline entry
// Authorization: Coach must have invited client OR client must be pending
```

**UI Components:**
```tsx
// app/coach-dashboard/page.tsx
<PendingClientsSection>
  {pendingClients.map(client => (
    <ClientCard key={client.id}>
      <ClientInfo client={client} />
      <OnboardingPreview data={client.onboardingData} />
      <BaselineEntryPreview entry={client.baselineEntry} />
      <Actions>
        <Button onClick={() => viewFullOnboarding(client.id)}>
          View Full Details
        </Button>
        <Button onClick={() => addToCohort(client.id)}>
          Add to Cohort
        </Button>
      </Actions>
    </ClientCard>
  ))}
</PendingClientsSection>
```

#### 4.1.2 Coach Accepts/Rejects Client Based on Onboarding

**Pathway:** View Onboarding → Review Data → Accept/Reject

**Functionality:**
- Coach reviews onboarding data (weight, height, age, baseline entry)
- Coach decides if client is suitable for program
- Coach can accept client → Create/assign program → Add to cohort
- Coach can reject client → Remove from pending list (optional rejection reason)
- Coach can request additional information before accepting

**Workflow:**
1. Client completes onboarding → Baseline data saved
2. Client appears in coach's "Pending Clients" section
3. Coach reviews onboarding data
4. Coach creates program (6-week or custom) with start date
5. Coach adds client to cohort → Links client to program
6. Client can now log entries (program tracking begins)

### 4.2 Cohort Configuration and Field Management

#### 4.2.1 Coach Configures Cohort Fields

**Pathway:** Coach Dashboard → Cohorts → [Select Cohort] → Configuration → Field Settings

**Functionality:**
- Coach can enable/disable which fields clients must/optionally provide:
  - **Required Fields:** Weight, Steps, Calories (default all required)
  - **Optional Additional Measurements:** Neck, Waist, Hips, Height
  - **Body Fat:** Enable/disable body fat tracking, set default algorithm
  - **Custom Fields:** Create/edit/delete custom fields for cohort
  - **Notes:** Enable/disable notes field
- Coach can set requirements per field (required, optional, disabled)
- Coach can configure field display order
- Coach can set default values (e.g., default body fat algorithm)

**API Endpoints:**
```typescript
// GET /api/cohorts/:id/config
// Returns: CohortConfig with all field settings

// PUT /api/cohorts/:id/config
// Body: { requireWeight, requireSteps, requireCalories, enableNeck, enableWaist, enableHips, enableHeight, enableBodyFat, bodyFatAlgorithm, requireBodyFat }
// Updates cohort configuration

// GET /api/cohorts/:id/custom-fields
// Returns: Array of CohortCustomField

// POST /api/cohorts/:id/custom-fields
// Body: { name, displayName, fieldType, unit, required, order }
// Creates custom field for cohort

// PUT /api/cohorts/:id/custom-fields/:fieldId
// Updates custom field

// DELETE /api/cohorts/:id/custom-fields/:fieldId
// Deletes custom field (removes from form, keeps historical data)
```

**UI Components:**
```tsx
// app/cohorts/[id]/settings/page.tsx
<CohortSettingsPage>
  <FieldConfiguration>
    <Section title="Required Fields">
      <Checkbox label="Weight (required)" checked={config.requireWeight} />
      <Checkbox label="Steps (required)" checked={config.requireSteps} />
      <Checkbox label="Calories (required)" checked={config.requireCalories} />
    </Section>
    <Section title="Additional Measurements">
      <Checkbox label="Enable Neck" checked={config.enableNeck} />
      <Checkbox label="Enable Waist" checked={config.enableWaist} />
      <Checkbox label="Enable Hips" checked={config.enableHips} />
      <Checkbox label="Enable Height" checked={config.enableHeight} />
    </Section>
    <Section title="Body Fat Tracking">
      <Checkbox label="Enable Body Fat" checked={config.enableBodyFat} />
      {config.enableBodyFat && (
        <>
          <Select label="Default Algorithm" value={config.bodyFatAlgorithm}>
            <Option value="bmi">BMI Method</Option>
            <Option value="us_navy">U.S. Navy Method</Option>
          </Select>
          <Checkbox label="Require Body Fat" checked={config.requireBodyFat} />
        </>
      )}
    </Section>
    <Section title="Other Fields">
      <Checkbox label="Enable Notes" checked={config.enableNotes} />
    </Section>
  </FieldConfiguration>
  <CustomFieldsManagement>
    <Button onClick={createCustomField}>Add Custom Field</Button>
    {customFields.map(field => (
      <CustomFieldEditor key={field.id} field={field} />
    ))}
  </CustomFieldsManagement>
</CohortSettingsPage>
```

#### 4.2.2 Coach Creates Custom Fields for Cohort

**Pathway:** Cohort Settings → Custom Fields → Create Custom Field

**Functionality:**
- Coach creates custom field with:
  - Name (internal identifier)
  - Display Name (shown to clients)
  - Field Type (numeric, text, select)
  - Unit (optional, e.g., "bpm", "hours")
  - Required/Optional toggle
  - Display order
- Coach can edit existing custom fields
- Coach can delete custom fields (removes from form, preserves historical data)
- Coach can reorder custom fields

**Custom Field Types:**
- **Numeric:** For measurements (e.g., Resting Heart Rate, Sleep Hours)
- **Text:** For notes/observations (e.g., Energy Level, Sleep Quality)
- **Select:** For predefined options (e.g., Mood: Great/Good/Fair/Poor)

**Implementation:**
```tsx
// Custom field creation form
<CustomFieldForm onSubmit={handleCreate}>
  <Input label="Field Name" value={name} required />
  <Input label="Display Name" value={displayName} required />
  <Select label="Field Type" value={fieldType}>
    <Option value="numeric">Numeric</Option>
    <Option value="text">Text</Option>
    <Option value="select">Select (Dropdown)</Option>
  </Select>
  {fieldType === "numeric" && (
    <Input label="Unit (optional)" value={unit} placeholder="e.g., bpm, hours" />
  )}
  {fieldType === "select" && (
    <MultiInput label="Options (one per line)" value={options} />
  )}
  <Checkbox label="Required" checked={required} />
  <Input type="number" label="Display Order" value={order} />
</CustomFieldForm>
```

### 4.3 Program Management

#### 4.3.1 Coach Creates Program for Cohort

**Pathway:** Coach Dashboard → Cohorts → [Select Cohort] → Create Program

**Functionality:**
- Coach creates program with:
  - Program name (e.g., "6-Week Transformation", "12-Week Strength Builder")
  - Duration: 6-week standard OR custom number of weeks
  - Start date (typically today or cohort start)
  - End date (auto-calculated: start date + duration)
- Coach can assign clients to program
- Coach can view program progress and completion status
- Coach can update program (extend duration, modify dates)
- Coach can archive/complete programs

**API Endpoints:**
```typescript
// POST /api/programs
// Body: { cohortId, name, durationWeeks, startDate }
// Returns: Program with calculated endDate

// GET /api/programs/cohort/:cohortId
// Returns: All programs for cohort

// GET /api/programs/:id
// Returns: Program with clients and entries

// PUT /api/programs/:id
// Body: { name?, durationWeeks?, startDate? }
// Updates program (recalculates endDate)

// POST /api/programs/:id/clients
// Body: { userId }
// Adds client to program

// GET /api/programs/:id/progress
// Returns: Program progress stats (days remaining, completion %, client progress)
```

**UI Components:**
```tsx
// Program creation form
<ProgramCreationForm onSubmit={handleCreate}>
  <Input label="Program Name" value={name} required />
  <RadioGroup label="Duration">
    <Radio value="6" label="6 Weeks (Standard)" />
    <Radio value="custom" label="Custom Weeks" />
  </RadioGroup>
  {durationType === "custom" && (
    <Input type="number" label="Number of Weeks" value={customWeeks} min={1} />
  )}
  <DatePicker label="Start Date" value={startDate} required />
  <DisplayField label="End Date" value={calculateEndDate(startDate, durationWeeks)} />
  <Select label="Assign Clients" multiple>
    {cohortClients.map(client => (
      <Option key={client.id} value={client.id}>{client.name}</Option>
    ))}
  </Select>
</ProgramCreationForm>
```

#### 4.3.2 Coach Views Program Progress and Analytics

**Pathway:** Programs → [Select Program] → Analytics

**Functionality:**
- Coach can view:
  - Program timeline (days remaining, completion percentage)
  - Client progress against baseline (weight change, body measurements)
  - Entry completion rates per client
  - Average progress metrics across cohort
  - Program milestones and achievements
- Coach can compare clients within program
- Coach can export program data for analysis
- Coach can generate program reports

**UI Components:**
```tsx
// Program analytics page
<ProgramAnalytics program={program}>
  <ProgramTimeline>
    <ProgressBar current={daysElapsed} total={durationDays} />
    <Text>Days Remaining: {daysRemaining}</Text>
    <Text>Completion: {completionPercentage}%</Text>
  </ProgramTimeline>
  <ClientProgressGrid>
    {programClients.map(client => (
      <ClientProgressCard key={client.id} client={client}>
        <BaselineComparison
          baseline={client.baselineEntry}
          current={client.latestEntry}
        />
        <ProgressChart data={client.entries} />
        <EntryCompletionRate entries={client.entries} programDuration={program.durationWeeks} />
      </ClientProgressCard>
    ))}
  </ClientProgressGrid>
  <CohortAverages>
    <AverageWeightChange />
    <AverageSteps />
    <AverageCalories />
    {program.config.enableBodyFat && <AverageBodyFat />}
  </CohortAverages>
  <ExportButton onClick={exportProgramData}>Export Program Data</ExportButton>
</ProgramAnalytics>
```

### 4.4 Client Entry Viewing and Analysis

#### 4.4.1 Coach Views Client Entries with All Enhanced Data

**Pathway:** Coach Dashboard → Clients → [Select Client] → Entries

**Functionality:**
- Coach can view all client entries with:
  - **Standard Fields:** Weight, Steps, Calories (with unit conversion)
  - **Additional Measurements:** Neck, Waist, Hips, Height (if enabled for cohort)
  - **Body Fat Percentage:** Calculated or manually entered
  - **Custom Fields:** All custom field values for cohort
  - **Notes:** Client notes for entry
  - **Entry Date:** When entry was created
  - **Update History:** If entry was updated (audit trail)
- Coach can filter entries by date range
- Coach can filter entries by field values (e.g., entries with body fat > 20%)
- Coach can search entries by notes
- Coach can sort entries by any field

**API Endpoints:**
```typescript
// GET /api/clients/:id/entries
// Query params: startDate?, endDate?, field?, value?
// Returns: Array of entries with all fields, custom values, notes, update history
// Authorization: Coach must have client in their cohort

// GET /api/clients/:id/entries/:entryId
// Returns: Single entry with full details including update history
```

**UI Components:**
```tsx
// Client entries view
<ClientEntriesPage client={client}>
  <EntryFilters>
    <DateRangePicker value={dateRange} onChange={setDateRange} />
    <Select label="Filter by Field" value={filterField}>
      <Option value="bodyFat">Body Fat %</Option>
      <Option value="weight">Weight</Option>
      <Option value="steps">Steps</Option>
      {/* ... other fields */}
    </Select>
    <Input label="Search Notes" value={notesSearch} />
  </EntryFilters>
  <EntryTable>
    <TableHeader>
      <Column sortable>Date</Column>
      <Column sortable>Weight</Column>
      <Column sortable>Steps</Column>
      <Column sortable>Calories</Column>
      {config.enableNeck && <Column sortable>Neck</Column>}
      {config.enableWaist && <Column sortable>Waist</Column>}
      {config.enableHips && <Column sortable>Hips</Column>}
      {config.enableHeight && <Column sortable>Height</Column>}
      {config.enableBodyFat && <Column sortable>Body Fat %</Column>}
      {customFields.map(field => <Column key={field.id} sortable>{field.displayName}</Column>)}
      <Column>Notes</Column>
      <Column>Actions</Column>
    </TableHeader>
    {entries.map(entry => (
      <EntryRow key={entry.id} entry={entry}>
        <Cell>{formatDate(entry.date)}</Cell>
        <Cell>{convertWeight(entry.weightLbs, client.preferences.weightUnit)}</Cell>
        <Cell>{entry.steps?.toLocaleString() || "—"}</Cell>
        <Cell>{entry.calories?.toLocaleString() || "—"}</Cell>
        {config.enableNeck && <Cell>{entry.neckInches ? convertInches(entry.neckInches, client.preferences.measurementUnit) : "—"}</Cell>}
        {config.enableWaist && <Cell>{entry.waistInches ? convertInches(entry.waistInches, client.preferences.measurementUnit) : "—"}</Cell>}
        {config.enableHips && <Cell>{entry.hipsInches ? convertInches(entry.hipsInches, client.preferences.measurementUnit) : "—"}</Cell>}
        {config.enableHeight && <Cell>{entry.heightInches ? convertInches(entry.heightInches, client.preferences.measurementUnit) : "—"}</Cell>}
        {config.enableBodyFat && <Cell>{entry.bodyFatPercentage ? `${entry.bodyFatPercentage}%` : "—"}</Cell>}
        {customFields.map(field => (
          <Cell key={field.id}>
            {entry.customValues.find(cv => cv.customFieldId === field.id)?.value || "—"}
          </Cell>
        ))}
        <Cell>
          {entry.notes && <NotesTooltip notes={entry.notes} />}
        </Cell>
        <Cell>
          <Button variant="ghost" onClick={() => viewEntryDetails(entry.id)}>
            View Details
          </Button>
          {entry.updatedAt && <UpdateHistoryBadge count={entry.updateHistory.length} />}
        </Cell>
      </EntryRow>
    ))}
  </EntryTable>
</ClientEntriesPage>
```

#### 4.4.2 Coach Views Entry Details with Update History

**Pathway:** Client Entries → [Select Entry] → Entry Details

**Functionality:**
- Coach can view full entry details:
  - All field values (standard, additional, custom)
  - Notes (if any)
  - Created date/time
  - Updated date/time (if updated)
  - Who updated (if updated by client/coach)
  - Update history (audit trail)
- Coach can see update history:
  - Field name that changed
  - Old value → New value
  - Who made change
  - When change was made
  - Reason for change (if provided)
- Coach can add coach notes (separate from client notes)

**UI Components:**
```tsx
// Entry details modal/page
<EntryDetailsModal entry={entry}>
  <EntryHeader>
    <Date>{formatDate(entry.date)}</Date>
    {entry.isBaseline && <Badge>Baseline Entry</Badge>}
    {entry.updatedAt && <Badge variant="secondary">Updated</Badge>}
  </EntryHeader>
  <EntryFields>
    {/* Display all fields */}
  </EntryFields>
  {entry.notes && (
    <NotesSection>
      <Label>Client Notes</Label>
      <Text>{entry.notes}</Text>
    </NotesSection>
  )}
  {entry.updateHistory.length > 0 && (
    <UpdateHistorySection>
      <Label>Update History</Label>
      {entry.updateHistory.map(update => (
        <UpdateRecord key={update.id}>
          <Field>{update.fieldName}</Field>
          <Change>{update.oldValue} → {update.newValue}</Change>
          <Metadata>
            By {update.updatedBy.name} on {formatDateTime(update.updatedAt)}
            {update.reason && <Reason>{update.reason}</Reason>}
          </Metadata>
        </UpdateRecord>
      ))}
    </UpdateHistorySection>
  )}
  <CoachNotesSection>
    <Label>Coach Notes</Label>
    <Textarea value={coachNotes} onChange={setCoachNotes} />
    <Button onClick={saveCoachNotes}>Save Coach Notes</Button>
  </CoachNotesSection>
</EntryDetailsModal>
```

### 4.5 Analytics and Reporting

#### 4.5.1 Coach Views Client Analytics with All Enhanced Metrics

**Pathway:** Clients → [Select Client] → Analytics

**Functionality:**
- Coach can view analytics for client including:
  - **Weight Trends:** Chart showing weight over time, comparison to baseline
  - **Steps Trends:** Daily/weekly steps, averages, goals
  - **Calories Trends:** Daily/weekly calories, averages
  - **Body Measurements:** Neck, Waist, Hips, Height trends (if enabled)
  - **Body Fat Trends:** Body fat percentage over time (if enabled)
  - **Custom Fields:** Trends for all custom fields (numeric only)
  - **Entry Completion:** Percentage of days with entries, streak
  - **Progress Summary:** Weight change from baseline, average metrics
- Coach can filter by date range (7 days, 30 days, program duration, custom)
- Coach can compare to baseline entry
- Coach can compare to cohort averages
- Coach can export analytics data

**API Endpoints:**
```typescript
// GET /api/clients/:id/analytics
// Query params: startDate?, endDate?, compareToBaseline?, compareToCohort?
// Returns: {
//   weightTrends: [{ date, value }],
//   stepsTrends: [{ date, value }],
//   caloriesTrends: [{ date, value }],
//   bodyFatTrends: [{ date, value }],
//   customFieldTrends: { [fieldId]: [{ date, value }] },
//   summary: {
//     baselineWeight, currentWeight, weightChange,
//     avgSteps, avgCalories, avgBodyFat,
//     entryCompletionRate, currentStreak
//   },
//   baselineComparison: { weightChange, stepsChange, etc. },
//   cohortComparison: { weightAvg, stepsAvg, etc. }
// }
```

**UI Components:**
```tsx
// Client analytics page
<ClientAnalyticsPage client={client}>
  <AnalyticsFilters>
    <DateRangePicker value={dateRange} onChange={setDateRange} />
    <Checkbox label="Compare to Baseline" checked={compareToBaseline} />
    <Checkbox label="Compare to Cohort Average" checked={compareToCohort} />
  </AnalyticsFilters>
  <SummaryCards>
    <Card label="Weight Change" value={analytics.summary.weightChange} unit="lbs" trend={analytics.summary.weightChange > 0 ? "up" : "down"} />
    <Card label="Avg Steps" value={analytics.summary.avgSteps} />
    <Card label="Avg Calories" value={analytics.summary.avgCalories} />
    {config.enableBodyFat && <Card label="Avg Body Fat" value={analytics.summary.avgBodyFat} unit="%" />}
    <Card label="Entry Completion" value={analytics.summary.entryCompletionRate} unit="%" />
  </SummaryCards>
  <ChartsGrid>
    <Chart title="Weight Trend">
      <LineChart data={analytics.weightTrends} baseline={baselineEntry.weightLbs} />
    </Chart>
    <Chart title="Steps Trend">
      <LineChart data={analytics.stepsTrends} />
    </Chart>
    <Chart title="Calories Trend">
      <LineChart data={analytics.caloriesTrends} />
    </Chart>
    {config.enableBodyFat && (
      <Chart title="Body Fat Trend">
        <LineChart data={analytics.bodyFatTrends} />
      </Chart>
    )}
    {config.enableWaist && (
      <Chart title="Waist Measurement">
        <LineChart data={analytics.waistTrends} />
      </Chart>
    )}
    {customNumericFields.map(field => (
      <Chart key={field.id} title={field.displayName}>
        <LineChart data={analytics.customFieldTrends[field.id]} />
      </Chart>
    ))}
  </ChartsGrid>
  {compareToBaseline && (
    <BaselineComparisonTable>
      <ComparisonRow field="Weight" baseline={baselineEntry.weightLbs} current={analytics.summary.currentWeight} change={analytics.baselineComparison.weightChange} />
      {/* ... other fields */}
    </BaselineComparisonTable>
  )}
  {compareToCohort && (
    <CohortComparisonTable>
      <ComparisonRow field="Avg Weight" client={analytics.summary.currentWeight} cohort={analytics.cohortComparison.weightAvg} />
      {/* ... other fields */}
    </CohortComparisonTable>
  )}
  <ExportButton onClick={exportAnalytics}>Export Analytics Data</ExportButton>
</ClientAnalyticsPage>
```

#### 4.5.2 Coach Views Cohort Analytics

**Pathway:** Cohorts → [Select Cohort] → Analytics

**Functionality:**
- Coach can view aggregated analytics for entire cohort:
  - Average weight change across cohort
  - Average steps, calories, body fat
  - Entry completion rates per client
  - Progress distribution (how many clients are on track)
  - Top performers (most improvement)
  - Clients needing attention (low completion, no progress)
- Coach can compare clients within cohort
- Coach can export cohort analytics

**API Endpoints:**
```typescript
// GET /api/cohorts/:id/analytics
// Query params: startDate?, endDate?, programId?
// Returns: {
//   cohortAverages: { avgWeightChange, avgSteps, avgCalories, avgBodyFat },
//   clientProgress: [{ clientId, name, progress, completionRate }],
//   distribution: { onTrack: number, behind: number, ahead: number },
//   topPerformers: [{ clientId, name, improvement }],
//   needAttention: [{ clientId, name, issue }]
// }
```

### 4.6 Body Fat Calculation for Clients

#### 4.6.1 Coach Can Calculate Body Fat for Client Entry

**Pathway:** Client Entries → [View Entry] → Calculate Body Fat

**Functionality:**
- Coach can calculate body fat for client entry if:
  - Client hasn't entered body fat yet
  - Coach wants to verify client's calculation
  - Client doesn't have required measurements (coach can enter them)
- Coach selects algorithm (BMI Method or U.S. Navy Method)
- Coach enters required measurements:
  - **BMI Method:** Weight, Height, Age, Gender
  - **U.S. Navy Method:** Height, Waist, Neck, (Hips for females), Gender
- Coach can use most recent measurements for client (if available)
- Coach can manually enter measurements
- Calculation result populates body fat field
- Coach can override calculation with manual entry

**UI Components:**
```tsx
// Body fat calculation dialog (coach view)
<BodyFatCalculationDialog entry={entry} client={client} onSubmit={handleCalculate}>
  <Select label="Algorithm" value={algorithm} onChange={setAlgorithm}>
    <Option value="bmi">BMI Method</Option>
    <Option value="us_navy">U.S. Navy Method</Option>
  </Select>
  {algorithm === "bmi" && (
    <>
      <Input label="Weight (lbs)" value={weight} onChange={setWeight} />
      <Input label="Height (inches)" value={height} onChange={setHeight} />
      <Input label="Age" value={age} onChange={setAge} />
      <Select label="Gender" value={gender} onChange={setGender}>
        <Option value="male">Male</Option>
        <Option value="female">Female</Option>
      </Select>
      <HelpText>Uses most recent measurements if available: Weight={client.recentWeight}, Height={client.recentHeight}, Age={client.age}</HelpText>
      <Checkbox label="Use most recent measurements" checked={useRecent} onChange={setUseRecent} />
    </>
  )}
  {algorithm === "us_navy" && (
    <>
      <Input label="Height (inches)" value={height} onChange={setHeight} />
      <Input label="Waist (inches)" value={waist} onChange={setWaist} />
      <Input label="Neck (inches)" value={neck} onChange={setNeck} />
      {gender === "female" && (
        <Input label="Hips (inches)" value={hips} onChange={setHips} required />
      )}
      <Select label="Gender" value={gender} onChange={setGender}>
        <Option value="male">Male</Option>
        <Option value="female">Female</Option>
      </Select>
      <HelpText>Uses most recent measurements if available</HelpText>
      <Checkbox label="Use most recent measurements" checked={useRecent} onChange={setUseRecent} />
    </>
  )}
  <Button onClick={calculateBodyFat}>Calculate</Button>
  {calculatedValue && (
    <ResultDisplay>
      <Text>Calculated Body Fat: {calculatedValue}%</Text>
      <Button onClick={() => saveBodyFat(calculatedValue)}>Save to Entry</Button>
      <Button variant="outline" onClick={handleManualEntry}>Enter Manually Instead</Button>
    </ResultDisplay>
  )}
</BodyFatCalculationDialog>
```

#### 4.6.2 Coach Configures Body Fat Defaults for Cohort

**Pathway:** Cohort Settings → Field Configuration → Body Fat Settings

**Functionality:**
- Coach can enable/disable body fat tracking for cohort
- Coach can set default algorithm (BMI Method or U.S. Navy Method)
- Coach can require body fat if enabled
- Coach can configure which measurements are required for calculation
- Coach can see which clients have body fat data and which don't

**UI Components:**
```tsx
// Body fat configuration in cohort settings
<BodyFatConfiguration>
  <Checkbox 
    label="Enable Body Fat Tracking" 
    checked={config.enableBodyFat}
    onChange={(checked) => updateConfig({ enableBodyFat: checked })}
  />
  {config.enableBodyFat && (
    <>
      <Select 
        label="Default Algorithm" 
        value={config.bodyFatAlgorithm}
        onChange={(value) => updateConfig({ bodyFatAlgorithm: value })}
      >
        <Option value="bmi">BMI Method</Option>
        <Option value="us_navy">U.S. Navy Method</Option>
      </Select>
      <HelpText>
        BMI Method requires: Weight, Height, Age, Gender
        U.S. Navy Method requires: Height, Waist, Neck, (Hips for females), Gender
      </HelpText>
      <Checkbox 
        label="Require Body Fat for Entries" 
        checked={config.requireBodyFat}
        onChange={(checked) => updateConfig({ requireBodyFat: checked })}
      />
      <BodyFatStatusSummary>
        <Text>Clients with body fat data: {clientsWithBodyFat}/{totalClients}</Text>
        <Button onClick={viewBodyFatStatus}>View Details</Button>
      </BodyFatStatusSummary>
    </>
  )}
</BodyFatConfiguration>
```

### 4.7 Data Export and Reporting

#### 4.7.1 Coach Exports Client Data

**Pathway:** Clients → [Select Client] → Export Data

**Functionality:**
- Coach can export client data in multiple formats:
  - **CSV:** Spreadsheet format for analysis
  - **JSON:** Structured data for programmatic access
  - **PDF:** Formatted report (optional)
- Coach can select what data to export:
  - All entries or date range
  - All fields or specific fields
  - Include/exclude custom fields
  - Include/exclude notes
  - Include/exclude update history
- Export includes:
  - All entry fields (weight, steps, calories, measurements, body fat, custom fields)
  - Entry dates and timestamps
  - Notes and coach notes
  - Update history (if enabled)
  - Baseline entry
  - Program information (if linked)

**API Endpoints:**
```typescript
// GET /api/clients/:id/export
// Query params: format=csv|json|pdf, startDate?, endDate?, fields?, includeNotes?, includeHistory?
// Returns: File download or JSON data

// POST /api/clients/:id/export (for large datasets)
// Body: { format, startDate?, endDate?, fields?, includeNotes?, includeHistory? }
// Returns: { exportId, status: "processing" }

// GET /api/exports/:exportId
// Returns: Export status and download URL when ready
```

#### 4.7.2 Coach Exports Cohort Data

**Pathway:** Cohorts → [Select Cohort] → Export Data

**Functionality:**
- Coach can export aggregated cohort data:
  - All clients in cohort with their entries
  - Cohort summary statistics
  - Program progress (if program exists)
  - Comparison data (baseline vs. current, client vs. cohort averages)
- Export format: CSV (structured for analysis), JSON, PDF report

**API Endpoints:**
```typescript
// GET /api/cohorts/:id/export
// Query params: format=csv|json|pdf, includeEntries?, includeAnalytics?
// Returns: File download

// POST /api/cohorts/:id/export
// Body: { format, includeEntries, includeAnalytics, startDate?, endDate? }
// Returns: { exportId, status: "processing" }
```

### 4.8 Entry Management and Updates

#### 4.8.1 Coach Can Update Client Entries (with Audit Trail)

**Pathway:** Client Entries → [Select Entry] → Edit Entry

**Functionality:**
- Coach can update any field in client entry if:
  - Update permission enabled for cohort
  - Coach has edit permission
- Coach can update:
  - Any standard field (weight, steps, calories)
  - Additional measurements (neck, waist, hips, height)
  - Body fat percentage
  - Custom field values
  - Notes (add coach notes or update client notes)
- All updates recorded in audit trail:
  - Field name changed
  - Old value → New value
  - Who made change (coach ID)
  - When change was made
  - Reason for change (optional)
- Client can see updates in their entry history
- Coach can view update history

**API Endpoints:**
```typescript
// PUT /api/entries/:id
// Body: { weightLbs?, steps?, calories?, neckInches?, waistInches?, hipsInches?, heightInches?, bodyFatPercentage?, customValues?: [{ fieldId, value }], notes?, reason? }
// Authorization: Coach must have client in cohort AND cohort must allow updates
// Returns: Updated entry with update history

// GET /api/entries/:id/history
// Returns: Array of update records with full audit trail
```

**UI Components:**
```tsx
// Entry edit form (coach view)
<EntryEditForm entry={entry} onSubmit={handleUpdate}>
  <Fields>
    <Input label="Weight (lbs)" value={weightLbs} onChange={setWeightLbs} />
    <Input label="Steps" value={steps} onChange={setSteps} />
    <Input label="Calories" value={calories} onChange={setCalories} />
    {/* ... other fields */}
  </Fields>
  <Textarea label="Reason for Update" value={updateReason} onChange={setUpdateReason} placeholder="Optional: Explain why this entry is being updated" />
  <Button onClick={handleUpdate}>Update Entry</Button>
  <Warning>This change will be recorded in the entry history.</Warning>
</EntryEditForm>
```

### 4.9 Summary: Complete Coach Pathway Matrix

| Coach Function | Pathway | API Endpoints | UI Components | Enhancement Feature |
|----------------|---------|---------------|---------------|---------------------|
| **View Onboarding** | Dashboard → Pending Clients → View Details | `GET /api/clients/:id/onboarding` | `OnboardingPreview`, `BaselineEntryPreview` | Onboarding System |
| **Configure Cohort** | Cohorts → Settings → Field Config | `PUT /api/cohorts/:id/config` | `CohortSettingsPage`, `FieldConfiguration` | Cohort Config |
| **Create Custom Fields** | Cohort Settings → Custom Fields → Create | `POST /api/cohorts/:id/custom-fields` | `CustomFieldForm`, `CustomFieldEditor` | Custom Fields |
| **Create Program** | Cohorts → Create Program | `POST /api/programs` | `ProgramCreationForm` | Program Model |
| **View Program Progress** | Programs → Analytics | `GET /api/programs/:id/progress` | `ProgramAnalyticsPage` | Program Tracking |
| **View Client Entries** | Clients → Entries | `GET /api/clients/:id/entries` | `ClientEntriesPage`, `EntryTable` | All Entry Fields |
| **View Entry Details** | Entries → Entry Details | `GET /api/entries/:id` | `EntryDetailsModal` | Update History |
| **Calculate Body Fat** | Entry Details → Calculate | `POST /api/entries/calculate-body-fat` | `BodyFatCalculationDialog` | Body Fat Calculation |
| **View Client Analytics** | Clients → Analytics | `GET /api/clients/:id/analytics` | `ClientAnalyticsPage` | Analytics with All Metrics |
| **View Cohort Analytics** | Cohorts → Analytics | `GET /api/cohorts/:id/analytics` | `CohortAnalyticsPage` | Cohort Aggregations |
| **Export Client Data** | Clients → Export | `GET /api/clients/:id/export` | `ExportDialog` | Data Export |
| **Export Cohort Data** | Cohorts → Export | `GET /api/cohorts/:id/export` | `ExportDialog` | Cohort Export |
| **Update Entry** | Entries → Edit | `PUT /api/entries/:id` | `EntryEditForm` | Update with Audit Trail |

---

## 5. Implementation Roadmap

**Note:** This roadmap includes all coach pathway implementations listed in Section 4.

### Phase 1: Core Enhancements (Week 1-2)

#### 1.1 Unit Conversion System
- [ ] Create `UserPreference` model
- [ ] Add unit conversion utilities
- [ ] Update Entry model to support unit conversion
- [ ] Add unit selector in user settings
- [ ] Update frontend to display in user's preferred unit
- [ ] Migrate existing data

#### 1.2 Optional Fields
- [ ] Make Entry fields nullable
- [ ] Update validation schema (at least one field required)
- [ ] Update frontend form (remove required attributes)
- [ ] Update analytics to handle null values
- [ ] Update coach view to show partial entries

#### 1.3 Notes Field
- [ ] Add `notes` field to Entry model
- [ ] Add notes textarea to entry form
- [ ] Display notes in entry history
- [ ] Show notes in coach entry view

### Phase 2: Measurement Enhancements (Week 3-4)

#### 2.1 Additional Body Measurements
- [ ] Add neck, waist, hips, height fields to Entry model
- [ ] Create CohortConfig model for field configuration
- [ ] Add collapsible section to entry form
- [ ] Coach configuration UI for enabling fields
- [ ] Update analytics to include new fields

#### 2.2 Body Fat Calculation (Matching Hitsona Implementation)
- [ ] Add bodyFatPercentage field to Entry model
- [ ] Add bodyFatAlgorithm to CohortConfig (coach sets default)
- [ ] Add bodyFatAlgorithm to UserPreference (client can override)
- [ ] Implement BMI Method calculation (matching Hitsona formula)
- [ ] Implement U.S. Navy Method calculation (matching Hitsona formula)
- [ ] Create calculation API endpoint (`POST /api/entries/calculate-body-fat`)
- [ ] Add calculation button to client entry form
- [ ] Add "use most recent measurements" option for calculation
- [ ] Add coach body fat calculation dialog (Section 4.6.1)
- [ ] Add body fat configuration to cohort settings (Section 4.6.2)
- [ ] Add body fat chart to coach analytics
- [ ] Add body fat trends to client analytics
- [ ] Add body fat to cohort analytics

### Phase 3: Advanced Features (Week 5-6)

#### 3.1 Coach-Defined Custom Fields
- [ ] Create CohortCustomField model
- [ ] Create EntryCustomValue model
- [ ] Coach UI for creating custom fields
- [ ] Dynamic form generation for custom fields
- [ ] Custom field analytics for coaches

#### 3.2 Enhanced Date Navigation
- [ ] Add calendar component
- [ ] Highlight dates with entries
- [ ] Add previous/next day navigation
- [ ] Show entry count in calendar view

#### 3.3 Entry Update Support (Optional)
- [ ] Add updatedAt/updatedBy fields to Entry
- [ ] Create EntryUpdateHistory model
- [ ] Add PUT endpoint for entry updates
- [ ] Add update history view for coaches
- [ ] Add update UI for clients (with coach approval if needed)

### Phase 4: Analytics Enhancements (Week 7-8)

#### 4.1 Enhanced Analytics
- [ ] Add more summary statistics (weight change %, weekly averages)
- [ ] Add cohort comparison charts (if multiple clients)
- [ ] Add goal tracking (if goals feature added)
- [ ] Add export functionality for coaches

#### 4.2 Visualization Improvements
- [ ] Enhance chart styling (match Hitsona quality)
- [ ] Add more chart types (area, bar charts)
- [ ] Add interactive chart features (zoom, pan)
- [ ] Add chart annotations (goals, milestones)

---

## 6. Design Constraints to Maintain

### 5.1 Core Constraints (Must Maintain)

1. **Coach-Client Relationship Model**
   - Clients can only create their own entries
   - Coaches can only view clients in their cohorts
   - Cohort membership required for entry creation
   - No family/shared access model

2. **Role-Based Access Control**
   - CLIENT role for entry creation
   - COACH role for viewing client data
   - ADMIN role for system management
   - No permission-based system

3. **Accountability Focus**
   - Entries visible to coach (maintains accountability)
   - Coach can configure what data to collect
   - Coach controls custom fields (not clients)

4. **Simple Data Model**
   - Avoid over-engineering
   - Maintain readability and maintainability
   - Keep database schema simple

### 5.2 Flexible Constraints (Can Adjust)

1. **Immutable Entries**
   - **Can relax:** Allow updates with audit trail
   - Maintains accountability while improving UX
   - Recommended: Implement update support with audit trail

2. **Fixed Fields**
   - **Can extend:** Add optional standard fields
   - **Can extend:** Add coach-defined custom fields
   - Maintains structure while adding flexibility

3. **Required Fields**
   - **Can relax:** Make all fields optional
   - At least one field must be provided (validation)
   - Improves adoption by reducing friction

---

## 7. Database Schema Enhancements

### 6.1 Enhanced Entry Model

```prisma
model Entry {
  id              String   @id @default(uuid())
  userId          String
  date            DateTime @db.Date
  
  // Core fields (optional)
  weightLbs       Float?
  steps           Int?
  calories        Int?
  
  // Additional measurements (optional)
  neckInches      Float?
  waistInches     Float?
  hipsInches      Float?
  heightInches    Float?
  bodyFatPercentage Float?
  
  // Metadata
  notes           String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  updatedBy       String?  // userId who last updated (null if never updated)
  
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  customValues    EntryCustomValue[]
  updateHistory   EntryUpdateHistory[]
  
  @@unique([userId, date])
  @@index([userId, date])
}
```

### 6.2 New Models

```prisma
model UserPreference {
  id                String   @id @default(uuid())
  userId            String   @unique
  weightUnit        String   @default("lbs")  // "lbs" | "kg"
  measurementUnit   String   @default("inches")  // "inches" | "cm"
  bodyFatAlgorithm  String   @default("us_navy")  // "bmi" | "us_navy"
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model CohortConfig {
  id              String   @id @default(uuid())
  cohortId        String   @unique
  requireWeight   Boolean  @default(true)
  requireSteps    Boolean  @default(true)
  requireCalories Boolean  @default(true)
  enableNeck      Boolean  @default(false)
  enableWaist     Boolean  @default(false)
  enableHips      Boolean  @default(false)
  enableHeight    Boolean  @default(false)
  enableBodyFat   Boolean  @default(false)
  allowUpdates    Boolean  @default(false)  // Coach controls if entries can be updated
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  cohort Cohort @relation(fields: [cohortId], references: [id], onDelete: Cascade)
}

model CohortCustomField {
  id          String   @id @default(uuid())
  cohortId    String
  name        String
  displayName String
  fieldType   String   // "numeric" | "text" | "select"
  unit        String?
  required    Boolean  @default(false)
  options     String?  @db.Text  // JSON array for select type
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  cohort      Cohort            @relation(fields: [cohortId], references: [id], onDelete: Cascade)
  entryValues EntryCustomValue[]
  
  @@index([cohortId])
}

model EntryCustomValue {
  id           String   @id @default(uuid())
  entryId      String
  customFieldId String
  value        String   @db.Text
  createdAt    DateTime @default(now())
  
  entry       Entry            @relation(fields: [entryId], references: [id], onDelete: Cascade)
  customField CohortCustomField @relation(fields: [customFieldId], references: [id], onDelete: Cascade)
  
  @@unique([entryId, customFieldId])
  @@index([entryId])
}

model EntryUpdateHistory {
  id        String   @id @default(uuid())
  entryId   String
  fieldName String
  oldValue  String?  @db.Text
  newValue  String?  @db.Text
  updatedBy String   // userId
  reason    String?  @db.Text
  updatedAt DateTime @default(now())
  
  entry Entry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  
  @@index([entryId])
  @@index([updatedAt])
}
```

---

## 8. API Enhancements

### 7.1 Enhanced Entry Creation

```typescript
// POST /api/entries
export async function POST(req: NextRequest) {
  const session = await auth()
  
  // Validate role
  if (!session.user.roles.includes(Role.CLIENT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  
  // Check cohort membership
  const membership = await db.cohortMembership.findFirst({
    where: { userId: session.user.id }
  })
  
  if (!membership) {
    return NextResponse.json(
      { error: "Must be in a cohort to create entries" },
      { status: 403 }
    )
  }
  
  // Get cohort config to determine required fields
  const cohortConfig = await db.cohortConfig.findUnique({
    where: { cohortId: membership.cohortId }
  })
  
  // Validate entry data with cohort config
  const validated = createEntrySchema.parse(body)
  
  // Convert units if needed (store in canonical units)
  const userPrefs = await db.userPreference.findUnique({
    where: { userId: session.user.id }
  })
  
  // Create entry with converted values
  const entry = await db.entry.create({
    data: {
      userId: session.user.id,
      date: normalizedDate,
      weightLbs: convertWeight(validated.weight, userPrefs?.weightUnit || "lbs", "lbs"),
      steps: validated.steps,
      calories: validated.calories,
      neckInches: validated.neck ? convertMeasurement(validated.neck, userPrefs?.measurementUnit || "inches", "inches") : null,
      // ... other fields
      notes: validated.notes,
    }
  })
  
  // Create custom field values if provided
  if (validated.customValues) {
    await db.entryCustomValue.createMany({
      data: validated.customValues.map(cv => ({
        entryId: entry.id,
        customFieldId: cv.fieldId,
        value: cv.value
      }))
    })
  }
  
  return NextResponse.json(entry, { status: 201 })
}
```

### 7.2 Entry Update (if implemented)

```typescript
// PUT /api/entries/:id
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  
  // Get entry and verify ownership
  const entry = await db.entry.findUnique({
    where: { id }
  })
  
  if (entry.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  
  // Check if updates are allowed (cohort config)
  const membership = await db.cohortMembership.findFirst({
    where: { userId: session.user.id }
  })
  
  const cohortConfig = await db.cohortConfig.findUnique({
    where: { cohortId: membership.cohortId }
  })
  
  if (!cohortConfig?.allowUpdates) {
    return NextResponse.json(
      { error: "Entry updates not allowed for this cohort" },
      { status: 403 }
    )
  }
  
  const validated = updateEntrySchema.parse(body)
  
  // Track changes for audit trail
  const changes: Array<{field: string, oldValue: any, newValue: any}> = []
  
  // Update entry and track changes
  const updatedEntry = await db.entry.update({
    where: { id },
    data: {
      ...validated,
      updatedBy: session.user.id,
      updatedAt: new Date()
    }
  })
  
  // Create update history records
  await db.entryUpdateHistory.createMany({
    data: changes.map(change => ({
      entryId: id,
      fieldName: change.field,
      oldValue: String(change.oldValue ?? ""),
      newValue: String(change.newValue ?? ""),
      updatedBy: session.user.id,
      reason: validated.updateReason
    }))
  })
  
  return NextResponse.json(updatedEntry, { status: 200 })
}
```

### 7.3 Body Fat Calculation API

```typescript
// POST /api/entries/calculate-body-fat
export async function POST(req: NextRequest) {
  const session = await auth()
  const { weight, height, waist, neck, hips, gender, age } = await req.json()
  
  const userPrefs = await db.userPreference.findUnique({
    where: { userId: session.user.id }
  })
  
  const algorithm = userPrefs?.bodyFatAlgorithm || "us_navy"
  
  let bodyFat: number
  
  if (algorithm === "bmi") {
    // BMI Method: requires weight, height, age, gender
    if (!weight || !height || !age || !gender) {
      return NextResponse.json(
        { error: "Weight, height, age, and gender required for BMI method" },
        { status: 400 }
      )
    }
    bodyFat = calculateBodyFatBMI(weight, height, age, gender)
  } else {
    // U.S. Navy Method: requires height, waist, neck, gender (hips if female)
    if (!height || !waist || !neck || !gender) {
      return NextResponse.json(
        { error: "Height, waist, neck, and gender required for U.S. Navy method" },
        { status: 400 }
      )
    }
    if (gender === "female" && !hips) {
      return NextResponse.json(
        { error: "Hips measurement required for female U.S. Navy calculation" },
        { status: 400 }
      )
    }
    bodyFat = calculateBodyFatUSNavy(gender, height, waist, neck, hips)
  }
  
  return NextResponse.json({ bodyFat: Math.round(bodyFat * 100) / 100 }, { status: 200 })
}
```

---

## 9. Frontend Enhancements

### 8.1 Enhanced Entry Form

```tsx
// Enhanced client-dashboard/page.tsx entry form section

<div className="space-y-5">
  {/* Core Fields */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <MeasurementField
      label="Weight"
      value={formData.weightLbs}
      onChange={(v) => setFormData({...formData, weightLbs: v})}
      unit={userPrefs?.weightUnit || "lbs"}
      required={cohortConfig?.requireWeight}
      placeholder="0.0"
    />
    
    <MeasurementField
      label="Steps"
      value={formData.steps}
      onChange={(v) => setFormData({...formData, steps: v})}
      unit="steps"
      required={cohortConfig?.requireSteps}
      placeholder="0"
    />
    
    <MeasurementField
      label="Calories"
      value={formData.calories}
      onChange={(v) => setFormData({...formData, calories: v})}
      unit="kcal"
      required={cohortConfig?.requireCalories}
      placeholder="0"
    />
  </div>
  
  {/* Additional Measurements (Collapsible) */}
  {cohortConfig && (
    <Collapsible>
      <CollapsibleTrigger>
        Additional Measurements {expanded ? "▼" : "▶"}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {cohortConfig.enableNeck && (
            <MeasurementField
              label="Neck"
              value={formData.neck}
              onChange={(v) => setFormData({...formData, neck: v})}
              unit={userPrefs?.measurementUnit || "inches"}
            />
          )}
          {/* ... other additional fields */}
        </div>
        
        {/* Body Fat Calculation */}
        {cohortConfig.enableBodyFat && (
          <div className="mt-4">
            <div className="flex gap-2">
              <MeasurementField
                label="Body Fat %"
                value={formData.bodyFatPercentage}
                onChange={(v) => setFormData({...formData, bodyFatPercentage: v})}
                unit="%"
              />
              <Button
                type="button"
                onClick={handleCalculateBodyFat}
                variant="outline"
              >
                Calculate
              </Button>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )}
  
  {/* Custom Fields (Dynamic) */}
  {customFields.length > 0 && (
    <div className="space-y-4 mt-4">
      <h3 className="font-medium">Additional Information</h3>
      {customFields.map((field) => (
        <CustomFieldInput
          key={field.id}
          field={field}
          value={formData.customValues[field.id]}
          onChange={(v) => setFormData({
            ...formData,
            customValues: {...formData.customValues, [field.id]: v}
          })}
          required={field.required}
        />
      ))}
    </div>
  )}
  
  {/* Notes */}
  <div>
    <Label>Notes (Optional)</Label>
    <Textarea
      value={formData.notes}
      onChange={(e) => setFormData({...formData, notes: e.target.value})}
      placeholder="Add any notes about today's entry..."
      rows={3}
    />
  </div>
</div>
```

### 8.2 Enhanced Date Navigation

```tsx
// Enhanced date picker with calendar view
<div className="flex items-center gap-2">
  <Button
    variant="outline"
    size="icon"
    onClick={handlePreviousDay}
  >
    <ChevronLeft />
  </Button>
  
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline">
        <CalendarIcon className="mr-2 h-4 w-4" />
        {format(selectedDate, "PPP")}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={handleDateSelect}
        modifiers={{
          hasEntry: (date) => entries.some(e => 
            format(new Date(e.date), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
          )
        }}
        modifiersClassNames={{
          hasEntry: "bg-blue-100 font-semibold"
        }}
        disabled={(date) => date > new Date()}
      />
    </PopoverContent>
  </Popover>
  
  <Button
    variant="outline"
    size="icon"
    onClick={handleNextDay}
    disabled={isToday(selectedDate)}
  >
    <ChevronRight />
  </Button>
</div>
```

---

## 10. Migration Strategy

### 9.1 Database Migrations

**Phase 1: User Preferences and Unit Conversion**
```sql
-- Create UserPreference table
CREATE TABLE "UserPreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "weightUnit" TEXT NOT NULL DEFAULT 'lbs',
  "measurementUnit" TEXT NOT NULL DEFAULT 'inches',
  "bodyFatAlgorithm" TEXT NOT NULL DEFAULT 'us_navy',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Make Entry fields nullable (gradual migration)
ALTER TABLE "Entry" 
  ALTER COLUMN "weightLbs" DROP NOT NULL,
  ALTER COLUMN "steps" DROP NOT NULL,
  ALTER COLUMN "calories" DROP NOT NULL;

-- Add new optional fields
ALTER TABLE "Entry" 
  ADD COLUMN "neckInches" DOUBLE PRECISION,
  ADD COLUMN "waistInches" DOUBLE PRECISION,
  ADD COLUMN "hipsInches" DOUBLE PRECISION,
  ADD COLUMN "heightInches" DOUBLE PRECISION,
  ADD COLUMN "bodyFatPercentage" DOUBLE PRECISION,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3),
  ADD COLUMN "updatedBy" TEXT;

-- Add validation constraint: at least one field must be non-null
ALTER TABLE "Entry" 
  ADD CONSTRAINT "entry_has_at_least_one_measurement" 
  CHECK (
    "weightLbs" IS NOT NULL OR 
    "steps" IS NOT NULL OR 
    "calories" IS NOT NULL OR
    "neckInches" IS NOT NULL OR
    "waistInches" IS NOT NULL OR
    "hipsInches" IS NOT NULL OR
    "heightInches" IS NOT NULL OR
    "bodyFatPercentage" IS NOT NULL
  );
```

**Phase 2: Cohort Configuration**
```sql
-- Create CohortConfig table
CREATE TABLE "CohortConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cohortId" TEXT NOT NULL UNIQUE,
  "requireWeight" BOOLEAN NOT NULL DEFAULT true,
  "requireSteps" BOOLEAN NOT NULL DEFAULT true,
  "requireCalories" BOOLEAN NOT NULL DEFAULT true,
  "enableNeck" BOOLEAN NOT NULL DEFAULT false,
  "enableWaist" BOOLEAN NOT NULL DEFAULT false,
  "enableHips" BOOLEAN NOT NULL DEFAULT false,
  "enableHeight" BOOLEAN NOT NULL DEFAULT false,
  "enableBodyFat" BOOLEAN NOT NULL DEFAULT false,
  "allowUpdates" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CohortConfig_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE
);
```

**Phase 3: Custom Fields (if implemented)**
```sql
-- Create CohortCustomField table
CREATE TABLE "CohortCustomField" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cohortId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "fieldType" TEXT NOT NULL,
  "unit" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CohortCustomField_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE
);

-- Create EntryCustomValue table
CREATE TABLE "EntryCustomValue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entryId" TEXT NOT NULL,
  "customFieldId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntryCustomValue_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE,
  CONSTRAINT "EntryCustomValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "CohortCustomField"("id") ON DELETE CASCADE,
  CONSTRAINT "EntryCustomValue_entryId_customFieldId_key" UNIQUE ("entryId", "customFieldId")
);
```

### 9.2 Data Migration

**Existing Entries:**
- All existing entries remain valid (fields are now nullable)
- No data loss (existing values preserved)
- Gradual migration: Users can update preferences over time

**User Preferences:**
- Create default UserPreference records for existing users
- Set defaults based on existing data patterns (if any)
- Users can update preferences in settings

**Cohort Configs:**
- Create default CohortConfig for existing cohorts
- Set all standard fields as required initially (maintains current behavior)
- Coaches can adjust settings as needed

---

## 11. Success Metrics

### 10.1 Adoption Metrics

- **Entry Completion Rate:** Percentage of entries with all fields vs. partial entries
- **Custom Field Usage:** Percentage of coaches using custom fields
- **Update Frequency:** If updates enabled, track update rate vs. new entry rate
- **Feature Usage:** Track which optional fields are most commonly used

### 10.2 User Experience Metrics

- **Form Completion Time:** Time to complete entry form (before vs. after)
- **Error Rate:** Validation errors and failed submissions
- **User Satisfaction:** Survey or feedback on new features
- **Coach Satisfaction:** Feedback from coaches on enhanced data collection

### 10.3 Technical Metrics

- **API Response Time:** Impact of new features on API performance
- **Database Query Performance:** Query time for enhanced analytics
- **Frontend Bundle Size:** Impact of new components on bundle size
- **Migration Success Rate:** Percentage of successful data migrations

---

## 12. Risks and Mitigation

### 11.1 Data Integrity Risks

**Risk:** Making fields optional could lead to incomplete data
**Mitigation:**
- Cohort config allows coaches to require specific fields
- Validation ensures at least one field is provided
- Analytics handle null values gracefully

**Risk:** Unit conversion could introduce calculation errors
**Mitigation:**
- Store in canonical units, convert only for display
- Use well-tested conversion formulas
- Add unit conversion tests

### 11.2 Performance Risks

**Risk:** Custom fields could slow down queries
**Mitigation:**
- Index custom field lookups
- Use efficient joins in queries
- Consider caching for cohort configs

**Risk:** Audit trail could create large update history tables
**Mitigation:**
- Archive old update history records
- Use time-based partitioning
- Limit update history retention period

### 11.3 User Experience Risks

**Risk:** Too many optional fields could overwhelm users
**Mitigation:**
- Coach controls which fields are visible
- Collapsible sections for additional measurements
- Progressive disclosure (show advanced options only if needed)

**Risk:** Unit conversion could confuse users
**Mitigation:**
- Clear unit labels in UI
- Consistent unit display throughout
- Easy unit preference changes

---

## 13. Conclusion

The enhancement proposal extracts the best features from Hitsona's CheckIn functionality while maintaining the core coach-client relationship model and accountability focus of the CoachSync/Web application. The proposed enhancements add flexibility and user-friendliness without compromising the structured, coach-managed approach.

**Key Recommendations:**

1. **High Priority:** Unit conversion, optional fields, notes field, additional measurements
2. **Medium Priority:** Body fat calculation, coach-defined custom fields, calendar navigation
3. **Low Priority:** Mood tracking (may not align with core focus)
4. **Design Decision:** Allow entry updates with audit trail (improves UX while maintaining accountability)

**Implementation Strategy:**
- Phased approach (4 phases over 8 weeks)
- Maintain backward compatibility
- Gradual rollout with feature flags
- Monitor metrics and adjust based on usage

**Success Criteria:**
- Increased entry completion rates
- Improved user satisfaction
- Enhanced coach analytics capabilities
- Maintained data integrity and accountability

---

## 14. Onboarding System Evaluation and Proposal

### 13.1 Hitsona Onboarding Model Analysis

#### 13.1.1 Onboarding Flow Overview

**Hitsona Implementation:**
- **Location:** `SparkyFitnessFrontend/src/components/Onboarding/OnBoarding.tsx`
- **Steps:** 10-step wizard with progress indicator
- **Trigger:** Checks onboarding status on login, shows wizard if incomplete
- **Storage:** Two tables - `onboarding_status` and `onboarding_data`
- **Integration:** Updates user profile, creates initial check-in entry, calculates and saves goals

#### 13.1.2 Onboarding Steps (Hitsona)

| Step | Question | Data Collected | Purpose |
|------|----------|----------------|---------|
| 1 | Sex/Gender | `sex` (male/female) | BMR calculation |
| 2 | Primary Goal | `primaryGoal` (lose/maintain/gain_weight) | Calorie target calculation |
| 3 | Current Weight | `currentWeight` (numeric) | Baseline measurement, BMR |
| 4 | Height | `height` (numeric) | Baseline measurement, BMR |
| 5 | Birth Date | `birthDate` (date) | Age calculation, BMR |
| 6 | Body Fat Range | `bodyFatRange` (estimation) | Optional reference |
| 7 | Target Weight | `targetWeight` (numeric) | Goal setting |
| 8 | Meals Per Day | `mealsPerDay` (3-6) | Meal distribution planning |
| 9 | Activity Level | `activityLevel` (not_much/light/moderate/heavy) | TDEE calculation |
| 10 | Add Burned Calories? | `addBurnedCalories` (boolean) | Calorie budget adjustment |
| 11 | Processing | - | Calculates plan (auto-advances) |
| 12 | Personal Plan Review | - | Review/edit calculated goals |

**Additional Features:**
- Unit selection (weight: kg/lbs, height: cm/inches) during onboarding
- Energy unit selection (kcal/kJ) during onboarding
- Date format selection during onboarding
- Algorithm selection (fat breakdown, minerals, vitamins, sugar)
- Diet template selection (Standard, Keto, Low-Carb, etc.)
- Custom macro percentage adjustment
- Water goal calculation (weight × 35ml)
- Meal calorie distribution planning

#### 13.1.3 Post-Onboarding Actions (Hitsona)

After completing onboarding, the system:

1. **Updates User Profile:**
   - Saves `gender` and `date_of_birth` to user profile table
   - Used for future BMR/calculation needs

2. **Creates Initial Check-In Entry:**
   - Creates entry for today's date
   - Saves `weight` and `height` as baseline measurements
   - Stored in canonical units (kg, cm)

3. **Calculates and Saves Goals:**
   - Calculates BMR using Mifflin-St Jeor formula
   - Calculates TDEE based on activity level
   - Adjusts calories based on primary goal (lose: -20%, gain: +500)
   - Calculates macros based on selected diet template
   - Calculates advanced nutrients (vitamins, minerals, etc.)
   - Saves goals for today (can cascade for 6 months)
   - Creates goal preset if user chooses to save

4. **Saves User Preferences:**
   - Weight unit (kg/lbs)
   - Measurement unit (cm/inches)
   - Energy unit (kcal/kJ)
   - Date format
   - Selected algorithms for nutrient calculations
   - Diet template selection

#### 13.1.4 Database Schema (Hitsona)

**onboarding_status table:**
```sql
CREATE TABLE onboarding_status (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id),
  full_name TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**onboarding_data table:**
```sql
CREATE TABLE onboarding_data (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id),
  sex VARCHAR(10),
  primary_goal VARCHAR(20),
  current_weight NUMERIC(5, 2),
  height NUMERIC(5, 2),
  birth_date DATE,
  body_fat_range VARCHAR(20),
  target_weight NUMERIC(5, 2),
  meals_per_day INTEGER,
  activity_level VARCHAR(20),
  add_burned_calories BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Features:**
- Auto-creates onboarding_status record on user creation (database trigger)
- Transactional save (onboarding_data + status update in single transaction)
- Can reset onboarding status to allow re-completion

### 13.2 Current CoachSync/Web Signup Flow

#### 13.2.1 Current Implementation

**Location:** `app/signup/page.tsx`

**Current Flow:**
1. User fills form: email, password, confirm password, name (optional)
2. POST to `/api/auth/signup`
3. Creates User with `Role.CLIENT`
4. Auto-login via NextAuth
5. Redirects to `/dashboard`

**Data Collected:**
- Email (required)
- Password (required, min 8 chars)
- Name (optional)

**Missing:**
- No onboarding flow
- No baseline measurements collected
- No user profile data (age, gender, height)
- No initial entry created
- No goal calculation
- No preference setup

#### 13.2.2 Current User Model (CoachSync/Web)

```prisma
model User {
  id               String    @id @default(uuid())
  email            String    @unique
  name             String?   // Only optional name
  image            String?
  passwordHash     String?
  roles            Role[]    @default([CLIENT])
  // ... no profile data (age, gender, height, etc.)
}
```

**Gaps:**
- No user profile table for demographic data
- No onboarding tracking
- No initial measurements
- No preferences system

### 13.3 Proposed Onboarding Model for CoachSync/Web

#### 13.3.1 Design Philosophy

**Coach-Client Model Considerations:**
1. **Pre-Coach Onboarding:** Collect baseline data BEFORE coach assignment
   - Client signs up → Onboarding → Coach adds to cohort
   - Coach can view onboarding data before accepting client
   - Creates initial baseline for program tracking

2. **Program Integration:**
   - Onboarding data ties to program model (6-week or custom weeks)
   - Baseline measurements establish starting point
   - Program duration affects goal calculations

3. **Simplified vs. Comprehensive:**
   - Balance: Collect enough data for program tracking without overwhelming
   - Coach-specific fields can be added later when assigned to cohort
   - Focus on essential baseline measurements

#### 13.3.2 Proposed Onboarding Steps (Simplified)

**CoachSync-Adapted 6-Step Onboarding:**

| Step | Question | Data Collected | Coach-Client Context |
|------|----------|----------------|---------------------|
| 1 | **Welcome & Introduction** | - | Explain program-based model, coach will review data |
| 2 | **Gender** | `gender` (male/female/other) | For program calculations (if applicable) |
| 3 | **Date of Birth** | `dateOfBirth` (date) | Age calculation, program eligibility |
| 4 | **Current Weight** | `currentWeight` (numeric, lbs or kg) | **Baseline measurement - creates initial entry** |
| 5 | **Height** | `height` (numeric, inches or cm) | **Baseline measurement - creates initial entry** |
| 6 | **Unit Preferences** | `weightUnit`, `measurementUnit` | User preference for display |

**Simplified from Hitsona:**
- ❌ Removed: Primary goal (coach sets program goals)
- ❌ Removed: Target weight (coach sets program targets)
- ❌ Removed: Activity level (coach assesses in program)
- ❌ Removed: Meals per day (coach sets nutrition plan)
- ❌ Removed: Body fat calculation (can add later if needed)
- ❌ Removed: Calorie/macro goals (coach sets program goals)
- ✅ Kept: Essential baseline data (gender, age, weight, height)
- ✅ Added: Unit preferences (critical for coach-client communication)

#### 13.3.3 Program Model Integration

**Program Structure:**
- **Program Duration:** 6-week standard or custom weeks (coach-defined)
- **Program Start Date:** Set when coach adds client to cohort
- **Program End Date:** Calculated from start date + duration
- **Baseline Entry:** Created during onboarding (before program start)
- **Program Tracking:** Entries track progress against baseline

**Onboarding → Program Flow:**
1. Client completes onboarding → Baseline data collected
2. Coach reviews onboarding data → Decides to add client to cohort
3. Coach creates/assigns program → Sets program duration (6-week or custom)
4. Program start date set → Client begins logging entries
5. Progress tracked → Against baseline from onboarding

#### 13.3.4 Proposed Database Schema

**User Profile Enhancement:**
```prisma
model UserProfile {
  id          String   @id @default(uuid())
  userId      String   @unique
  gender      String?  // "male" | "female" | "other"
  dateOfBirth DateTime? @db.Date
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model OnboardingStatus {
  id                String   @id @default(uuid())
  userId            String   @unique
  onboardingComplete Boolean  @default(false)
  completedAt       DateTime?
  skipped           Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model OnboardingData {
  id          String   @id @default(uuid())
  userId      String   @unique
  gender      String?  // From onboarding step
  dateOfBirth DateTime? @db.Date
  currentWeight Float?  // Baseline weight (stored in lbs, canonical)
  height      Float?  // Baseline height (stored in inches, canonical)
  // Note: Weight and height also saved as initial Entry
  createdAt   DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Enhance User model
model User {
  // ... existing fields
  profile           UserProfile?
  onboardingStatus  OnboardingStatus?
  onboardingData    OnboardingData?
}

// Enhance Entry model to link to program
model Entry {
  // ... existing fields
  programId      String? // Optional: link entry to program
  isBaseline     Boolean @default(false) // Mark baseline entry from onboarding
}
```

**Program Model (New):**
```prisma
model Program {
  id          String   @id @default(uuid())
  cohortId    String   // Program belongs to cohort
  name        String   // e.g., "6-Week Transformation", "12-Week Strength Builder"
  durationWeeks Int    // 6 (standard) or custom number
  startDate   DateTime @db.Date
  endDate     DateTime @db.Date // Calculated: startDate + (durationWeeks * 7 days)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  cohort  Cohort          @relation(fields: [cohortId], references: [id], onDelete: Cascade)
  entries Entry[]         // Entries linked to this program
  clients ProgramClient[] // Clients in this program
}

model ProgramClient {
  id            String   @id @default(uuid())
  programId     String
  userId        String
  enrolledDate  DateTime @db.Date
  completedDate DateTime? @db.Date
  status        String   @default("active") // "active" | "completed" | "cancelled"
  
  program Program @relation(fields: [programId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([programId, userId])
}
```

#### 13.3.5 Onboarding Flow Design

**Phase 1: Post-Signup Onboarding (Before Coach Assignment)**

1. **User Signs Up:**
   - Standard signup: email, password, name
   - User created with `Role.CLIENT`
   - Auto-login via NextAuth

2. **Onboarding Check:**
   - Redirect to `/onboarding` instead of `/dashboard`
   - Check `OnboardingStatus` - if incomplete, show wizard
   - If complete, redirect to `/client-dashboard`

3. **Onboarding Wizard (6 Steps):**
   - **Step 1: Welcome**
     - Explains program-based model
     - Mentions coach will review data
     - Sets expectations
   
   - **Step 2: Gender**
     - Options: Male, Female, Other, Prefer not to say
     - Optional but recommended
     - Used for calculations if applicable
   
   - **Step 3: Date of Birth**
     - Date picker (past dates only)
     - Optional but recommended
     - Used for age calculation
   
   - **Step 4: Current Weight**
     - Large numeric input
     - Unit toggle: lbs ↔ kg
     - **Critical:** This becomes baseline entry
     - Stored in canonical unit (lbs) with conversion
   
   - **Step 5: Height**
     - Large numeric input
     - Unit toggle: inches ↔ cm
     - **Critical:** This becomes baseline entry
     - Stored in canonical unit (inches) with conversion
   
   - **Step 6: Unit Preferences**
     - Weight: lbs or kg
     - Measurements: inches or cm
     - These preferences saved to `UserPreference` (if implemented)
     - Default to US (lbs, inches) if not specified

4. **Onboarding Completion:**
   - Create `OnboardingData` record
   - Update `OnboardingStatus` to complete
   - Create baseline `Entry`:
     - Date: Today's date
     - Weight: From onboarding (converted to lbs)
     - Height: From onboarding (converted to inches)
     - Steps: NULL (not collected)
     - Calories: NULL (not collected)
     - Marked with `isBaseline: true`
   - Update `UserProfile` (if gender/DOB provided)
   - Redirect to `/client-dashboard`

**Phase 2: Coach Review (After Onboarding, Before Program)**

1. **Coach Views Client Onboarding Data:**
   - Coach dashboard shows pending clients (invited but not yet in cohort)
   - Coach can view onboarding data before adding to cohort
   - Onboarding data helps coach:
     - Understand client baseline
     - Determine appropriate program duration
     - Set realistic goals

2. **Coach Creates/Assigns Program:**
   - Coach creates cohort (if needed)
   - Coach adds client to cohort
   - Coach creates program:
     - Selects duration: 6-week standard OR custom weeks
     - Sets program name
     - Start date (typically today or cohort start)
     - End date (calculated automatically)
   - Client linked to program via `ProgramClient`

**Phase 3: Program Tracking (During Program)**

1. **Baseline Entry:**
   - Onboarding creates baseline entry with `isBaseline: true`
   - Entry date = onboarding completion date
   - Weight and height from onboarding

2. **Progress Entries:**
   - Client logs daily entries during program
   - Entries can be linked to program (optional `programId`)
   - Progress measured against baseline entry

3. **Program Analytics:**
   - Coach can view:
     - Baseline vs. current measurements
     - Progress over program duration
     - Weight change from baseline
     - Program completion status

#### 13.3.6 Proposed API Endpoints

**Onboarding Endpoints:**

```typescript
// GET /api/onboarding/status
// Check if onboarding is complete
// Returns: { onboardingComplete: boolean, skipped: boolean }

// POST /api/onboarding
// Submit onboarding data
// Body: {
//   gender?: string,
//   dateOfBirth?: string, // ISO date
//   currentWeight: number,
//   height: number,
//   weightUnit: "lbs" | "kg",
//   measurementUnit: "inches" | "cm"
// }
// Creates: OnboardingData, OnboardingStatus, baseline Entry, UserProfile

// PUT /api/onboarding/skip
// Skip onboarding (optional - allows client to proceed without data)

// GET /api/onboarding/data (Coach only)
// Get client's onboarding data (for coach review)
// Requires: Client must be invited by coach (not yet in cohort)
```

**Program Endpoints (New):**

```typescript
// POST /api/programs
// Create program for cohort
// Body: {
//   cohortId: string,
//   name: string,
//   durationWeeks: number, // 6 or custom
//   startDate: string // ISO date
// }
// Returns: Program with calculated endDate

// GET /api/programs/cohort/:cohortId
// Get programs for cohort

// GET /api/programs/:id
// Get program details with clients and entries

// POST /api/programs/:programId/clients
// Add client to program
// Body: { userId: string }
```

#### 13.3.7 Frontend Implementation

**Onboarding Component Structure:**

```tsx
// app/onboarding/page.tsx
"use client"

export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    gender: "",
    dateOfBirth: "",
    currentWeight: "",
    height: "",
    weightUnit: "lbs", // Default to lbs
    measurementUnit: "inches" // Default to inches
  })

  // Check if already completed
  useEffect(() => {
    checkOnboardingStatus()
  }, [])

  const handleSubmit = async () => {
    // Convert to canonical units
    const weightLbs = formData.weightUnit === "lbs" 
      ? parseFloat(formData.currentWeight)
      : parseFloat(formData.currentWeight) * 2.20462
    
    const heightInches = formData.measurementUnit === "inches"
      ? parseFloat(formData.height)
      : parseFloat(formData.height) / 2.54

    // Create onboarding data
    await fetch("/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        gender: formData.gender || null,
        dateOfBirth: formData.dateOfBirth || null,
        currentWeight: weightLbs,
        height: heightInches,
        weightUnit: formData.weightUnit,
        measurementUnit: formData.measurementUnit
      })
    })

    // Redirect to dashboard
    router.push("/client-dashboard")
  }

  // Render steps...
}
```

**Onboarding Steps UI:**

- **Progress Indicator:** Top bar showing step X of 6
- **Back/Next Navigation:** Previous button, Continue button
- **Skip Option:** "Skip for now" button (optional, allows partial onboarding)
- **Unit Toggle:** Prominent unit selection for weight/height
- **Large Input Fields:** Easy-to-use number inputs (similar to Hitsona)
- **Visual Design:** Clean, focused, matches CoachSync aesthetic

**Integration with Signup:**

```typescript
// app/signup/page.tsx (modified)
// After successful signup:
router.push("/onboarding") // Instead of "/dashboard"

// app/client-dashboard/page.tsx (modified)
// On mount, check onboarding status:
useEffect(() => {
  const checkOnboarding = async () => {
    const res = await fetch("/api/onboarding/status")
    const { onboardingComplete } = await res.json()
    if (!onboardingComplete) {
      router.push("/onboarding")
    }
  }
  checkOnboarding()
}, [])
```

#### 13.3.8 Coach Dashboard Integration

**Coach View - Client Onboarding Data:**

```tsx
// app/coach-dashboard/page.tsx
// Show pending clients with onboarding data

<PendingClientsSection>
  {pendingClients.map(client => (
    <ClientCard>
      <ClientInfo name={client.name} email={client.email} />
      <OnboardingPreview>
        {client.onboardingData ? (
          <>
            <Stat label="Weight" value={client.onboardingData.currentWeight} unit="lbs" />
            <Stat label="Height" value={client.onboardingData.height} unit="inches" />
            <Stat label="Age" value={calculateAge(client.onboardingData.dateOfBirth)} />
            <Button onClick={() => viewFullOnboarding(client.id)}>
              View Full Details
            </Button>
          </>
        ) : (
          <p>No onboarding data yet</p>
        )}
      </OnboardingPreview>
      <Actions>
        <Button onClick={() => addToCohort(client.id)}>
          Add to Cohort
        </Button>
      </Actions>
    </ClientCard>
  ))}
</PendingClientsSection>
```

**Coach View - Create Program:**

```tsx
// When adding client to cohort, coach can create program
<ProgramCreation>
  <Input label="Program Name" value={programName} />
  <Select label="Duration">
    <Option value={6}>6 Weeks (Standard)</Option>
    <Option value="custom">Custom Weeks</Option>
  </Select>
  {durationType === "custom" && (
    <Input type="number" label="Number of Weeks" value={customWeeks} />
  )}
  <DatePicker label="Start Date" value={startDate} />
  <Button onClick={createProgram}>Create Program</Button>
</ProgramCreation>
```

### 13.4 Implementation Roadmap

#### 13.4.1 Phase 1: Core Onboarding Infrastructure (Week 1)

**Database Schema:**
- [ ] Create `UserProfile` model
- [ ] Create `OnboardingStatus` model
- [ ] Create `OnboardingData` model
- [ ] Add `isBaseline` flag to `Entry` model
- [ ] Add `profile`, `onboardingStatus`, `onboardingData` relations to User

**API Endpoints:**
- [ ] `GET /api/onboarding/status` - Check completion status
- [ ] `POST /api/onboarding` - Submit onboarding data
- [ ] `PUT /api/onboarding/skip` - Skip onboarding (optional)
- [ ] Update signup flow to redirect to onboarding

**Frontend:**
- [ ] Create `/onboarding` page
- [ ] Implement 6-step wizard component
- [ ] Add progress indicator
- [ ] Add unit toggle components
- [ ] Handle form submission and redirect

#### 13.4.2 Phase 2: Baseline Entry Creation (Week 1)

**Post-Onboarding Actions:**
- [ ] Auto-create baseline Entry on onboarding completion
- [ ] Convert units to canonical (lbs, inches)
- [ ] Mark entry with `isBaseline: true`
- [ ] Create UserProfile if gender/DOB provided
- [ ] Update OnboardingStatus to complete

**Validation:**
- [ ] Ensure weight and height are provided (required)
- [ ] Validate date of birth (past dates only)
- [ ] Handle unit conversion correctly

#### 13.4.3 Phase 3: Coach Review Integration (Week 2)

**Coach Dashboard:**
- [ ] Show pending clients with onboarding data
- [ ] Display onboarding preview (weight, height, age)
- [ ] Add "View Full Onboarding" modal/page
- [ ] Integrate with cohort assignment flow

**API Endpoints:**
- [ ] `GET /api/clients/pending` - Get clients invited but not in cohort
- [ ] `GET /api/clients/:id/onboarding` - Get full onboarding data (coach only)
- [ ] Verify authorization (coach must have invited client)

#### 13.4.4 Phase 4: Program Model Integration (Week 2-3)

**Database Schema:**
- [ ] Create `Program` model
- [ ] Create `ProgramClient` model
- [ ] Add `programId` to Entry model (nullable)
- [ ] Add relations to Cohort

**Program Management:**
- [ ] Coach creates program when adding client to cohort
- [ ] Program duration: 6-week default or custom
- [ ] Auto-calculate end date from duration
- [ ] Link entries to program (optional)

**Frontend:**
- [ ] Program creation UI for coaches
- [ ] Program selection when adding client to cohort
- [ ] Display program info in client dashboard
- [ ] Show program progress (days remaining, completion %)

#### 13.4.5 Phase 5: Analytics Integration (Week 3)

**Baseline Comparisons:**
- [ ] Compare current entries to baseline entry
- [ ] Calculate weight change from baseline
- [ ] Show progress over program duration
- [ ] Display baseline vs. current in coach analytics

**Program Analytics:**
- [ ] Program completion percentage
- [ ] Days remaining in program
- [ ] Average progress per week
- [ ] Program goal achievement (if goals feature added)

### 13.5 Key Design Decisions

#### 13.5.1 Simplified Onboarding

**Rationale:**
- Coach-client model: Coach sets goals and plans
- Avoid duplicate data collection (coach can collect more detailed info later)
- Focus on essential baseline measurements
- Reduce friction for new users

**Removed from Hitsona:**
- ❌ Primary goal (coach sets program goals)
- ❌ Target weight (coach sets program targets)
- ❌ Activity level (coach assesses during consultation)
- ❌ Meals per day (coach creates nutrition plan)
- ❌ Body fat calculation (can add later if needed)
- ❌ Calorie/macro goal calculation (coach sets program goals)

**Kept from Hitsona:**
- ✅ Gender (useful for calculations)
- ✅ Date of birth (age calculation)
- ✅ Current weight (critical baseline)
- ✅ Height (critical baseline)
- ✅ Unit preferences (essential for communication)

#### 13.5.2 Baseline Entry Creation

**Why Create Entry During Onboarding:**
- Establishes starting point for program tracking
- Coach can see baseline immediately
- Progress calculations have reference point
- Client already has entry history when program starts

**Implementation:**
```typescript
// After onboarding submission
const baselineEntry = await db.entry.create({
  data: {
    userId: session.user.id,
    date: new Date(), // Today's date
    weightLbs: convertedWeight, // From onboarding
    heightInches: convertedHeight, // From onboarding
    steps: null, // Not collected during onboarding
    calories: null, // Not collected during onboarding
    isBaseline: true, // Mark as baseline
    notes: "Baseline measurement from onboarding"
  }
})
```

#### 13.5.3 Program Model Structure

**6-Week vs. Custom Weeks:**

```typescript
// Program creation
const program = await db.program.create({
  data: {
    cohortId: cohort.id,
    name: "6-Week Transformation", // or custom name
    durationWeeks: 6, // Standard or custom number
    startDate: new Date(),
    endDate: addWeeks(new Date(), 6), // Calculated
    isActive: true
  }
})
```

**Benefits:**
- Flexible duration (coach can set custom weeks)
- Standard 6-week option (common program length)
- Clear start/end dates for program tracking
- Multiple programs per cohort (if needed)

#### 13.5.4 Coach Review Before Assignment

**Flow:**
1. Client completes onboarding → Data saved, baseline entry created
2. Coach invites client → Client appears in "Pending Clients"
3. Coach reviews onboarding data → Sees baseline measurements
4. Coach creates/assigns program → Sets duration, start date
5. Coach adds client to cohort → Client can now log entries

**Benefits:**
- Coach informed decision-making
- Coach can customize program based on baseline
- Coach can reject client if not suitable (edge case)
- Clear separation: onboarding (client) vs. program (coach)

### 13.6 Migration Strategy

#### 13.6.1 Existing Users

**For Existing Clients (Already Signed Up):**
- Check if user has any entries
- If has entries: Use first entry as baseline (mark as baseline retroactively)
- If no entries: Show onboarding wizard on next login
- Allow existing users to complete onboarding (optional)

**Migration Script:**
```typescript
// scripts/migrate-existing-users.ts
async function migrateExistingUsers() {
  const users = await db.user.findMany({
    where: { roles: { has: Role.CLIENT } }
  })

  for (const user of users) {
    // Create onboarding status (incomplete)
    await db.onboardingStatus.create({
      data: {
        userId: user.id,
        onboardingComplete: false
      }
    })

    // Check for first entry to use as baseline
    const firstEntry = await db.entry.findFirst({
      where: { userId: user.id },
      orderBy: { date: "asc" }
    })

    if (firstEntry) {
      // Mark first entry as baseline
      await db.entry.update({
        where: { id: firstEntry.id },
        data: { isBaseline: true }
      })

      // Create onboarding data from first entry (if possible)
      // Note: May not have all data, but can capture what exists
    }
  }
}
```

#### 13.6.2 New Users

**For New Signups:**
- Create `OnboardingStatus` record with `onboardingComplete: false`
- Trigger onboarding wizard on first login
- Require onboarding completion before accessing dashboard
- Allow skip (optional - creates incomplete onboarding status)

### 13.7 UI/UX Considerations

#### 13.7.1 Onboarding Experience

**Design Principles:**
- **Simple & Fast:** 6 steps, not 10
- **Focused:** Only essential baseline data
- **Clear:** Explain why data is needed (coach will review)
- **Forgiving:** Allow skip (with warning about missing baseline)
- **Professional:** Match CoachSync design aesthetic

**Visual Design:**
- Clean, minimal interface (not black like Hitsona)
- Progress indicator at top
- Large, easy-to-use inputs
- Prominent unit toggles
- Smooth transitions between steps

**Mobile-Friendly:**
- Responsive design for all screen sizes
- Touch-friendly input fields
- Easy navigation (back/next buttons)

#### 13.7.2 Coach Review Experience

**Coach Dashboard Enhancements:**
- **Pending Clients Section:**
  - List of clients who completed onboarding but not yet in cohort
  - Show onboarding summary (weight, height, age)
  - Quick actions: View details, Add to cohort, Reject

- **Onboarding Detail View:**
  - Full onboarding data display
  - Baseline entry preview
  - Program creation form
  - Add to cohort action

**Integration Points:**
- Seamless flow: Review → Create Program → Add to Cohort
- Program creation can be part of cohort assignment
- Default to 6-week program with option to customize

### 13.8 Success Metrics

#### 13.8.1 Onboarding Completion

- **Completion Rate:** Percentage of users who complete onboarding
- **Skip Rate:** Percentage of users who skip onboarding
- **Completion Time:** Average time to complete onboarding
- **Drop-off Points:** Which steps have highest abandonment

#### 13.8.2 Coach Adoption

- **Review Rate:** Percentage of coaches who review onboarding data
- **Program Creation Rate:** Percentage of coaches who create programs
- **6-Week vs. Custom:** Usage split between standard and custom durations
- **Time to Assignment:** Average time from onboarding to cohort assignment

#### 13.8.3 Program Tracking

- **Baseline Utilization:** Percentage of programs that reference baseline entry
- **Entry Completion:** Entry logging rate during program
- **Program Completion:** Percentage of clients who complete full program
- **Progress Tracking:** Usage of baseline comparisons in analytics

### 13.9 Risks and Mitigation

#### 13.9.1 Onboarding Friction

**Risk:** Too many steps could reduce signup completion
**Mitigation:**
- Keep to 6 essential steps
- Allow skip option (with clear trade-offs)
- Make unit selection intuitive
- Provide clear value proposition (coach will use this data)

#### 13.9.2 Data Quality

**Risk:** Users enter inaccurate baseline data
**Mitigation:**
- Coach can verify/review onboarding data
- Coach can update baseline entry if needed
- Allow baseline entry updates (with coach approval)
- Clear instructions on how to measure

#### 13.9.3 Coach Workflow Integration

**Risk:** Onboarding data not visible to coach when needed
**Mitigation:**
- Prominent display in coach dashboard
- Email notification when client completes onboarding
- Easy access from client detail view
- Integration with cohort assignment flow

#### 13.9.4 Program Model Complexity

**Risk:** Program model adds complexity to simple entry system
**Mitigation:**
- Make program optional (entries work without program)
- Simple defaults (6-week standard)
- Coach controls program creation (not automatic)
- Clear documentation on program vs. entry relationship

### 13.10 Future Enhancements

#### 13.10.1 Enhanced Onboarding (Post-MVP)

**Optional Additions:**
- Activity level (for initial assessment)
- Primary goal (lose/maintain/gain) - coach can override
- Target weight (coach can set program-specific target)
- Body measurements (neck, waist, hips) - coach can collect later
- Photos (before photos for progress tracking)

#### 13.10.2 Program Templates

**Coach-Created Templates:**
- Coaches can create program templates (6-week, 12-week, etc.)
- Templates include default duration, goals, milestones
- Apply template when creating program for client
- Customize template for specific client needs

#### 13.10.3 Goal Setting Integration

**If Goals Feature Added:**
- Onboarding can include initial goal preferences
- Coach can review and adjust goals
- Goals tied to program duration
- Progress tracking against goals

#### 13.10.4 Milestone Tracking

**Program Milestones:**
- Automatic milestones based on program duration (e.g., Week 1, Week 3, Week 6)
- Coach can add custom milestones
- Client can see upcoming milestones
- Celebrate milestone achievements

---

## 15. Complete Implementation Priority Matrix

### Priority 1: Critical Enhancements (MVP)
1. ✅ Unit Conversion System
2. ✅ Optional Fields with Partial Entries
3. ✅ Notes Field
4. ✅ Onboarding System (Baseline Data Collection)
5. ✅ User Profile (gender, dateOfBirth)
6. ✅ Baseline Entry Creation

### Priority 2: High-Value Enhancements
1. ✅ Additional Body Measurements (neck, waist, hips, height)
2. ✅ Body Fat Calculation
3. ✅ Program Model (6-week or custom)
4. ✅ Coach Review of Onboarding Data

### Priority 3: Advanced Features
1. ✅ Coach-Defined Custom Fields
2. ✅ Enhanced Date Navigation
3. ✅ Entry Updates with Audit Trail
4. ✅ Program Analytics

### Priority 4: Nice-to-Have
1. Mood Tracking (if aligns with goals)
2. Enhanced Analytics (cohort comparisons)
3. Program Templates
4. Milestone Tracking

---

**End of Enhancement Proposal**
