# Sunday Email / Weekly Check-In Feature

## Client Feedback (from Gav)

> "The only thing I can think to update/change would be a weekly longer check in every week. With the current system I send out an e-mail asking for longer feedback every Sunday and then I use loom to record a response to the check in on Monday if that makes sense."

## Use Case: Weekly Check-In with Video Response

**Current Workflow** (what Gav does manually now):

### Sunday:
- Gav sends email to clients requesting "longer feedback"
- This is different from daily quick check-ins
- Clients respond via email with detailed weekly feedback

### Monday:
- Gav reviews each client's weekly feedback
- Records a personalized Loom video response for each client
- Sends Loom video link back to client

---

**What this replaces:**
- Current daily check-ins = quick metrics (weight, sleep, steps, etc.)
- Weekly check-ins = longer, qualitative feedback + coach video response

**Key elements:**
1. **Timing**: Sunday request, Monday response
2. **Format**: Client writes detailed feedback, coach responds with video
3. **Tool**: Loom for video responses
4. **Frequency**: Once per week

---

## Questions to Clarify with Gav:

1. What specific questions does Gav ask in the Sunday email?
2. How do clients currently respond - free text or structured questions?
3. Where do clients view the Loom videos - email link or somewhere else?
4. Does every client get this weekly check-in, or just certain cohorts/programs?
5. Is this MVP-critical or nice-to-have for later?
6. Should the timing be configurable per client/cohort, or always Sunday?

---

## Potential Implementation

### Database Schema:
```
WeeklyCheckIn model:
- id
- userId (client)
- weekStartDate
- Questions/responses:
  - Overall week rating
  - What went well
  - Challenges faced
  - Goals for next week
  - Questions for coach
- Coach response:
  - Video URL (Loom embed)
  - Text notes
  - Action items
  - Responded at timestamp
  - respondedBy (coachId)
- Status: pending/responded
- createdAt
- updatedAt
```

### UI Components:
- **Client**: Weekly check-in form (available Sundays, or any time if missed)
- **Client**: View past weekly check-ins with coach video responses
- **Coach**: List of pending weekly check-ins to review
- **Coach**: Response form (Loom video embed + text notes)

### Features:
- Email reminder on Sundays (already have email system)
- Dashboard badge/notification for pending weekly check-ins
- Coach dashboard shows "needs response" for new weekly check-ins
- Loom video embedding (simple: paste URL, we embed it)

---

## Current Status

**Not implemented yet** - waiting for clarification from Gav on:
- Exact questions to ask
- Workflow details
- Priority level
