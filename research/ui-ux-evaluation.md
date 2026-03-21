# CoachFit UI/UX Evaluation: Class Scheduling, Credits & Challenges

**Date**: 2026-03-21
**Scope**: Comprehensive UI/UX patterns for Hitsona Bangor (2 coaches, ~20-30 members, HIIT + CORE classes)
**Platforms**: iOS app (primary client), Android app, mobile web (PWA), desktop web (coach/admin)
**Reference apps**: ClassPass, Mindbody, F45, Orangetheory, Glofox, TeamUp, Barry's, SoulCycle

---

## Table of Contents

1. [Client Experience (iOS App + Mobile Web)](#1-client-experience)
2. [Coach Experience (Tablet + Desktop, Mobile Secondary)](#2-coach-experience)
3. [Admin Experience (Desktop Web Only)](#3-admin-experience)
4. [Cross-Platform Considerations](#4-cross-platform-considerations)
5. [Design System & Component Patterns](#5-design-system--component-patterns)
6. [Micro-interactions & Animation](#6-micro-interactions--animation)
7. [Accessibility](#7-accessibility)
8. [Loading, Empty & Error States](#8-loading-empty--error-states)

---

## 1. Client Experience

The client is the core user. They book classes, track challenge progress, and manage credits -- overwhelmingly from their phone. Every tap matters. The design philosophy should be: **one-thumb operable, glanceable, and dopamine-aware** (celebrate completions, create gentle urgency for bookings).

### 1.1 Class Schedule View

**Recommendation: Horizontal date strip + vertical time list (the "ClassPass/Barry's hybrid")**

This is the single most important screen in the app. The Hitsona schedule has a very specific shape: 5-7 sessions per day, all 25 minutes, clustered in morning (06:30-10:30), midday (12:30), and evening (17:30). This density is low enough that a full-day list fits on one screen without scrolling on most phones -- a major UX advantage over dense urban studios.

**Date navigation:**
- Top of screen: horizontal scrollable date strip showing 14 days forward (matching the `bookingOpenHoursBefore: 336` / 14-day window).
- Each date pill shows: day abbreviation (Mon), date number (24), and a subtle dot indicator if the user already has a booking on that day.
- Today is pre-selected and visually distinct (filled pill, brand color).
- Swiping the date strip is the primary navigation. No week/month toggle needed -- 14 days is the maximum useful horizon and a strip handles it cleanly.
- Past dates fade but remain tappable to view history ("attended" badges on completed classes).

**Why not a calendar grid?** With only 14 bookable days and 5-7 sessions per day, a monthly calendar wastes space and adds cognitive load. ClassPass, Barry's, and SoulCycle all use the date strip for exactly this reason. Calendar grids work for Mindbody where users browse weeks ahead; here the window is fixed at 14 days.

**Time slot display:**
- Below the date strip: vertical list of class cards for the selected day, ordered chronologically.
- Each card shows:
  - **Left**: Start time in large text (e.g., "06:30"), with "AM"/"PM" in smaller text beside it. Duration shown as a subtle label below: "25 min".
  - **Center**: Class name ("HIIT" or "CORE") with the instructor name below ("Rory S."). Instructor's avatar thumbnail (32px circle) if available, initials fallback if not.
  - **Right**: Availability indicator + action button (see 1.3 below).
- Color coding by class type: Use the existing TeamUp colors as a left-edge accent bar on each card. HIIT = purple (#452ddb), CORE = yellow/gold (#f2de24). This is subtle (4px left border) rather than full card coloring, which becomes garish.

**Grouping by time block:**
- Insert lightweight section dividers: "Morning", "Midday", "Evening". This helps scanning. The Hitsona schedule has natural clusters (06:30-10:30, 12:30, 17:30) that map perfectly to these groups.
- Morning = before 12:00, Midday = 12:00-15:00, Evening = after 15:00.

**What F45 and Orangetheory get right here:** They show the coach photo prominently. With only 2 coaches (Rory and Gav), members will have preferences. Make the instructor identity visible without requiring a tap.

**What SoulCycle gets right:** The "your upcoming booking" sticky card at the top of the schedule. If the user has a booking today, pin it above the schedule list as a highlighted card with a countdown ("Starts in 2h 15m"). This creates anticipation and reduces the "did I book?" anxiety.

### 1.2 Booking Flow

**Recommendation: Tap-to-book with inline confirmation (no separate screen)**

For a 20-30 member studio with simple class types, a multi-step booking wizard is overkill. The gold standard is the **Barry's / SoulCycle single-tap flow** with a brief confirmation moment.

**Flow:**

1. **Tap the class card** on the schedule view.
2. **Bottom sheet slides up** (not a new screen) showing:
   - Class details: name, time, duration, instructor, spots remaining.
   - Credit cost: "1 credit will be deducted" with current balance shown ("You have 7 credits remaining").
   - Cancel policy reminder: "Free cancellation until [time - 2 hours]" in muted text.
   - Large "Book Class" button (primary brand color, full width).
   - "Cancel" text link below to dismiss.
3. **Tap "Book Class":**
   - Button shows a brief loading spinner (300ms minimum to feel intentional).
   - On success: bottom sheet transforms to a success state.

**Success state (critical for satisfaction):**
- Checkmark animation (Lottie or CSS, ~800ms).
- iOS: trigger `UIImpactFeedbackGenerator` medium impact haptic. Android: short vibration pattern.
- Text: "You're booked!" with class summary.
- "Add to Calendar" button (generates .ics or deep-links to native calendar).
- "View My Bookings" text link.
- Auto-dismiss after 3 seconds (with manual dismiss available).

**Credit deduction display:**
- Show the deduction explicitly: "7 credits -> 6 credits" with a brief counter animation.
- If this booking would leave the user with 0 credits, show an amber warning: "This will use your last credit."
- If insufficient credits: replace "Book Class" with "Buy Credits" which navigates to the credit purchase flow.

**Why not skip confirmation entirely?** Accidental bookings in a small studio are socially awkward (the coach sees your name, you don't show up). The bottom sheet adds one tap but prevents mistakes. ClassPass uses this exact pattern. Mindbody's multi-screen flow is too heavy; Glofox's tap-and-done is too light for credit-based systems where money is involved.

### 1.3 Availability & Waitlist

**Recommendation: Numeric spots remaining with urgency color + waitlist position indicator**

**Availability display on class card (right side):**

| State | Display | Color |
|-------|---------|-------|
| 5+ spots | "8 spots" (just the number) | Neutral gray text |
| 3-4 spots | "3 spots left" | Amber/orange text |
| 1-2 spots | "1 spot left!" | Red text, subtle pulse animation on the dot |
| Full, waitlist open | "Waitlist" with queue icon | Muted text, outline button style |
| Full, waitlist full | "Full" | Gray text, card slightly dimmed |

**Why "3 spots left" and not a progress bar?** With capacities of 10-15, a progress bar is visually misleading -- the difference between 8/10 and 10/10 is nearly invisible. Numeric display with color thresholds is clearer and creates better urgency. Barry's and SoulCycle both use numeric remaining. F45 uses a progress ring but their capacity is 36, where it works better visually.

**Waitlist UX:**

When the user taps a full class, the bottom sheet shows:
- "Class is full -- join the waitlist?"
- Current waitlist length: "2 people ahead of you"
- "No credits deducted until you get a spot"
- "Join Waitlist" button (secondary style, not primary -- this is a contingent action).

**After joining waitlist:**
- Class card shows "Waitlisted #3" where the spots indicator was.
- Position updates in real-time if others leave the waitlist.

**Waitlist claim notification (the critical moment):**

This is the highest-stakes notification in the entire app. Someone cancelled, a spot opened, and the waitlisted user has 30 minutes to claim it. Get this wrong and you lose revenue.

**Push notification:**
- Title: "A spot opened up!"
- Body: "HIIT at 17:30 with Rory -- claim your spot in 29 minutes"
- Action buttons (iOS actionable notification): "Claim Spot" / "Pass"
- Deep link: opens directly to the claim bottom sheet.

**Claim bottom sheet (opened from notification or in-app):**
- Countdown timer prominently displayed: "29:47 remaining" with a circular progress ring depleting.
- Class details.
- "1 credit will be deducted" reminder.
- "Claim My Spot" primary button.
- "Release to Next Person" secondary option.
- If timer expires: auto-release with a gentle notification ("The spot was offered to the next person").

**Nightly blackout (10pm-6am):** If a spot opens during blackout hours, the system holds the notification and delivers it at 6:00am with an adjusted claim window. The UI should note: "Spot opened overnight -- you have until 6:30am to claim."

**Reference: TeamUp's auto-promote vs. manual claim zones:**
- More than 24h before class: auto-book (no notification needed, just a confirmation push: "You've been booked into HIIT at 17:30 tomorrow!")
- Less than 24h before class: manual claim with 30-minute window.
- Display this distinction in the waitlist join confirmation: "If a spot opens more than 24h before class, you'll be auto-booked."

### 1.4 Cancellation UX

**Recommendation: Cancel button on booking card with smart warnings**

**Where to cancel:**
- On the "My Bookings" tab: each upcoming booking card has a "Cancel Booking" text button (red, bottom-right of card).
- Also accessible from the schedule view: if the user has booked a class, the card shows "Booked" with a checkmark, and tapping it opens a bottom sheet with booking details + cancel option.

**Cancel cutoff countdown:**
- Every booking card shows: "Free cancel until 15:30" (2 hours before the 17:30 class).
- When within 4 hours of the cutoff, this text turns amber and becomes more prominent: "Free cancel for 1h 45m".
- When past the cutoff: the cancel button text changes to "Late Cancel (no refund)" in red.

**Cancellation flow:**

1. Tap "Cancel Booking" on the card.
2. **Before cutoff:** Simple confirmation dialog (not bottom sheet -- this should feel lightweight):
   - "Cancel HIIT at 17:30?"
   - "Your credit will be refunded."
   - [Keep Booking] [Cancel Class] -- destructive action on the right per iOS HIG.

3. **After cutoff (late cancel):** More prominent warning:
   - Bottom sheet with warning icon.
   - "Late Cancellation"
   - "Cancelling now means your credit will NOT be refunded."
   - "The cutoff was 15:30 (2 hours before class)."
   - [Keep Booking] [Cancel Anyway] -- "Cancel Anyway" in red.

4. **No-show handling:** No user-facing action. If a user doesn't attend, the coach marks them as no-show during attendance (see Coach section). The user sees "No-show" status on their past booking card the next day.

**Why not swipe-to-cancel?** Swipe gestures are discovery-impaired (users don't know they exist) and dangerous for an action with financial consequences. A visible button with a confirmation step is safer. The Mindbody app uses swipe-to-cancel and their support forums are full of accidental cancellation complaints.

**Post-cancellation:**
- Brief success state: "Booking cancelled. Credit refunded." (or "Cancelled. No refund (late cancel).")
- If the class had a waitlist: "Your spot will be offered to the next person on the waitlist."
- The class card on the schedule returns to its bookable state.

### 1.5 Credit Balance

**Recommendation: Persistent header badge + contextual display on booking screen + dedicated section in profile**

Credits are the currency of the platform. Users need to know their balance at a glance without hunting for it, but it shouldn't dominate every screen.

**Three display points:**

1. **Navigation bar badge (persistent):**
   - Small pill in the top-right of the screen (or in the tab bar near the profile icon): "7 credits" with a coin/token icon.
   - Updates in real-time after booking/cancellation with a brief bounce animation.
   - When balance hits 0: badge turns red. When balance is 1-2: amber.
   - Tapping this pill navigates to the credit management section.

2. **Booking confirmation bottom sheet (contextual):**
   - "1 credit will be deducted" with balance shown: "Current: 7 | After: 6".
   - Insufficient balance: "You need 1 credit. Buy more to book." with inline purchase CTA.

3. **Profile/Account tab (detailed):**
   - Credit balance card at top of profile screen.
   - Shows: current balance, subscription status (if any), transaction history.
   - Transaction history: chronological list with +/- indicators, dates, and reasons ("Booked HIIT 17:30", "Cancelled -- refund", "Purchased 5-pack").

**Low balance warning:**
- When balance reaches 2 credits: in-app banner (dismissible) on the schedule screen: "Running low on credits -- buy more to keep booking."
- When balance reaches 0: the banner becomes persistent and more prominent.
- Push notification at 1 credit remaining (once per depletion cycle, not spammy): "You have 1 credit left. Buy more so you don't miss your favourite classes."

**Purchase flow (Revolut integration):**

The existing plan uses Revolut payment links. This means the purchase flow leaves the app temporarily. Design for a smooth handoff:

1. User taps "Buy Credits" (from profile, from low-balance banner, or from insufficient-balance booking screen).
2. **Credit pack selection screen:**
   - Cards for each pack, ordered by value:
     - 1 Session -- £9.99
     - 3 Sessions -- £110.00 (shown as "Save £XX" vs single sessions -- but note the actual Hitsona pricing doesn't offer progressive discounts on group sessions, only PT sessions; adapt display accordingly)
     - 5 Sessions -- £150.00
     - 10 Sessions -- £275.00
   - Monthly subscription option (if applicable) shown separately at bottom.
   - Challenge prepaid (£250, 8 weeks) shown only when a challenge is in REGISTRATION_OPEN status.

3. User taps a pack. **Pre-redirect interstitial** (2-3 seconds, auto-advances):
   - "Taking you to Revolut to complete payment..."
   - Revolut logo for trust.
   - "You'll return to CoachFit automatically after payment."

4. **Redirect to Revolut payment link** (opens in-app browser / SFSafariViewController on iOS, Chrome Custom Tab on Android). Never use a full browser redirect -- the user must feel they haven't "left" the app.

5. **Return to app:** Revolut redirects back to a deep link. The app shows:
   - Success: "Payment received! 5 credits added." with confetti animation.
   - Pending: "Payment processing -- credits will appear shortly." (for bank transfers).
   - Failed: "Payment didn't go through. Try again or choose a different method."

6. **Webhook confirmation:** Backend receives Revolut webhook confirming payment, credits the account. If the user sees "pending," this resolves it.

**What ClassPass gets right:** Showing credit cost directly on the class card (they show "7 credits" per class). For CoachFit where every class costs 1 credit, this is less necessary, but showing "1 credit" on the booking bottom sheet is essential.

### 1.6 Challenge Dashboard

**Recommendation: Dedicated tab with progress ring hero, streak calendar, and daily check-in as the primary action**

The challenge is a 6-8 week engagement commitment. The dashboard needs to do three things: (1) show overall progress and motivation, (2) make the daily check-in effortless, and (3) create social comparison through the leaderboard. F45's challenge app and Orangetheory's challenge tracking are the reference points.

**Challenge Dashboard Layout (scrollable single screen):**

**Hero section (top, always visible):**
- Large circular progress ring showing percentage through the challenge (e.g., "Week 4 of 8 -- 50%").
- Inside the ring: days remaining ("28 days left") or motivational phase name if using the F45 phase model.
- Below the ring: current streak ("12-day streak" with flame icon) and total check-ins ("24/56 days").
- The ring should use a gradient fill (brand colors) and animate on load.

**Daily check-in CTA (prominent, below hero):**
- If today's check-in is NOT done: large card with "Log Today's Check-in" button, pulsing gently. This is the single most important daily action.
- If today's check-in IS done: the card shows "Today's check-in complete" with a checkmark, and the data they submitted (weight, photo status, etc.) in summary form.

**Check-in flow (bottom sheet or dedicated screen depending on complexity):**
- For the Hitsona challenge, check-ins include: body measurements, daily habits, and potentially photo uploads.
- **Step 1: Quick metrics** -- numeric inputs for weight (with +/- stepper and manual entry), and any other daily measurements configured by the coach.
- **Step 2: Daily habits** -- toggle switches or checkboxes for tracked habits (e.g., "Drank 2L water", "8 hours sleep", "Ate within plan"). These should be tappable full-width rows, not tiny checkboxes.
- **Step 3: Photo (optional, periodic)** -- "Add progress photo" with camera/gallery picker. Show guidance overlay: "Stand in the same spot, same lighting, relaxed pose." Photo uploads should show a progress indicator and compress client-side before upload.
- **Step 4: Notes** -- optional free-text field for how they're feeling.
- **Submit** -- success animation, streak update, points awarded.

**Streak calendar (below check-in):**
- GitHub-style contribution grid adapted for the challenge duration (6-8 weeks = 42-56 cells).
- Each day is a small square: green (checked in), amber (partial), gray (missed), future days dimmed.
- Current day highlighted with a ring.
- Tapping a past day shows what was submitted that day in a tooltip/popover.
- This visualization is motivationally powerful -- the F45 app uses it and members frequently screenshot it for social media.

**Leaderboard (below calendar):**
- **Important design decision: visible leaderboard vs. opt-in.**
  - For a small studio (20-30 people), everyone knows each other. Leaderboard should be visible by default but show relative metrics, not absolute body measurements.
  - Leaderboard scoring should be based on: consistency (check-in streak), class attendance, and percentage-based body composition changes (not absolute numbers).
  - Show top 5 with the user's own position highlighted wherever they are.
  - Each leaderboard entry: rank number, first name + last initial ("Rory S."), avatar, score, and a trend arrow (up/down/stable from last week).
  - Full leaderboard accessible by tapping "See All".

**Measurements section (below leaderboard):**
- Line graph showing primary tracked metric (usually weight) over the challenge duration.
- Toggle between metrics if multiple are tracked (weight, body fat %, measurements).
- Before/after photo comparison: side-by-side viewer with slider (like the Orangetheory transformation photos). Only visible to the individual user and their coach.

**Coach weekly review (notification-driven):**
- When coach posts a weekly review, client receives a push notification: "Your weekly review from [Coach Name] is ready."
- Tapping navigates to a dedicated review card showing coach's notes, feedback, and any personalized recommendations.
- This already exists in CoachFit's weekly review system -- integrate it into the challenge tab with a "Latest Review" card.

### 1.7 Navigation

**Recommendation: 4-tab bottom navigation bar**

For the client mobile app, the bottom tab bar should have exactly 4 tabs. More than 5 is cognitively overloaded (iOS HIG recommendation); fewer than 4 under-utilizes the navigation affordance.

**Tab configuration:**

| Tab | Icon | Label | Primary Content |
|-----|------|-------|-----------------|
| 1 | Calendar icon | Schedule | Class schedule view (1.1) with booking |
| 2 | Ticket/bookmark icon | Bookings | Upcoming and past bookings list |
| 3 | Trophy/target icon | Challenge | Challenge dashboard (1.6) -- only visible during active challenge; otherwise this tab shows "Programmes" with available/upcoming challenges |
| 4 | Person icon | Profile | Account, credits, settings, transaction history |

**Why "Bookings" as a separate tab instead of embedding in Schedule?**
- Users check "what did I book" and "when is my next class" frequently. Combining it with the schedule makes the user hunt through days.
- The Bookings tab serves as a receipt/history view -- a quick list of upcoming classes (with cancel buttons) and past classes (with attendance status).
- SoulCycle separates these; ClassPass combines them. For a small studio where users book 3-5 classes per week, a dedicated bookings view is cleaner.

**Challenge tab behavior:**
- When no challenge is active: show "Programmes" screen listing any available or upcoming challenges with registration CTA.
- When a challenge is in REGISTRATION_OPEN: show registration details and sign-up flow.
- When a challenge is ACTIVE: show the full challenge dashboard (1.6).
- When between challenges: show the most recent completed challenge summary with "View Results" option, and any upcoming challenge teaser.

**Badge indicators on tabs:**
- Schedule tab: red dot if there's a waitlist claim pending.
- Bookings tab: number badge showing count of upcoming bookings today.
- Challenge tab: red dot if daily check-in not yet completed.
- Profile tab: red dot if credit balance is 0 or if there's an unread coach review.

**Header bar (top of every screen):**
- Left: CoachFit logo (small) or screen title.
- Right: credit balance pill (tappable, navigates to credit purchase) + notification bell with badge count.

### 1.8 Push Notifications

**Notification strategy: respectful, actionable, and timed appropriately.**

| Notification | Timing | Priority | Actionable? |
|-------------|--------|----------|-------------|
| Class reminder | 2 hours before class (at the cancel cutoff) | Normal | "View Booking" deep link |
| Class reminder (final) | 30 minutes before class | Normal | "Get Directions" deep link (maps) |
| Waitlist claim | Immediately when spot opens (respecting 10pm-6am blackout) | High (time-critical) | "Claim Spot" / "Pass" action buttons |
| Waitlist auto-booked | When auto-promoted (>24h before class) | Normal | "View Booking" deep link |
| Booking confirmation | Immediately after booking | Normal | "Add to Calendar" action |
| Cancellation confirmation | Immediately after cancel | Low | None |
| Credit balance low | When balance reaches 1 credit | Normal | "Buy Credits" deep link |
| Challenge daily nudge | 9:00 AM if check-in not done | Normal | "Check In Now" deep link |
| Challenge reminder | 8:00 PM if check-in still not done | Low | "Log Today" deep link |
| Weekly review available | When coach posts review | Normal | "Read Review" deep link |
| Challenge leaderboard update | Monday morning (weekly) | Low | "View Leaderboard" deep link |
| New challenge registration open | When challenge moves to REGISTRATION_OPEN | Normal | "Learn More" deep link |

**Notification principles:**
- Never more than 3 notifications per day from CoachFit.
- Group challenge nudges: if the user already got the 9am nudge and still hasn't checked in, the 8pm one is the last attempt. No more after that.
- The 2-hour class reminder doubles as the "last chance to cancel for free" reminder -- frame it that way: "HIIT at 17:30 -- starting in 2 hours. Cancel for free until now."
- Waitlist claims are the only notifications that should use iOS Critical Alerts (if the user opts in) because they are genuinely time-sensitive.

---

## 2. Coach Experience

Coaches (Rory and Gav) primarily operate from a tablet during classes and a desktop browser for admin tasks. Their mobile phone is a secondary device for quick checks between sessions. The coach UI should prioritize **efficiency over discovery** -- they do the same tasks repeatedly and need speed.

### 2.1 Schedule Management

**Recommendation: Weekly view as default with drag-to-adjust, template-based session creation**

Since Hitsona runs a repeating weekly pattern (same slots every week with minor variations), the schedule management tool should optimize for the common case: **repeating the template** and **making exceptions**.

**Weekly view (default):**
- 7-column layout (Mon-Sun) with time running vertically.
- Each session shown as a colored block: purple for HIIT, gold for CORE.
- Block height proportional to duration (25 min = small block, since all sessions are the same length, this creates a clean uniform grid).
- Each block shows: class type, time, instructor initials, and booking count ("6/10").
- Blocks are draggable (for rescheduling) and resizable (if duration needs adjustment, though this is rare for 25-min classes).

**Creating sessions:**
- "Generate from Template" button: takes the ClassTemplate and generates ClassSession instances for the next N weeks. This is the primary flow -- coaches set up the template once and generate forward.
- "+ Add Session" button on any day: opens a quick-create form (pre-populated from template defaults). Fields: class type (dropdown), time (time picker), instructor (dropdown of 2), capacity (pre-filled from template, editable), notes.
- Drag from template sidebar: alternative creation method where templates are listed in a sidebar and can be dragged onto the calendar.

**Day view (for class day management):**
- Vertical timeline showing all sessions for that day.
- Each session card expands to show the booking list, attendance status, and quick actions.
- This is the view coaches use during a working day at the studio.

**Month view (for planning):**
- Mini calendar with session count per day.
- Useful for seeing coverage gaps or planning around holidays.
- Not the primary view -- accessible via a view toggle.

**Cancelling a session:**
- Coach taps a session block and selects "Cancel Session."
- Confirmation asks: "Cancel HIIT at 17:30 on March 24? 8 members are booked."
- Options: "Cancel & Notify Members" (sends push + email to all booked members, refunds credits) or "Cancel Silently" (for sessions with 0 bookings).
- Cancelled sessions show as struck-through on the calendar for a visual record.

**Tablet optimization:**
- The weekly view should be optimized for iPad landscape (1024px+).
- Touch targets minimum 44x44pt (iOS HIG).
- Session blocks should be tappable, not requiring precise pointer clicks.

### 2.2 Attendance Marking

**Recommendation: Checklist with bulk actions, optimized for speed during the 5-minute post-class window**

Attendance marking happens in a narrow time window: the 2-3 minutes after a 25-minute class ends, before the next class starts (often just 5-10 minutes later in the Hitsona schedule -- e.g., 06:30 HIIT ends at 06:55, next HIIT at 07:00).

**Attendance screen (accessed from the session card or a "Mark Attendance" button):**

- Header: class name, time, date, instructor.
- "Class in Progress" / "Class Ended" indicator with elapsed time.
- **Participant list** as full-width rows, sorted alphabetically:
  - Each row: client photo (40px circle), full name, and **two toggle buttons on the right**: "Attended" (green when active) and "No-show" (red when active).
  - Default state: neither toggled (unprocessed).
  - Toggling "Attended" auto-deselects "No-show" and vice versa.
- **Bulk action bar** at top: "Mark All Attended" button. In a small studio where most people who book actually attend, this is the common case. Coach taps "Mark All Attended," then taps "No-show" on the 1-2 people who didn't come. This is 3 taps instead of 10.
- **Save** button at bottom (sticky). Changes auto-save as toggles are tapped (with visual confirmation), but a final "Confirm Attendance" button locks it in and triggers any no-show consequences.

**Why toggle buttons and not swipe cards?** Swipe cards (a la Tinder-style) work for sequential decisions but are slow when a coach needs to see the whole list at once and mark one or two exceptions. The toggle list is faster for the "mark all, then correct exceptions" pattern. Glofox uses this pattern effectively.

**Why not checkboxes?** Checkboxes are binary (present/absent) and don't distinguish between "attended" and "no-show." A no-show has consequences (no refund, possible future restrictions); absent could mean cancelled. The two-button approach makes the coach's intent explicit.

**Late arrivals:**
- If a client was waitlisted and auto-promoted, their row shows a "Waitlist" badge so the coach knows they were a late addition.
- If a client hasn't checked in to the building yet (future feature: QR check-in), their row could show "Not checked in" in amber.

**Post-class summary:**
- After confirming attendance, show a summary: "8 attended, 1 no-show, 1 late cancel."
- Option to add a class note: "Equipment note: rower #3 needs servicing." This persists as a session-level note visible to admin.

### 2.3 Client Credit Management

**Recommendation: Filterable client table with balance column + inline adjustment + submission approval queue**

**Client credit overview (table view on desktop):**
- Table columns: Client Name | Current Balance | Subscription Status | Last Purchase | Last Class | Actions.
- Sortable by any column (sort by balance ascending to find clients about to run out).
- Filter by: active subscribers, pay-as-you-go, zero balance, challenge participants.
- Search bar for finding specific clients.
- Each row has a "..." menu: "View History," "Adjust Balance," "Gift Credits."

**Balance adjustment flow:**
- Coach clicks "Adjust Balance" on a client row.
- Modal form: Amount (+/-), Reason (dropdown: "Correction," "Comp/Gift," "Refund," "Other" with free text), Note (optional).
- All adjustments logged in the `ClientCreditLedger` with the coach's ID as the actor.
- Admin can review all coach adjustments in the audit log.

**Credit submission approval queue:**
- Separate section (or tab) showing pending `CreditSubmission` records.
- Each submission card: client name, submission type (manual purchase claim, corporate benefit claim, etc.), amount, evidence (photo of receipt if applicable), date submitted.
- Two actions: "Approve" (credits the account) and "Reject" (with required rejection reason sent to client).
- Badge count on the queue tab showing pending submissions.

**Proactive alerts:**
- Dashboard widget: "3 clients have 0 credits" with a list and quick "Send Reminder" action (generates a push notification nudging them to purchase).
- Widget: "2 subscriptions renewing this week" for awareness.

### 2.4 Challenge Management

**Recommendation: Compliance grid dashboard (the "coach's war room") with at-risk alerts**

**Compliance dashboard (the primary challenge view for coaches):**

This is the screen coaches check daily to see who is and isn't engaging. It should be a **heat map grid** similar to what F45 uses internally.

**Grid layout:**
- Rows: one per challenge participant, sorted by compliance score (lowest first, so at-risk participants are at the top).
- Columns: days of the current week (Mon-Sun), plus a "Week Total" column.
- Each cell: colored indicator.
  - Green: checked in (all required items submitted).
  - Amber: partial check-in (some items missing, e.g., submitted habits but no weight).
  - Red: missed entirely.
  - Gray: future day.
  - White with checkmark: rest day (if applicable).
- Tapping a cell shows what the participant submitted (or didn't) for that day.

**At-risk participant alerts:**
- "Attention Needed" section above the grid, showing participants who:
  - Have missed 2+ consecutive days (2-day streak break).
  - Have not submitted photos when due.
  - Have declining engagement trend (checked in 5/7 days in week 1, 3/7 in week 2, 1/7 in week 3).
- Each alert has quick actions: "Send Encouragement" (push notification with coach's message), "Schedule Check-in" (creates a reminder for the coach to call them), "View Profile."

**Weekly review workflow:**
- "Write Reviews" button shows a list of participants needing this week's review.
- Each review form: participant's week summary (auto-generated from check-in data -- attendance count, measurements, compliance %), coach's notes textarea, rating/assessment (optional 1-5 stars or sentiment: "Great week" / "Good effort" / "Needs attention").
- "Save & Next" button to move through reviews efficiently -- coaches should be able to review all 20 participants in one sitting.
- Previously written reviews shown in a sidebar for context on that participant.

**Challenge overview metrics (top of dashboard):**
- Cards showing: total participants, average compliance %, average attendance this week, days remaining.
- Line graph: weekly compliance trend for the whole group.
- Milestone tracker: which phase the challenge is in, upcoming milestones (midpoint measurements, final week).

### 2.5 Waitlist Management

**Recommendation: Integrated into class session detail, not a separate view**

Waitlist management is not frequent enough (in a small studio) to warrant its own section. It should be visible within the class session detail view.

**Session detail view (coach taps a session on the schedule):**
- **Booked section**: list of booked participants with attendance toggles (see 2.2).
- **Waitlist section** (below booked list, separated by a divider):
  - Ordered list showing waitlist position, participant name, and time joined.
  - Each row has a "Promote" button: manually moves this person to booked status (deducting their credit, sending them a notification).
  - "Remove from Waitlist" option in overflow menu.
- **Promote manually vs. auto-promote:**
  - The system handles auto-promotion automatically (>24h before class) and claim windows (<24h before class).
  - Manual promote is for coach override: e.g., someone messages the coach directly, and the coach wants to bump them ahead of the queue. This should show a confirmation: "This will skip [Person A] who is #1 on the waitlist. Continue?"

---

## 3. Admin Experience

The admin (likely the studio owner or manager) uses desktop web exclusively. Their needs are analytical and configurational -- they don't book classes or mark attendance. The admin dashboard should feel like a **business intelligence tool**, not a consumer app.

### 3.1 System Overview Dashboard

**Recommendation: KPI cards + trend sparklines + actionable insights**

CoachFit already has an attention scoring system and admin insights model. The new class/credit/challenge features add operational metrics.

**Dashboard layout (top to bottom):**

**Row 1: Key Performance Indicators (4 cards)**

| KPI | Display | Trend |
|-----|---------|-------|
| Weekly Utilization | "73% average class fill rate" | Sparkline (last 8 weeks) |
| Active Members | "24 with credits or subscription" | +/- vs last month |
| Revenue (Credits Sold) | "£1,240 this month" | Sparkline (last 6 months) |
| No-show Rate | "4.2% this month" | Sparkline (should trend down) |

**Row 2: Schedule Heatmap**
- 7-day x 24-hour heatmap showing class utilization by time slot.
- Color intensity = fill rate (dark = full/near-full, light = under-booked, white = no class).
- This immediately shows the admin which time slots are popular (17:30 = dark) and which are underperforming (12:30 = light). Drives schedule optimization decisions.

**Row 3: Operational Alerts**
- Cards from the existing `AdminInsight` system, filtered to class/credit/challenge:
  - "5 clients have 0 credits and haven't purchased in 14+ days" -- possible churn risk.
  - "12:30 HIIT averaging 2/10 capacity -- consider removing or relocating."
  - "Challenge compliance dropped below 60% in week 4 -- coach intervention recommended."
  - "3 no-shows from [Client Name] this month -- possible pattern."

**Row 4: Revenue Breakdown**
- Stacked bar chart: revenue by product type (session packs, subscriptions, challenge registrations) over the last 6 months.
- Table below: top-selling products with counts and revenue.

**Row 5: Member Engagement**
- Cohort retention chart: of members who joined N months ago, what % are still booking classes?
- Booking frequency distribution: histogram showing how many members book 1x/week, 2x/week, 3x/week, etc.

### 3.2 Multi-Coach Schedule

**Recommendation: Side-by-side day view or color-coded unified view**

With only 2 coaches, the multi-coach view doesn't need the complexity of a Gantt chart.

**Option A (recommended): Unified calendar with coach color coding**
- Single weekly/daily view (same as coach view) but each session block shows the instructor's color (e.g., Rory = blue, Gav = green) in addition to the class type left-border color.
- Filter toggles at top: "Show: [Rory] [Gav] [All]".
- This is simple and sufficient for 2 coaches.

**Option B (for growth beyond 2 coaches): Split-pane view**
- Side-by-side daily columns, one per coach.
- Shows each coach's schedule independently.
- Useful if the studio grows to 4+ coaches.

**Admin-specific schedule actions:**
- "Reassign Instructor": change who's teaching a session.
- "View Booking Details": see who's booked without having coach-level access.
- "Bulk Generate": generate sessions for all templates for the next N weeks.
- "Holiday Mode": cancel all sessions for a date range (e.g., Christmas closure), with bulk notifications to affected members.

### 3.3 Credit Product Management

**Recommendation: Card-based product manager with live preview**

**Product list view:**
- Cards (not a table) for each credit product, showing: name, price, credit mode, active/draft status, number of active purchasers.
- Color-coded status: green (active, for sale), amber (draft), gray (archived).
- "Create New Product" button.
- "Duplicate" action on each card (the most common way to create a new product is to copy an existing one and modify).

**Product editor (modal or dedicated page):**
- Form fields matching the `CreditProduct` schema:
  - Name, Description.
  - Credit Mode: Session Pack / Subscription / Prepaid (radio buttons with explanations).
  - Price (GBP).
  - Credits per period (for subscriptions).
  - Period type (weekly/monthly -- for subscriptions).
  - Applies to class types (multi-select: HIIT, CORE, or All).
  - Purchasable by provider only (toggle -- for products like the Challenge that coaches sell directly).
  - Allow repeat purchases (toggle).
  - Rollover policy (for subscriptions): None / Capped / Unlimited.
- **Live preview panel** on the right (desktop) showing how this product will appear to clients in the purchase flow.
- Save as Draft / Publish toggle.

**Template duplication:**
- "Duplicate" creates a copy with "[Product Name] (Copy)" as the name.
- All fields copied except: active status (set to draft) and external IDs (cleared).
- Coach can then modify and publish.

### 3.4 Challenge Configuration

**Recommendation: Wizard-style setup with status pipeline visualization**

**Challenge list view:**
- Cards showing each challenge with: name, status badge, dates, participant count, compliance rate.
- Status badges use the lifecycle colors: DRAFT (gray), REGISTRATION_OPEN (blue), ONBOARDING (amber), ACTIVE (green), COMPLETING (amber), COMPLETED (blue), ARCHIVED (gray).

**Challenge pipeline (visual):**
- Horizontal pipeline/funnel showing the challenge lifecycle stages.
- Current stage highlighted. Each stage is clickable to see what actions are available.
- Status transitions have guardrails:
  - DRAFT -> REGISTRATION_OPEN: requires all configuration complete (dates, pricing, check-in config).
  - REGISTRATION_OPEN -> ONBOARDING: requires minimum participant count met (configurable).
  - ONBOARDING -> ACTIVE: requires start date reached.
  - Each transition has a confirmation: "Moving to ACTIVE will start tracking for 18 registered participants. Continue?"

**Challenge setup wizard (for new challenges):**
- Step 1: Basics -- name, description, duration (6/8/12 weeks), start/end dates.
- Step 2: Pricing -- registration fee (£250 for the 8-week challenge), credit product link, payment method.
- Step 3: Check-in Configuration -- what participants track daily (weight, habits, photos, measurements). Uses the existing `CohortCheckInConfig` model.
- Step 4: Leaderboard -- scoring formula (consistency %, attendance %, measurement change %), visibility settings.
- Step 5: Phases -- optional phase labels (e.g., "Foundation," "Build," "Peak") with week ranges.
- Step 6: Review & Publish -- summary of all settings, "Save as Draft" or "Open Registration."

**Registration monitoring:**
- When REGISTRATION_OPEN: live count of registrations with a progress bar toward the target/cap.
- List of registered participants with payment status (paid/pending).
- "Send Reminder" to people who expressed interest but haven't registered (if tracked).
- "Close Registration" button (transitions to ONBOARDING).

---

## 4. Cross-Platform Considerations

### 4.1 iOS App vs. Android App vs. Mobile Web

**Feature parity strategy: iOS-first, mobile web as fallback, Android follows iOS patterns**

| Feature | iOS App | Android App | Mobile Web (PWA) |
|---------|---------|-------------|-----------------|
| Class scheduling & booking | Full | Full | Full |
| Push notifications | Native APNs | Native FCM | Web Push (limited on iOS Safari pre-16.4, but iOS 16.4+ supports it) |
| Haptic feedback | UIImpactFeedbackGenerator | Vibration API | Navigator.vibrate() (Android only) |
| Calendar integration | EventKit deep link | Calendar Intent | .ics download |
| HealthKit sync | Full (existing) | Google Health Connect | Not available |
| Photo upload (challenge) | UIImagePickerController | MediaStore | <input type="file" accept="image/*"> |
| Offline support | Full (CoreData cache) | Room DB cache | Service Worker cache |
| Payment (Revolut) | SFSafariViewController | Chrome Custom Tab | Window redirect (with return URL) |
| Biometric auth | Face ID / Touch ID | Fingerprint / Face | Web Authentication API (limited) |
| Widget | iOS 17 WidgetKit (next class countdown) | Glance widget | Not available |

**Mobile web specific considerations:**
- The CoachFit web app is already a PWA (manifest.json, PWAProvider, PWAInstallPrompt components exist).
- For mobile web users: the bottom tab bar should be implemented as a fixed-position element. Account for the iOS Safari bottom bar (env(safe-area-inset-bottom)) and Android Chrome's URL bar.
- Critical: test the Revolut payment redirect flow on mobile web carefully -- the return URL must bring the user back to the PWA, not a new browser tab.
- Add the "Add to Home Screen" prompt after the user's second class booking (proven engagement = higher install rate).

### 4.2 Responsive Breakpoints for Coach Dashboard

The coach dashboard must work across phone (quick checks between classes), tablet (primary during-class device), and desktop (planning and reviews).

**Breakpoints:**

| Breakpoint | Width | Layout | Primary Use |
|-----------|-------|--------|-------------|
| Mobile | <640px | Single column, bottom nav | Quick status checks, notifications |
| Tablet portrait | 640-1023px | Two-column where needed, bottom nav | Attendance marking during class |
| Tablet landscape / small desktop | 1024-1279px | Sidebar nav + main content | Schedule management, reviews |
| Desktop | 1280px+ | Sidebar nav + main + detail panel | Full dashboard, analytics |

**Key adaptations:**
- **Attendance marking** (2.2): On phone, the toggle buttons stack vertically under each name. On tablet, they're inline. On desktop, the list has more columns (booking time, waitlist status).
- **Schedule view** (2.1): On phone, show day view only. On tablet, show 3-day view. On desktop, show full week.
- **Compliance grid** (2.4): On phone, show only today + 2 adjacent days. On tablet, show the full week. Swipe to navigate weeks.

### 4.3 Offline Support

**What must work offline (no network):**
- Viewing the class schedule for the current week (cached at last sync).
- Viewing own upcoming bookings (cached).
- Viewing challenge progress (cached).
- Drafting a daily check-in (saved locally, submitted when online).

**What requires network (graceful degradation):**
- Booking/cancelling a class (show "You're offline -- booking will be submitted when you're back online" with the booking queued).
- Purchasing credits (cannot proceed without network).
- Loading leaderboard (show last-known state with "Last updated: 2 hours ago").
- Photo upload (queue locally, upload in background when connected).

**Implementation notes:**
- The existing `OfflineIndicator` component should be used to show connectivity status.
- Service Worker (already configured in the PWA setup) should cache: schedule API responses, user profile, credit balance, challenge state.
- Use stale-while-revalidate for schedule data (show cached, fetch fresh in background).
- Queue mutations (bookings, check-ins) in IndexedDB and replay when online.

### 4.4 Deep Linking from Push Notifications

Every push notification should deep link to a specific screen. URL scheme for the iOS app and universal links for the web:

| Notification | Deep Link | Screen |
|-------------|-----------|--------|
| Class reminder | `coachfit://bookings/{bookingId}` | Booking detail card |
| Waitlist claim | `coachfit://claim/{bookingId}` | Claim bottom sheet over schedule |
| Challenge nudge | `coachfit://challenge/checkin` | Daily check-in form |
| Weekly review | `coachfit://challenge/review/{reviewId}` | Review detail |
| Credit low | `coachfit://credits/buy` | Credit purchase screen |
| Coach: attendance | `coachfit://coach/session/{sessionId}/attendance` | Attendance marking |

For web: use pathname-based routing (`/client-dashboard/bookings/[id]`, `/client-dashboard/challenge/checkin`, etc.) and the existing Next.js App Router structure.

---

## 5. Design System & Component Patterns

### 5.1 Class Card Component

The class card is the most-repeated component in the app. It must be compact, informative, and tappable.

**Anatomy:**
```
+-------------------------------------------------------+
| [ACCENT BAR 4px]                                       |
| 06:30          HIIT                    [8 spots]  [>]  |
| AM  25 min     Rory S. [avatar]        Book            |
+-------------------------------------------------------+
```

**Variants:**
- Default (bookable): as above.
- Booked (user has this class): green left border, "Booked" badge replacing spots count, checkmark icon replacing arrow.
- Waitlisted: amber left border, "Waitlisted #2" replacing spots count.
- Full: dimmed card, "Full" or "Waitlist" text.
- Past (attended): gray card, "Attended" badge with checkmark.
- Past (no-show): gray card with red "Missed" badge.
- Cancelled: struck-through text, "Cancelled" badge.

### 5.2 Bottom Sheet

Used for: booking confirmation, cancellation, waitlist claim, quick actions.

**Specifications:**
- Drag handle at top (48x5px rounded, gray).
- Maximum height: 60% of screen (content scrolls within if needed).
- Background dim: rgba(0,0,0,0.4) with tap-to-dismiss.
- Entry animation: spring-based slide up (200ms, slight overshoot).
- Exit: slide down with velocity tracking (if user flicks down, dismiss immediately).
- On large screens (tablet/desktop): render as a modal dialog instead of bottom sheet.

### 5.3 Credit Balance Pill

Persistent UI element showing credit count.

**Specifications:**
- Shape: rounded rectangle (pill), 80x32px approximately.
- Content: coin icon (16px) + balance number.
- Colors: default = brand blue background, white text. Low balance (1-2) = amber. Zero = red.
- Animation: on balance change, number counter-animates (old number slides up/fades, new number slides up into place).
- Position: right side of header bar, or near the profile tab icon.

### 5.4 Calendar Date Strip

Horizontal scrollable date selector.

**Specifications:**
- Each date pill: 48x64px minimum tap target.
- Content: 3-letter day abbreviation (Mon), date number (24), booking dot indicator.
- Today: filled pill (brand color background, white text). Selected (if not today): outlined pill. Other: no background.
- Scroll behavior: snap to nearest pill. Initial scroll position = today centered (or left-aligned since future dates extend right).
- Past dates: dimmed text, no booking dot. Still tappable for history.

### 5.5 Progress Ring (Challenge)

Circular progress indicator for challenge completion.

**Specifications:**
- Size: 160x160px on phone, 200x200px on tablet.
- Track: light gray circle (stroke-width: 12px).
- Progress: gradient fill (brand color start to accent color end), animated on load (0 to current value over 1 second, ease-out).
- Center content: percentage number (large, bold) + subtitle text (small, muted).
- The ring represents weeks elapsed / total weeks, not daily check-in rate (that's shown separately).

### 5.6 Compliance Grid Cell

Small square indicator for daily challenge check-in status.

**Specifications:**
- Size: 28x28px on phone, 36x36px on tablet/desktop.
- Border radius: 4px.
- Colors: green (#22c55e) = complete, amber (#f59e0b) = partial, red (#ef4444) = missed, gray-100 = future, white with border = rest day.
- Today: additional ring/border highlight.
- Tappable: shows popover with submission details.

### 5.7 Leaderboard Row

**Specifications:**
- Height: 56px.
- Layout: rank number (24px wide, center-aligned) | avatar (36px circle) | name (flex) | score (right-aligned) | trend arrow.
- Current user's row: highlighted background (brand color at 10% opacity).
- Top 3: rank numbers with medal colors (gold, silver, bronze).
- Trend arrows: green up, red down, gray dash (stable).

### 5.8 Notification Cards (In-App)

For the notification feed / activity list.

**Specifications:**
- Left: icon (class, credit, challenge, or coach avatar for reviews).
- Center: title (bold) + description (regular) + timestamp ("2h ago").
- Right: unread indicator dot (brand color).
- Swipe right: mark as read. No swipe left (no destructive actions on notifications).

---

## 6. Micro-interactions & Animation

### 6.1 Booking Success

- Bottom sheet transitions from form state to success state.
- Checkmark draws itself (SVG path animation, 600ms).
- Simultaneously: credit balance pill in header animates (number change + brief scale pulse).
- iOS: medium impact haptic at the moment the checkmark completes.
- Confetti particles (optional, subtle -- 8-10 small dots that float up and fade, not a full-screen explosion).

### 6.2 Check-in Streak

- When the user completes a daily check-in and their streak increments:
  - The streak number on the challenge dashboard counts up by 1 with a slot-machine-style roll animation.
  - The fire/flame icon next to it does a brief scale-up (1.0 -> 1.3 -> 1.0, 300ms, spring easing).
  - The corresponding cell in the streak calendar fills in with a radial wipe from center (200ms).

### 6.3 Credit Deduction

- When a credit is spent (booking confirmation):
  - The credit pill briefly shows "-1" below it in red, which fades up and out (like a damage number in a game, but subtle).
  - The number in the pill rolls down by 1.

### 6.4 Waitlist Claim Countdown

- The circular countdown ring depletes smoothly (not in steps).
- When under 5 minutes remaining: the ring color transitions from brand color to amber to red.
- The time text updates every second.
- At 1 minute: the ring pulses gently.
- iOS: haptic tick every 30 seconds in the last 5 minutes (only if the app is in foreground).

### 6.5 Pull-to-Refresh

- Custom pull-to-refresh on the schedule view: the CoachFit logo (which exists in components/CoachFitLogo.tsx) rotates as the user pulls down, then spins during refresh.
- Keeps brand identity present in a common micro-interaction.

### 6.6 Skeleton Loading

- All list views (schedule, bookings, leaderboard) show skeleton versions of their cards while loading.
- Skeletons use the existing skeleton components in `components/skeletons/`.
- The skeleton should match the exact layout of the loaded card (same heights, same column positions) to prevent layout shift.
- Pulse animation on skeleton blocks: opacity 0.3 -> 0.7 -> 0.3, 1.5 second cycle.

### 6.7 Tab Bar Transitions

- When switching between bottom tabs: content cross-fades (150ms, no slide).
- Tab icon: selected state scales up slightly (1.0 -> 1.1) with a filled version of the icon. Unselected: outline version at 1.0 scale.
- Badge counts animate: scale from 0 when appearing, bounce slightly when incrementing.

---

## 7. Accessibility

### 7.1 Requirements (WCAG 2.1 AA minimum)

**Color contrast:**
- All text must meet 4.5:1 contrast ratio against its background.
- The HIIT purple (#452ddb) on white background = 5.8:1 ratio -- passes.
- The CORE yellow (#f2de24) on white background = 1.6:1 ratio -- FAILS. Use yellow as an accent/border only, never as text on white. For CORE text labels, use dark text.
- Availability indicators: don't rely on color alone. "3 spots left" text is readable without seeing the amber color. The red "Missed" badge includes the word "Missed."

**Touch targets:**
- Minimum 44x44pt for all tappable elements (iOS HIG) / 48x48dp (Material Design).
- The toggle buttons in attendance marking must be at least 44pt tall.
- Calendar date pills must be at least 44pt wide (the recommended 48px meets this).

**Screen reader support:**
- Class cards: announce "HIIT class at 6:30 AM with Rory Stephens. 8 of 10 spots available. Double tap to book."
- Credit balance pill: "7 credits remaining."
- Progress ring: "Challenge progress. 50 percent complete. Week 4 of 8."
- Leaderboard: "Leaderboard. You are ranked 5th out of 18. Score 847."
- Bottom sheets: trap focus when open. Announce as a dialog.

**Motion sensitivity:**
- Respect `prefers-reduced-motion` media query.
- When enabled: disable all decorative animations (confetti, pulse effects, counter rolls). Maintain functional transitions (bottom sheet open/close) but use instant/fade instead of spring/slide.
- The progress ring should fill instantly rather than animating.

**Font sizing:**
- Support Dynamic Type (iOS) / system font scaling.
- Test all layouts at 200% text size.
- Critical: the class card must not break when text scales -- use flexible layouts, not fixed heights.

### 7.2 Specific Accessibility Patterns

**Calendar date strip:** Implement as a horizontally scrollable `role="tablist"` with each date as `role="tab"`. Announce selected date: "Monday March 24, selected. 3 classes available."

**Attendance toggles:** Each toggle pair should be a `role="radiogroup"` with options "Attended" and "No-show." Announce: "Sarah Johnson. Attendance not marked. Attended, not selected. No-show, not selected."

**Countdown timer (waitlist claim):** Use `aria-live="polite"` with updates every 30 seconds (not every second -- too noisy for screen readers). At 5 minutes remaining, switch to `aria-live="assertive"`.

---

## 8. Loading, Empty & Error States

Every screen must handle three non-happy-path states gracefully. These are where polish separates a professional app from an amateur one.

### 8.1 Loading States

| Screen | Loading Pattern | Duration Expectation |
|--------|----------------|---------------------|
| Schedule | 7 skeleton class cards stacked vertically, date strip shows immediately | <500ms with cache, <2s without |
| Bookings list | 3 skeleton booking cards | <500ms |
| Challenge dashboard | Progress ring placeholder (gray ring at 0%), skeleton text blocks | <1s |
| Leaderboard | 5 skeleton rows with avatar circles | <1s |
| Credit balance | Animated placeholder number ("--") in the pill | <300ms |
| Attendance list | 10 skeleton rows | <1s |
| Coach compliance grid | 20 x 7 gray cells (the grid structure loads immediately, data fills in) | <2s |
| Admin dashboard | KPI cards show "--" with sparkline placeholders | <3s |

**Principle:** Show the structural skeleton immediately. Never show a blank screen or a centered spinner. The existing `components/skeletons/` directory should be extended with: `ScheduleSkeleton`, `BookingCardSkeleton`, `LeaderboardSkeleton`, `ComplianceGridSkeleton`.

### 8.2 Empty States

Each empty state needs: an illustration or icon, a headline explaining the state, a body sentence with context, and a CTA button.

**"No bookings yet":**
- Icon: calendar with a plus sign.
- Headline: "No upcoming classes"
- Body: "Browse the schedule and book your first class."
- CTA: "View Schedule" (navigates to Schedule tab).

**"No credits":**
- Icon: empty wallet or coin stack.
- Headline: "No credits available"
- Body: "Purchase a session pack to start booking classes."
- CTA: "Buy Credits"

**"No challenge active":**
- Icon: trophy outline.
- Headline: "No active challenge"
- Body: "When a challenge opens for registration, you'll see it here."
- CTA: none (or "Ask Your Coach" if applicable).

**"Schedule has no classes today" (e.g., Sunday):**
- Icon: sun with "rest day" text.
- Headline: "No classes today"
- Body: "Check tomorrow's schedule or browse the week ahead."
- CTA: "View Tomorrow" (taps the next day on the date strip).

**Coach: "No clients with zero credits":**
- Positive empty state: checkmark icon.
- Headline: "All clients have credits"
- Body: "Everyone's stocked up. Nice work."
- No CTA needed.

**Admin: "No pending submissions":**
- Positive empty state: inbox with checkmark.
- Headline: "All caught up"
- Body: "No credit submissions to review."

### 8.3 Error States

**Booking failed (class became full between view and tap):**
- Bottom sheet shows: warning icon.
- Headline: "This class just filled up"
- Body: "Someone booked the last spot. Join the waitlist instead?"
- CTAs: "Join Waitlist" / "Back to Schedule"
- The schedule view should refresh to show the updated availability.

**Payment failed (Revolut redirect returned an error):**
- Screen shows: credit card with X icon.
- Headline: "Payment didn't go through"
- Body: "Your card was declined or the session timed out. No credits were deducted."
- CTAs: "Try Again" / "Choose Different Method"
- Important: ensure the credit account was NOT credited -- verify via webhook, not redirect status.

**Network error (offline or timeout):**
- Inline banner (not a full-screen takeover): "You're offline. Some features are unavailable."
- Use the existing `OfflineIndicator` component.
- Booking attempts while offline: "Booking requires an internet connection. Please try again when you're connected."
- Check-in attempts while offline: save locally and show "Your check-in will be submitted when you're back online" with a pending indicator.

**Session expired:**
- Full-screen overlay (rare, high severity).
- Headline: "Session expired"
- Body: "Please sign in again to continue."
- CTA: "Sign In" (redirects to Clerk login, preserving the current route for redirect-back).

**Rate limited (unlikely but handled):**
- Inline error below the action button: "Too many requests. Please wait a moment."
- Disable the button for 30 seconds with a countdown.

**Server error (500):**
- Inline error: "Something went wrong on our end. Please try again."
- "Retry" button.
- If retry fails twice: "This issue has been reported. Please try again later." (assumes error logging/monitoring is in place).

---

## Appendix A: Competitive Feature Matrix

| Feature | ClassPass | Mindbody | F45 | Orangetheory | Glofox | TeamUp | Barry's | SoulCycle | CoachFit (Proposed) |
|---------|-----------|----------|-----|-------------|--------|--------|---------|-----------|-------------------|
| Date strip nav | Yes | No (calendar) | Yes | Yes | Yes | No (list) | Yes | Yes | Yes |
| Tap-to-book | 2-tap | 3-tap | 1-tap | 2-tap | 2-tap | 2-tap | 2-tap | 2-tap | 2-tap (card + confirm) |
| Waitlist | Yes | Yes | Limited | Yes | Yes | Yes | Yes | Yes | Yes (auto-promote + claim window) |
| Credit display | On card | In profile | N/A (membership) | N/A | In profile | N/A | On card | On card | Header pill + booking sheet |
| Challenge tracking | No | Limited | Yes (gold standard) | Yes | No | No | No | No | Yes (ring + streak + leaderboard) |
| Coach attendance | N/A | Yes (checkbox) | Yes (scanner) | Yes (HRM auto) | Yes (checkbox) | Yes (checkbox) | N/A | N/A | Yes (toggle + bulk mark) |
| Haptic feedback | Limited | No | No | No | No | No | Yes | Yes | Yes |
| Offline schedule | Yes | No | Yes | No | Limited | No | No | No | Yes (Service Worker) |

## Appendix B: Hitsona-Specific Design Decisions

These decisions are driven by the specific characteristics of Hitsona Bangor:

1. **No seat/spot selection needed.** Unlike SoulCycle (which has numbered bikes) or F45 (numbered stations), Hitsona's HIIT and CORE classes don't have assigned positions. This eliminates the need for a floor plan/seat map component. Simplifies the booking flow significantly.

2. **Two-coach simplicity.** With only Rory and Gav, the instructor filter can be two toggle buttons rather than a dropdown or multi-select. Consider showing both coaches' photos/avatars as filter pills at the top of the schedule.

3. **25-minute uniform duration.** All classes are the same length. No need to display duration prominently or handle variable block heights in the schedule view. This creates a clean, uniform card list.

4. **Small capacity (10-15).** Numeric spots remaining is better than percentage-based indicators. "3 spots left" has more urgency than "70% full" at this scale.

5. **Northern Ireland timezone.** Timezone is Europe/London (GMT/BST). All times should display in local time. The system already stores this in `bookingTimezone` system setting. No multi-timezone complexity needed.

6. **GBP currency.** All prices in pounds sterling. No currency conversion needed. Use "£" prefix consistently.

7. **Tight schedule spacing.** The 06:30 -> 07:00 -> 09:30 pattern means consecutive morning classes are only 30 minutes apart (with a 25-minute class, that's 5 minutes turnover). The coach needs to mark attendance for the 06:30 class during this 5-minute gap. This is why the "Mark All Attended" bulk action (section 2.2) is essential -- it reduces a 10-person attendance task to 2-3 taps.

8. **Low midday utilization.** The 12:30 HIIT slot averaging 2/10 capacity suggests the admin dashboard should flag underperforming time slots. The schedule heatmap (section 3.1) will visualize this clearly.

9. **Community size (~20-30 members).** Everyone knows each other. Leaderboard first names are sufficient. Coach-to-client communication can be more personal. Challenge compliance follow-up is feasible because the coach can literally talk to each person in person.

10. **Revolut-based payments.** No in-app payment processing. The purchase flow must handle the app-to-browser-to-app redirect gracefully (section 1.5). Consider adding Revolut as a recognized payment brand in the UI (show their logo for trust).

---

## Appendix C: Screen Inventory

Total screens/views to build (organized by role and platform):

### Client (iOS App + Mobile Web) -- 14 screens
1. Schedule (date strip + class list)
2. Booking confirmation bottom sheet
3. Waitlist claim bottom sheet
4. My Bookings (upcoming + past)
5. Booking detail card
6. Cancel confirmation dialog
7. Credit balance & transaction history
8. Credit purchase (pack selection)
9. Purchase redirect interstitial
10. Challenge dashboard (ring + streak + leaderboard)
11. Daily check-in form (multi-step)
12. Coach weekly review viewer
13. Profile & settings
14. Notification feed

### Coach (Web responsive) -- 10 screens/views
1. Weekly schedule view
2. Day schedule view
3. Session detail with booking list
4. Attendance marking view
5. Client credit overview table
6. Credit adjustment modal
7. Credit submission approval queue
8. Challenge compliance grid
9. Weekly review writing form
10. Waitlist management (within session detail)

### Admin (Desktop web) -- 8 screens/views
1. System overview dashboard (KPIs + heatmap + alerts)
2. Multi-coach schedule view
3. Credit product management (list + editor)
4. Challenge configuration (list + wizard)
5. Registration monitoring view
6. Revenue analytics
7. Member engagement analytics
8. Existing admin screens (users, audit log, settings -- already built)

**Total new screens: ~32 (14 client + 10 coach + 8 admin)**

---

*End of evaluation. This document is research/analysis only -- no code has been written.*
