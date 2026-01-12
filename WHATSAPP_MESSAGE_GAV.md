Hey Gav,

I've built a fitness coaching platform that I think aligns with what you were talking about. It's called CoachFit (or CoachSync - still deciding on the name).

**What it does:**
The platform enables fitness coaches to manage clients through a cohort-based system. Coaches can create cohorts (think "Spring 2024 Challenge" or "Weight Loss Group"), invite clients via email, and track their progress in real-time. Clients log daily entries (weight, steps, calories) and coaches get analytics dashboards showing cohort performance and individual client trends.

**URL:** https://coach-fit-theta.vercel.app/

**Login Credentials:**
- **Admin:** admin@test.local / TestPassword123!
- **Coach:** coach@test.local / TestPassword123!
- **Client:** client@test.local / TestPassword123!

**Important:** This is very much pre-alpha. While I consider it more or less what you were talking about, I'm very, very open to suggestions. There are definitely rough edges and things I'd want to refine based on your feedback.

**What's Currently Disabled/Not Fully Implemented:**
- **Email notifications are turned off** - The email system (Resend) is disabled by default. Invitations and welcome emails are logged but not actually sent. This is intentional for testing - I can enable it if you want to see the full flow.
- **No messaging/communication features** - There's no in-app chat, messaging, or notifications system. The interaction is purely data-driven (clients log, coaches view analytics).
- **Apple Sign-In is optional** - Only Google OAuth and email/password are fully set up. Apple Sign-In can be added but isn't configured.
- **UI polish** - Some areas are functional but not fully polished. The analytics charts work but could be more visually refined. Some error states and edge cases might not be perfectly handled.
- **Custom cohort prompts** - The system supports custom check-in prompts per cohort, but the UI for configuring them is basic and could be more intuitive.
- **Multi-cohort clients** - The data model supports it, but the UI currently assumes one cohort per client. This could be expanded.
- **Export/reporting** - No CSV exports, PDF reports, or data export features yet.
- **Mobile optimization** - It's responsive but not fully optimized for mobile-first use. Works on mobile but desktop is the primary experience.

**My Rationale:**
I built it this way because I wanted to solve a few key problems we disucssed with fitness coaching:

1. **Scalability through cohorts** - Instead of 1:1 management, coaches can organize clients into groups. This lets them manage 50+ clients efficiently while still providing personalized attention where needed.

2. **Real-time visibility** - Coaches see client data as it comes in, not just during check-ins. The analytics show trends, adherence rates, and flag clients who need attention.

3. **Flexible relationship model** - Coaches can invite clients globally (then assign them later) or directly to specific cohorts. Clients can be in multiple cohorts if needed, though the current model is one cohort per client.

4. **Client simplicity** - Clients just log their daily numbers. No complex interfaces, no overwhelming dashboards. Just: weight, steps, calories, and optionally sleep quality.

**The Relationship & Interaction Model:**
- **Coaches own cohorts** - Each cohort belongs to one coach, giving them full control over that group
- **Clients are assigned to cohorts** - When a client is invited to a cohort, they're automatically linked to that coach
- **Global invites** - Coaches can also send "global" invites (not tied to a cohort) for clients they want to onboard first, then assign later
- **Data flows one way** - Clients log entries → Coaches see aggregated data → Coaches can view individual client details and analytics
- **Role-based access** - Coaches only see their own clients/cohorts. Admins can see everything and manage the system.

The interaction is intentionally asynchronous - clients log when convenient, coaches review when they have time. No real-time chat or messaging (yet), just data tracking and analytics.

Take a look and let me know what you think. I'm particularly curious about:
- Does the cohort model make sense for your use case?
- Is the data clients log (weight, steps, calories) the right set?
- What's missing that would make this actually useful for you?

Looking forward to your thoughts!
