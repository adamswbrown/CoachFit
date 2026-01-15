# Copilot Instructions for iOS Health Data Sync (mobile)

## 🚀 Project Philosophy
- **Parallel, full-stack batches:** Major changes require a GitHub issue and implementation plan; small changes are documented in PRs.
- **MVP > Perfection:** Ship working, testable features before refining.

## 🏗️ Architecture Overview
- **Platform:** iOS (Swift, SwiftUI)
- **HealthKit Integration:** Collects steps, sleep, and other health data
- **Sync:** Communicates with CoachFit backend via REST endpoints
- **Project Structure:**
  - `Sources/` — Main app and sync logic
  - `Tests/` — Unit tests
  - `ios/` — Xcode project for app UI
  - `ios-health-data-sync/` — HealthKit sync engine (Swift Package)

## 🛠️ Developer Workflows
- **Build:** Use Xcode workspace (`GymDashSync.xcodeproj` or `HealthDataSync.xcworkspace`)
- **Test:** Run tests in `Tests/` via Xcode
- **Sync:** Update HealthKit permissions and sync logic in `Sources/`
- **CI:** Azure Pipelines and GitHub Actions for PR checks

## 🧩 Conventions & Patterns
- **HealthKit permissions:** Managed in `HDSPermissionsManager.swift`
- **Sync logic:** Implemented in `HDSManager.swift` and `Synchronizers/`
- **Pairing:** Handled in `PairingView.swift` and backend `/api/pair` endpoint
- **No direct DB:** All data syncs via REST, not local DB
- **Test coverage:** Add/maintain tests in `Tests/` for all new logic

## 📚 Reference Files
- `README.md` — Project intro, setup, and usage
- `Sources/HDSManager.swift` — HealthKit sync logic
- `Sources/HDSPermissionsManager.swift` — Permissions
- `Sources/PairingView.swift` — Device pairing
- `Tests/` — Unit tests

---

**For more, see:**
- `CONTRIBUTING.md` (contribution guide)
- `SECURITY.md` (security practices)

_Last updated: January 2026_
