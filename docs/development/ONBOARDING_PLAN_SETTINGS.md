# Onboarding & Plan Settings Update Process

## Overview
This document describes how to update onboarding and personalized plan settings, validation, and UI logic for CoachFit. All onboarding and plan logic is now settings-driven and robust to future changes.

## Key Changes
- Activity levels clarified and expanded to 5 levels
- Biological sex includes "Prefer not to say" option
- Body fat % self-identification removed
- "Add calories back" option removed
- Coaches always work in lbs/inches; all data converted for coach-facing features
- Personalized plan output simplified (only daily calories and steps)
- Personalized plan is coach-only, not shown to members

## Updating Settings
- All unit logic (lbs/inches) and activity levels are defined in `Web/lib/system-settings.ts`
- To change activity levels, update the array in `system-settings.ts` and `validations.ts`
- To change default units, update the settings in `system-settings.ts` and onboarding UI
- To add/remove onboarding fields, update `Web/lib/validations.ts` and onboarding UI components

## Validation & Warnings
- Validation schemas in `Web/lib/validations.ts` enforce correct values and required fields
- If a required setting is missing or misconfigured, onboarding and plan logic will show a warning or fallback to defaults
- Add runtime checks in `system-settings.ts` for required config

## Documentation & Maintenance
- All onboarding and plan changes should be documented here and in code comments
- When updating onboarding or plan logic, always update:
  - Validation schemas (`Web/lib/validations.ts`)
  - UI components (`Web/app/onboarding/client/page.tsx`, etc.)
  - System settings (`Web/lib/system-settings.ts`)
  - Tests and docs
- For new features, ensure settings are configurable and not hardcoded

## Example: Adding a New Activity Level
1. Update the activity level array in `Web/lib/system-settings.ts`
2. Update the Zod enum in `Web/lib/validations.ts`
3. Update onboarding UI to show the new option
4. Add tests for the new activity level
5. Document the change here

## Troubleshooting
- If onboarding or plan logic fails, check for missing or misconfigured settings in `system-settings.ts`
- Use default values or show warnings if settings are not found

## Contact
For questions or updates, contact the CoachFit maintainers.
