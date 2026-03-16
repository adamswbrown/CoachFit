# Plan: CoachFit iOS Companion App

**Date:** 2026-03-16
**Status:** Approved design — ready for implementation planning
**Estimated effort:** 60-80 hours

## What it is

A SwiftUI companion app for gym members/clients. Handles three things: background HealthKit sync, quick daily check-ins, and Cronometer CSV import. Everything else (questionnaires, charts, settings, coach features) stays on the web — the app deep-links to gcgyms.com when needed.

This is a client-only app. Coaches use the web dashboard exclusively.

## Authentication

Single mechanism: pairing code. Coach generates an 8-char code on the web dashboard, client enters it in the app on first launch. The app stores a persistent device token in Keychain and uses it for all API requests via the `X-Pairing-Token` header.

No Clerk SDK, no Google sign-in, no passwords on mobile. Invited-only — you can't use the app unless a coach has generated a code for you.

On successful pair, `POST /api/pair` returns user info and a long-lived device token. The app stores this and uses it for all subsequent requests.

## Screens

### First launch
1. Welcome screen with CoachFit logo
2. "Enter your pairing code" — single text field, 8 characters
3. App calls `POST /api/pair` → gets back user ID, name, coach name
4. Token stored in Keychain. Shows "Welcome, {name}!" then lands on home screen
5. Invalid/expired code → error message, try again

### Home (tab bar, 3 tabs)

**Tab 1 — Today**
- Today's check-in form: weight, steps, calories, sleep quality, perceived stress, notes
- If already submitted today, shows the entry with an "Edit" option
- Below the form: last 5 entries as a simple list (date, weight, steps, calories)
- Cronometer hint below calories field (same text as web)

**Tab 2 — Import**
- "Import from Cronometer" button
- Opens iOS file picker (CSV files)
- Parses CSV, shows preview of rows to import
- Confirms and uploads via API

**Tab 3 — More**
- Sync status: last HealthKit sync time, connected/disconnected badge
- "View full dashboard" → opens Safari to gcgyms.com/client-dashboard
- "Answer questionnaire" → opens Safari to gcgyms.com/client-dashboard
- "Unpair device" → confirms, clears Keychain, returns to pairing screen
- App version

No settings screen, no charts, no coach features. Detail lives on the web.

## HealthKit integration

**Permissions requested after pairing:**
- Step count
- Workouts (all types)
- Sleep analysis
- Body mass (weight)
- Height

**Background sync via HealthKit background delivery:**

| Data | Endpoint | Trigger |
|------|----------|---------|
| Workouts | `POST /api/ingest/workouts` | On new workout |
| Sleep | `POST /api/ingest/sleep` | On new sleep record |
| Steps | `POST /api/ingest/steps` | Daily midnight rollup |
| Weight | `POST /api/ingest/profile` | On new measurement |

**Deduplication:** Server-side via unique constraints. App can safely re-send.

**Initial sync:** After pairing, backfill last 30 days of HealthKit data.

**Offline handling:** Queue failed requests locally (UserDefaults array), retry on next sync.

## API changes needed (backend)

Three additions to the existing backend:

### 1. `POST /api/ingest/entry`
Daily check-in submission via pairing token auth. Same validation as `POST /api/entries` but uses `X-Pairing-Token` instead of Clerk session. Follows existing ingest auth pattern.

### 2. `POST /api/ingest/cronometer`
Cronometer CSV import via pairing token auth. Same logic as `POST /api/import/cronometer` but with ingest auth.

### 3. Extend `POST /api/pair` response
Return a persistent device token (not the 15-min pairing code). Stored against the PairingCode record. App uses this for all future requests.

Everything else (workout, sleep, steps, profile ingest) already works with pairing token auth.

## What's NOT in v1

- Push notifications (email reminders already work)
- Charts or analytics (use the web)
- Questionnaire answering (deep-link to web)
- Coach features (web only)
- Android version
- Apple Watch app

## Tech stack

- SwiftUI (iOS 16+)
- HealthKit framework
- URLSession for networking
- Keychain for token storage
- No third-party dependencies if possible

## Existing backend infrastructure (already built)

All of these endpoints are production-ready:
- `POST /api/pair` — pairing code validation
- `POST /api/ingest/workouts` — workout sync
- `POST /api/ingest/sleep` — sleep sync
- `POST /api/ingest/steps` — step sync
- `POST /api/ingest/profile` — body metrics sync
- `POST /api/import/cronometer` — CSV import (needs pairing token variant)
- `POST /api/entries` — check-in submission (needs pairing token variant)
- `lib/healthkit/pairing.ts` — pairing code generation/validation
- `lib/security/ingest-auth.ts` — pairing token auth middleware
