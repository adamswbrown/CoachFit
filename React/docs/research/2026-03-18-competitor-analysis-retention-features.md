# Competitor Analysis: Retention & Engagement Features

**Date**: 2026-03-18
**Status**: Complete
**Purpose**: Identify high-impact features from competitor fitness apps to improve CoachFit UX, UI, and customer satisfaction

---

## Market Context

- Average fitness app loses 77% of daily active users within 3 days
- Typical Day-1 retention: 30-35%
- Apps with coaching relationships: 65-75% retention at 6 months (Noom) vs 25-30% for traditional fitness apps
- Social/accountability features increase retention by 30%
- Progress visualisation generates 3x more repeat usage than social features

## Competitors Researched

| App | Focus | Relevance to CoachFit |
|-----|-------|----------------------|
| MyFitnessPal | Calorie tracking, streaks | Streak mechanics, gamification |
| Cronometer | Precision nutrition | Custom food UX |
| Noom | Coaching + psychology | Retention through human connection |
| MacroFactor | Algorithm-driven targets | Trend visualisation, adaptive TDEE |
| Caliber | Personal trainer + client | Closest competitor model, video feedback |
| TrueCoach | Coach-client workouts | Compliance tracking, automated alerts |
| TrainHeroic | Cohort-based coaching | Team/group features |
| Lose It! | Weight loss | Quick-add UX, gamification |

---

## Three Recommended Features

### 1. Streak System + Coach Compliance Alerts (SELECTED FOR IMPLEMENTATION)

**What**: Daily streak counter on mobile + coach compliance dashboard on web with 1-day missed check-in alerts and personalised milestone celebrations.

**Who does it well**:
- MyFitnessPal: Tiered badges (7/30/90-day) boost 90-day retention to 24%
- TrueCoach: 7/30/90-day compliance rates, automated risk alerts, proactive coach outreach
- Noom: Most-engaged users lost 25.2% more weight, stayed 2.2x longer

**Evidence**:
- Dual streak-and-milestone systems reduce 30-day churn by 35% (Forrester 2024)
- Users active daily in week 1 are 80% more likely to stay for 6 months
- 68% of users stick with an app when someone responds to their progress

**Implementation complexity**: Low-Medium (1.5-2 weeks)

### 2. Adaptive Trend Dashboard + Coach Annotations (DEFERRED)

**What**: Smoothed trend lines for weight/calories/steps/sleep/stress with coach annotations appearing as inline cards.

**Who does it well**: MacroFactor (120-170% more accurate TDEE), Caliber (coach video walkthroughs)

**Decision**: Deferred — CoachFit already has adaptive trending through the cohort model and weekly reviews. Not worth overcomplicating the mobile app at this stage.

### 3. Async Coach Video/Voice Feedback (DEFERRED)

**What**: 15-60 second video/voice messages from coach in response to check-ins.

**Who does it well**: Caliber ($200/month model, 4.8/5 App Store)

**Decision**: Deferred — this is essentially what the existing cohort model and weekly review with Loom video already provides via the web platform. The coach records Loom feedback, client sees it in their weekly review page.

---

## Existing CoachFit Infrastructure (Web Platform)

### Already Built
- **AttentionScore model**: 0-100 scoring with RED/AMBER/GREEN priority for users, coaches, cohorts
- **Attention scoring engine**: `lib/admin/attention.ts` (940 lines) — calculates compliance from Entry history
- **Coach weekly review**: Weekly summaries with check-in counts, rates, stats, Loom video + notes
- **Adherence thresholds**: Configurable green (6/7 days), amber (3/7 days) minimums
- **Admin attention queue**: `/admin/attention` with priority filtering and auto-refresh
- **Coach client scores**: `/api/coach-dashboard/client-attention-scores` with insights
- **Email infrastructure**: Resend integration with template system and token substitution
- **Audit logging**: All admin actions tracked

### Not Yet Built
- Persistent streak counter (currently calculated on-demand from Entry history)
- Automatic alerts for missed check-ins (email only manual, no push)
- Push notifications to mobile
- Client-facing streak/progress UI on mobile
- Coach-defined custom milestones
- 1-day missed check-in trigger (current threshold is 14+ days for attention scoring)

---

## Sources

- MyFitnessPal Gamification Case Study — Trophy (trophy.so)
- MyFitnessPal Customer Retention Strategy — Propel (trypropel.ai)
- Streaks Feature Gamification Examples — Trophy (trophy.so)
- Noom Engagement Report — GlobeNewsWire (Feb 2026)
- What Noom Can Teach Product Teams About Retention — Kristen Berman (Substack)
- TrueCoach Compliance Tracking — truecoach.co
- TrueCoach Habit Tracking — help.truecoach.co
- Caliber Fitness App Review — BarBend (2026)
- Caliber Reviews — Trustpilot (4.9/5, 880+ reviews)
- MacroFactor Review — Outlift (2026)
- MacroFactor Algorithms — Stronger by Science
- Retention Metrics for Fitness Apps — Lucid
- Mobile App Retention Benchmarks 2025 — Growth-onomics
- Better Visualizing Fitness App Data — University of Washington (2014)
