# CoachFit Mobile Apps

This directory contains mobile app source code for CoachFit.

## Directory Structure

### `/ios/`
**CoachFit Sync iOS App** (SwiftUI)

The main iOS application that syncs health data from Apple HealthKit to CoachFit.

- **Source:** Forked from GymDashSync project
- **Platform:** iOS 14.0+
- **Language:** Swift 5
- **Framework:** SwiftUI
- **Key Features:**
  - Apple HealthKit integration
  - Background data sync
  - Device pairing with CoachFit accounts
  - Automatic workout, weight, height tracking

**Key Files:**
- `GymDashSync/GymDashSyncApp.swift` - Main app entry point
- `GymDashSync/ContentView.swift` - Main UI
- `GymDashSync/PairingView.swift` - Device pairing flow
- `GymDashSync/NetworkService.swift` - HTTP client for CoachFit API
- `GymDashSync/ExternalObjects.swift` - HealthKit data mappers
- `GymDashSync/GymDashExternalStore.swift` - Health Data Sync integration

**To Build:**
1. Open `GymDashSync.xcodeproj` in Xcode
2. Select target device/simulator
3. Build and run (⌘R)

**To Deploy:**
- See [IOS_APP_INTEGRATION_PLAN.md](../IOS_APP_INTEGRATION_PLAN.md) Phase 5

---

### `/ios-health-data-sync/`
**Microsoft Health Data Sync Library**

Core HealthKit synchronization library from Microsoft's open-source project.

- **Source:** [microsoft/health-data-sync](https://github.com/microsoft/health-data-sync)
- **License:** MIT
- **Purpose:** Provides robust HealthKit querying, background sync, and data management

This library handles:
- HealthKit authorization
- Background query observers
- Incremental sync
- Data deduplication
- Error recovery

**Integration:**
The CoachFit Sync app (`/ios/`) depends on this library and extends it with custom external objects for workouts, body metrics, steps, and sleep.

---

## Development Setup

### Prerequisites
- macOS with Xcode 14+ installed
- Apple Developer account (for device testing)
- CoachFit backend running locally or on staging

### Environment Configuration

**Local Development:**
Update `NetworkService.swift` base URL:
```swift
private let baseURL = "http://localhost:3000" // Local CoachFit backend
```

**Staging:**
```swift
private let baseURL = "https://staging.coachfit.com" // Staging backend
```

**Production:**
```swift
private let baseURL = "https://coach-fit-38pw.vercel.app" // Production backend
```

### Running Locally

1. **Start CoachFit backend:**
   ```bash
   cd /path/to/CoachFit/Web
   npm run dev
   ```

2. **Open iOS app in Xcode:**
   ```bash
   cd mobile/ios
   open GymDashSync.xcodeproj
   ```

3. **Build and run** in Simulator (⌘R)

4. **Test pairing:**
   - Generate pairing code in web app (client dashboard)
   - Enter code in iOS app
   - Grant HealthKit permissions
   - Start sync

---

## Testing

### Simulator Testing
- HealthKit data must be added manually in Health app
- Use Health app's "Browse → Add Data" to create sample workouts, weight, etc.

### Device Testing
- Requires paid Apple Developer account
- Configure signing in Xcode
- Install on physical device
- Real HealthKit data will be synced

### Integration Testing
See [IOS_APP_INTEGRATION_PLAN.md](../IOS_APP_INTEGRATION_PLAN.md) Phase 2.6

---

## Future Plans

### Android App (Not Started)
- Google Fit integration
- Kotlin/Jetpack Compose
- Similar architecture to iOS app
- Target directory: `/mobile/android/`

---

## Related Documentation

- **Integration Plan:** [IOS_APP_INTEGRATION_PLAN.md](../IOS_APP_INTEGRATION_PLAN.md)
- **Feasibility Analysis:** [IOS_APP_INTEGRATION_FEASIBILITY.md](../IOS_APP_INTEGRATION_FEASIBILITY.md)
- **GitHub Issue:** [#3 - iOS App Integration](https://github.com/adamswbrown/CoachFit/issues/3)
- **GymDashSync README:** `/mobile/ios/GymDashSync/` (original project docs)

---

## License

### CoachFit Sync App (`/ios/`)
Copyright © 2026 CoachFit
All rights reserved.

### Microsoft Health Data Sync Library (`/ios-health-data-sync/`)
MIT License - Copyright (c) Microsoft Corporation
See `/mobile/ios-health-data-sync/LICENSE` for details

---

*Last updated: 2026-01-13*
