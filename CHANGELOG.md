# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-beta.1] - 2026-02-20

First beta release of CoachFit — a coaching platform for fitness professionals to
manage clients, cohorts, check-ins, and training plans.

### Added

#### Core Platform
- Next.js application with Everfit-inspired UI and Tailwind CSS styling
- NextAuth authentication with email/password and Google OAuth sign-in
- JWT-based session management with manual middleware parsing for optimised bundle size
- Role-based access control (CLIENT, COACH, ADMIN) with role switching for multi-role users
- Prisma ORM with PostgreSQL (Railway) and Vercel deployment pipeline
- Vercel Speed Insights integration for real-user performance monitoring

#### Coach Dashboard
- Client list with search, filtering, and attention indicators
- Expected check-ins and check-in window tracking
- Client overview with weight charts, stress trends, and onboarding answers
- Personalized plan cards for coaches viewing client profiles

#### Client Dashboard
- Daily check-in form for weight, sleep, perceived stress, steps, and training
- Weekly questionnaire system (SurveyJS-based) with configurable templates and submission locking
- Self-service settings page with password change and OAuth account management
- GDPR consent management UI in client settings
- Onboarding flow with BMR calculations, activity level mapping, and personalized plans

#### Admin Panel
- User management with search, role assignment, and admin/coach creation modals
- Cohort administration with creation, type configuration, and duration management
- System settings with feature flags (HealthKit, iOS integration)
- Email template management with Tiptap rich-text editor and template fallbacks
- Audit logging with error-type filtering and CSV export
- Admin endpoint to randomize check-in data for testing
- Production cleanup script with admin preservation by email

#### Cohort Management
- Cohort creation with owner and co-coach assignment
- Multi-coach support via CoachCohortMembership model
- Cohort types (e.g., 6-week challenge) and check-in frequency configuration
- Duration configuration and membership duration management
- Client invitation and assignment workflows
- Unique constraint enforcement with deduplication logic

#### Weekly Coach Review Queue
- Priority-based client review queue with attention scoring
- Adherence threshold configuration and missed check-in escalation
- Batch attention recalculation with on-demand refresh
- Configurable missed check-in attention policy
- Recalculate button for manual score refresh

#### HealthKit Integration
- Data ingestion API for workouts, sleep, steps, and weight records
- CORS headers for cross-origin mobile app requests
- Sync strategy with manual data prioritisation over HealthKit entries
- Pagination support for sleep and workout records
- Web UI data explorer with pairing status display
- Admin feature flags to show/hide HealthKit and iOS features

#### Mobile App Pairing
- Client-specific pairing codes with regeneration
- Pairing code validation with expiry handling
- Mobile app pairing status display in admin panel

#### Email System
- Resend integration made production-ready with graceful fallbacks
- Email template schema, service layer, and admin API routes
- Template seeding and deployment tooling
- Dynamic welcome emails sent conditionally on configuration

#### GDPR Compliance
- Data export API for client personal data
- Account deletion workflow with confirmation
- Consent management with signup flow integration
- Consent UI on client settings page

#### Progressive Web App (PWA)
- PWA manifests for coach and client personas with home screen installation
- Service worker with offline caching strategy
- Measurement Tracker standalone PWA (Google Sheets integration) for Gav's account

#### Developer Tooling
- Seed scripts for test data generation, role management, and multi-coach setups
- Grant-role script for admin promotion
- CodeQL security scanning workflow
- Copilot instructions and project guidelines
- Comprehensive documentation suite (user guides, developer docs, contributing guidelines)

### Changed

- Renamed "CoachSync" branding to "CoachFit" throughout the codebase
- Renamed `perceivedEffort` field to `perceivedStress` across the application
- Reduced default session duration from 30 days to 1 hour
- Made all layouts and dashboard pages responsive for mobile and tablet
- Consolidated signup consent into a single checkbox
- Updated invitation messages to prompt users to "sign up" instead of "sign in"
- Decoupled Admin role from Coach role requirement (admins no longer need coach role)
- Preserved existing user roles on OAuth sign-in instead of overwriting
- Optimised database queries with caching for admin and coach dashboards
- Added loading skeletons across dashboards for improved perceived performance
- Consolidated user profile menu for mobile and desktop header layouts

### Fixed

- Reduced Interaction to Next Paint (INP) across all pages using `useMemo`, `startTransition`, and `useCallback` — targeting 6 worst routes identified by Speed Insights
- Google OAuth sign-in errors (missing Account.id UUID, session state casting)
- Middleware bundle size reduced under 1MB by replacing NextAuth imports with manual JWT parsing
- Role-based navigation respects active role for multi-role users across all routes
- Hydration error on cohort page date rendering
- BMI calculation accuracy using most recent height measurement
- Weight trend calculation using first-and-last comparison for improved accuracy
- Proxy cookie detection allowing authjs session cookies through correctly
- Mobile scroll issue on signup page
- Authorization logic for admin access to any cohort and cross-cohort coach access
- Pairing code generation using client's actual coach ID for admin-created codes
- TypeScript type safety across Role enum usage in all API routes

### Removed

- Demo quick-login buttons from the login page
- Sleep quality prompts and related UI elements
- Body fat percentage handling from onboarding process
- Playwright test workflow configuration (temporary)

### Security

- Comprehensive security hardening with Zod input validation on API routes
- Removed password exposure from console output
- CodeQL security scanning GitHub workflow
- Rate limiting and security headers via proxy configuration
- GDPR-compliant data handling with explicit consent tracking

[unreleased]: https://github.com/adamswbrown/CoachFit/compare/v1.0.0-beta.1...HEAD
[1.0.0-beta.1]: https://github.com/adamswbrown/CoachFit/releases/tag/v1.0.0-beta.1
