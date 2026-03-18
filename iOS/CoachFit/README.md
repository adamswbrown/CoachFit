# CoachFit for iOS

CoachFit is an iOS companion app for the CoachFit coaching platform. It connects clients with their fitness coach by automatically syncing health data from Apple Health and providing a daily check-in interface.

## Features

- **Device Pairing** -- Enter an 8-character code from your coach to link your device
- **Automatic HealthKit Sync** -- Steps, workouts, sleep stages, weight, and height sync automatically in the background
- **Daily Check-In** -- Log calories, sleep quality, perceived stress, and notes for your coach to review
- **Apple Health Auto-Fill** -- Steps and weight from Apple Health are pre-populated in your daily check-in
- **Cronometer Import** -- Import nutrition data (calories, protein, carbs, fat, fiber) from Cronometer CSV exports
- **Offline Support** -- Failed sync requests are queued and retried automatically
- **Background Sync** -- Data syncs via HealthKit observer queries, background app refresh (every 6 hours), and on every foreground entry

## Requirements

- iOS 16.0 or later
- Xcode 15.0 or later
- Apple Developer account (required for HealthKit entitlement)
- A CoachFit coach account at gcgyms.com to generate pairing codes

## Getting Started

1. Open `CoachFit.xcodeproj` in Xcode
2. Select your development team under Signing & Capabilities
3. Build and run on a device or simulator

Note: HealthKit features require a physical device. The simulator supports HealthKit but has limited sample data. You can add test data via the Health app on the simulator.

## How Pairing Works

1. Your coach generates a pairing code from the CoachFit web dashboard at gcgyms.com
2. Open the app and enter the 8-character code
3. The app exchanges the code for a device token via `POST /api/pair`
4. The device token and client ID are stored securely in the iOS Keychain
5. All subsequent API requests are authenticated with the `X-Pairing-Token` header
6. After pairing, the app requests HealthKit permissions and performs a 30-day data backfill

To unpair, go to the More tab and tap "Unpair Device". If the coach revokes access server-side, the app automatically detects the 401 response and returns to the pairing screen.

## HealthKit Permissions

The app requests read-only access to the following HealthKit data types:

| Data Type | Sync Frequency | API Endpoint |
|-----------|---------------|--------------|
| Workouts | Immediate | /api/ingest/workouts |
| Body Mass (weight) | Immediate | /api/ingest/profile |
| Height | On sync | /api/ingest/profile |
| Sleep Analysis | Hourly | /api/ingest/sleep |
| Step Count | Hourly | /api/ingest/steps |

The app never writes data to HealthKit.

## Cronometer Import

To import nutrition data from Cronometer:

1. In the Cronometer app, go to Profile > Settings > Export Data
2. Set your date range and tap "Export Servings"
3. Open the exported CSV in CoachFit (or use the Import tab file picker)
4. Preview the parsed data and confirm the import
5. Data is uploaded to `POST /api/ingest/cronometer`

Supported CSV columns: Date, Energy (kcal), Protein (g), Carbs (g), Fat (g), Fiber (g). The parser handles multiple date formats and quoted fields.

## Architecture

The app uses SwiftUI with the Swift 5.9 Observation framework (`@Observable`). There are no third-party dependencies.

- **AppState** -- Central observable object that owns all services and controls screen routing (pairing vs. home)
- **APIClient** -- Handles all HTTP communication with the gcgyms.com backend
- **KeychainService** -- Securely stores the device token, client ID, and display names
- **HealthKitManager** -- Manages HealthKit authorization, observer queries, background delivery, and data fetching
- **SyncEngine** -- Coordinates syncing all data types in parallel with offline queuing and per-type error tracking
- **CronometerCSVParser** -- Parses Cronometer CSV exports into structured nutrition rows

## Backend API

The app communicates with the CoachFit web platform hosted at `https://gcgyms.com`. All authenticated endpoints require the `X-Pairing-Token` header containing the device token received during pairing.
