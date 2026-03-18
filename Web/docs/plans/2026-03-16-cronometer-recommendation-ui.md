# Cronometer Recommendation UI

**Date:** 2026-03-16
**Status:** Approved

## Context

Gav's feedback: don't require clients to pay for Cronometer. Manual calorie input should be the default. Cronometer is recommended as an optional tool for accurate tracking.

## Changes

### 1. Check-in form (client-dashboard/page.tsx)

Add hint text below the calories input field:

> "For accurate calorie tracking, we recommend [Cronometer](https://cronometer.com) (free). You can [import your data](/client-dashboard/import) anytime."

Small grey text, same style as other form hints.

### 2. Onboarding plan review (onboarding/client/page.tsx)

In the plan review step, below the daily calorie target number:

> "To track your daily intake accurately, we recommend using a free app like [Cronometer](https://cronometer.com). You can import your data into CoachFit later."

Small grey text, informational only.

## What doesn't change

- No new components
- No new API calls
- No new database fields
- Cronometer import page stays as-is
- Manual calorie entry remains the default path
