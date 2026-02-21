# Cross-Platform Mobile App Research for CoachFit

**Date**: 2026-02-21
**Status**: Research / Decision Pending
**Context**: CoachFit needs a companion mobile app to collect health data (HealthKit on iOS, Health Connect on Android) and sync it to the existing backend via the `/api/ingest/*` endpoints.

---

## Current State

CoachFit already has a **production-ready HealthKit ingestion backend** with:

| Endpoint | Purpose | Validation |
|----------|---------|------------|
| `POST /api/pair` | Pairing code validation (CORS-enabled, no auth) | 8-char code |
| `POST /api/pairing-codes/generate` | Coach generates pairing codes | COACH/ADMIN role |
| `POST /api/ingest/workouts` | Batch workout ingestion | Zod schema, max 100/request |
| `POST /api/ingest/sleep` | Batch sleep record ingestion | Zod schema, max 400/request |
| `POST /api/ingest/steps` | Batch step data ingestion | Zod schema, max 400/request |
| `POST /api/ingest/profile` | Body metrics (weight, height, body fat) | Zod schema, max 50/request |

**Authentication**: Pairing token (`X-Pairing-Token` header) + `client_id` in body.
**Rate limiting**: Per-client via `lib/security/ingest-auth.ts`.
**Feature flag**: Requires `healthkitEnabled` in SystemSettings.

The mobile app's job is straightforward: read from HealthKit/Health Connect, format data to match the Zod schemas in `lib/validations/healthkit.ts`, and POST to these endpoints.

---

## Frameworks Evaluated

### 1. React Native + Expo (Recommended)

**HealthKit (iOS)** -- Two mature libraries:

- **[@kingstinct/react-native-healthkit](https://github.com/kingstinct/react-native-healthkit)** (recommended)
  - v13.1.4, 556 stars, MIT, actively maintained
  - Full TypeScript, Promise-based API, React hooks
  - Built-in Expo config plugin (zero Xcode configuration)
  - Background delivery support
  - Covers: steps, heart rate, workouts, sleep, calories, distance, body measurements

- **[react-native-health](https://github.com/agencyenterprise/react-native-health)** (alternative)
  - Mature, widely used, Expo config plugin available
  - Being rewritten from Objective-C to Swift

**Health Connect (Android)**:

- **[react-native-health-connect](https://github.com/matinzd/react-native-health-connect)** + **[expo-health-connect](https://github.com/matinzd/expo-health-connect)**
  - Dedicated Expo config plugin
  - Type-safe, 40+ health record types
  - Requires `minSdkVersion=26` (Android 8.0+)
  - Health Connect built into Android 14+; users on 13 need the app installed

**Expo config plugin examples**:

```json
{
  "expo": {
    "plugins": [
      [
        "@kingstinct/react-native-healthkit",
        {
          "NSHealthShareUsageDescription": "CoachFit needs access to read your health data",
          "NSHealthUpdateUsageDescription": "CoachFit needs access to write workout data",
          "background": true
        }
      ],
      "expo-health-connect",
      [
        "expo-build-properties",
        {
          "android": {
            "compileSdkVersion": 35,
            "targetSdkVersion": 35,
            "minSdkVersion": 26
          }
        }
      ]
    ]
  }
}
```

**Solo developer assessment**:

| Factor | Rating | Notes |
|--------|--------|-------|
| TypeScript support | Excellent | Same language as CoachFit web app |
| Learning curve | Low-Medium | React knowledge transfers directly |
| Health data plugins | Excellent | Mature libraries with Expo plugins for both platforms |
| App Store deployment | Excellent | EAS Build handles signing, building, submission in cloud |
| OTA updates | Excellent | EAS Update pushes JS changes without App Store review |
| REST API calls | Trivial | Standard `fetch()` to existing backend |
| Community | Large | Massive npm ecosystem |
| Code sharing with web | High | TypeScript types, Zod schemas, utilities |
| Cost | Free-$19/mo | EAS free tier; Apple Dev $99/yr; Google Play $25 one-time |

**Key advantage**: EAS Build eliminates the need for a Mac to build iOS apps. Cloud builds handle provisioning profiles and certificates automatically.

---

### 2. Flutter

**Health data**: Single unified `health` package covers both HealthKit and Health Connect.

| Factor | Rating | Notes |
|--------|--------|-------|
| TypeScript support | None | Uses Dart -- no code sharing with CoachFit |
| Learning curve | Medium | Dart is approachable but widget tree paradigm differs from React |
| Health data plugins | Good | Single package for both platforms |
| App Store deployment | Good | Standard native toolchains, no EAS equivalent |
| OTA updates | Limited | Shorebird exists but less mature |
| Community | Large | 46% of cross-platform developers (2023 survey) |

**Trade-off**: The unified `health` package is an advantage over React Native's two-library approach, but losing TypeScript code sharing is a significant penalty for a solo developer already deep in the TypeScript ecosystem.

---

### 3. Capacitor (Ionic)

**Health data plugins**:
- **[@capgo/capacitor-health](https://github.com/Cap-go/capacitor-health/)** -- unified plugin for both platforms
- **[capacitor-health-extended](https://github.com/Flomentum-Solutions/capacitor-health-extended)** -- fork with more data types

**The Next.js angle**: Capacitor can wrap your existing Next.js app in a native container, adding native plugins on top. However, this requires `output: 'export'` (static HTML/CSS/JS only) -- no SSR, no API routes, no server components.

| Factor | Rating | Notes |
|--------|--------|-------|
| TypeScript support | Excellent | Web-first, full TypeScript |
| Learning curve | Very Low | Standard web development |
| Health data plugins | Fair | Newer, less tested than RN equivalents |
| App Store deployment | Medium | Standard Xcode/Android Studio builds |
| Code reuse with web | Highest | Can share web components directly |
| Plugin maturity | Risk | Smaller user base, less battle-tested |

**Trade-off**: Highest code reuse but the health data plugin ecosystem is less mature and less proven. For a health app where data reliability is critical, this is a risk.

---

### 4. PWA (Progressive Web App) -- ELIMINATED

**Not viable.** Neither HealthKit nor Health Connect exposes a web API. There is no W3C specification or browser API for accessing health data from phone health stores. PWAs cannot access HealthKit, Health Connect, or related sensors on either platform.

---

### 5. Kotlin Multiplatform (KMP) -- NOT RECOMMENDED

Two small libraries exist ([KHealth](https://github.com/shubhamsinghshubham777/KHealth), [HealthKMP](https://github.com/vitoksmile/HealthKMP)) but:
- No TypeScript -- uses Kotlin
- Small communities, less proven
- Swift/Objective-C interop issues with `kotlin.Result`
- Highest learning curve for a TypeScript developer
- No equivalent to EAS Build

---

## Comparative Matrix

| Framework | HealthKit | Health Connect | TypeScript | Solo Dev | Deploy | Maturity |
|-----------|-----------|---------------|------------|----------|--------|----------|
| **React Native + Expo** | Excellent | Excellent | Native | High | Excellent (EAS) | High |
| **Flutter** | Good | Good | None | Medium | Good | High |
| **Capacitor** | Fair | Fair | Excellent | Very High | Medium | Medium |
| **PWA** | None | None | -- | -- | -- | -- |
| **KMP** | Early | Early | None | Low | Standard | Low |

---

## Recommendation: React Native + Expo

### Why

1. **TypeScript everywhere**: Share types, Zod validation schemas, and utilities between web and mobile. The schemas in `lib/validations/healthkit.ts` define the exact data shapes the mobile app needs to produce.

2. **Backend already built**: The mobile app is purely a data collection client. All ingestion, validation, deduplication, and merging logic already exists in the CoachFit backend.

3. **Expo config plugins eliminate native complexity**: No manual Xcode entitlements, no manual AndroidManifest edits. Add plugins to `app.json` and prebuild.

4. **EAS Build for solo developers**: Cloud builds from any machine, automatic credential management, `eas submit` for store submission. No Mac required for iOS builds.

5. **OTA updates**: Push JS-only bug fixes instantly via EAS Update, bypassing App Store review.

6. **Proven library combination**: `@kingstinct/react-native-healthkit` (iOS) + `react-native-health-connect` + `expo-health-connect` (Android) cover all data types CoachFit ingests.

### Suggested Architecture

```
CoachFit Mobile (React Native + Expo)
├── src/
│   ├── services/
│   │   ├── healthkit.ts          # iOS: read from HealthKit
│   │   ├── health-connect.ts     # Android: read from Health Connect
│   │   ├── health-bridge.ts      # Platform-agnostic interface
│   │   └── api.ts                # POST to CoachFit backend
│   ├── screens/
│   │   ├── PairingScreen.tsx     # Enter pairing code
│   │   ├── SyncStatusScreen.tsx  # Show sync status/history
│   │   └── SettingsScreen.tsx    # Permissions, unpair
│   └── hooks/
│       ├── useHealthData.ts      # Read health data (platform-aware)
│       └── useSync.ts            # Background sync logic
├── app.json                      # Expo config with health plugins
└── shared/                       # Types/schemas shared with web app
```

### Data Flow

```
HealthKit/Health Connect
        ↓ (read via native libraries)
Platform Bridge (healthkit.ts / health-connect.ts)
        ↓ (normalize to common format)
API Service (api.ts)
        ↓ (POST with X-Pairing-Token header)
CoachFit Backend (/api/ingest/*)
        ↓ (validate, deduplicate, merge)
PostgreSQL (Workout, SleepRecord, Entry models)
```

### Caveats to Plan For

1. **Custom Dev Client required**: Cannot use Expo Go for development since health libraries include native code. Must build with `eas build --profile development`.

2. **Physical device testing**: HealthKit does not work in iOS Simulator. Health Connect is unreliable in Android emulators. Budget for physical device testing.

3. **Google Play Health Connect declaration**: Google requires a declaration form for Health Connect permissions. Approval takes 7-14 business days. Submit this early. Fitness/wellness tracking is an approved use case.

4. **Apple Developer account**: $99/year required for App Store distribution and TestFlight.

5. **Two separate health libraries**: Unlike Flutter's single `health` package, React Native requires separate libraries for iOS (`@kingstinct/react-native-healthkit`) and Android (`react-native-health-connect`). You'll need a platform bridge that abstracts these behind a common interface.

6. **Background sync**: Both platforms have restrictions on background execution. HealthKit supports background delivery via observer queries. Health Connect requires WorkManager for periodic sync. Both need careful battery optimization.

7. **Google Fit is sunset**: Google Fit SDK is deprecated (2026 sunset). Health Connect is the only path forward for Android.

---

## Next Steps (if proceeding with React Native + Expo)

1. **Scaffold the Expo project** with TypeScript template
2. **Configure health plugins** in `app.json`
3. **Build the platform bridge** abstracting HealthKit and Health Connect behind a common interface
4. **Implement pairing flow** using existing `POST /api/pair` endpoint
5. **Implement sync service** that reads health data and POSTs to `/api/ingest/*` endpoints
6. **Set up EAS Build** for cloud builds and testing
7. **Submit Google Play Health Connect declaration** early
8. **Test on physical devices** (iPhone + Android phone)
9. **Deploy to TestFlight (iOS) and Internal Testing (Android)**

---

## Sources

- [@kingstinct/react-native-healthkit](https://github.com/kingstinct/react-native-healthkit)
- [react-native-health](https://github.com/agencyenterprise/react-native-health)
- [react-native-health-connect](https://github.com/matinzd/react-native-health-connect)
- [expo-health-connect](https://github.com/matinzd/expo-health-connect)
- [React Native Health Connect Docs](https://matinzd.github.io/react-native-health-connect/docs/intro/)
- [Google Play Health Connect Policy (March 2025)](https://asoworld.com/blog/google-play-health-connect-policy-update-march-2025/)
- [Flutter health package](https://pub.dev/packages/health)
- [@capgo/capacitor-health](https://github.com/Cap-go/capacitor-health/)
- [KHealth (KMP)](https://github.com/shubhamsinghshubham777/KHealth)
- [HealthKMP](https://github.com/vitoksmile/HealthKMP)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Expo App Store Deployment](https://docs.expo.dev/deploy/build-project/)
