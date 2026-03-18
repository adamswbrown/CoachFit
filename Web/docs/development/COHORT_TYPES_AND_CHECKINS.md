# Cohort Types, Check-Ins, and Migration

## Cohort Types

CoachFit cohorts now support a first-class `type`:

- **Timed**: Fixed-duration programs (default for legacy cohorts after migration).
- **Ongoing**: Continuous memberships without an end date.
- **Challenge**: Time-bound challenges with a specific outcome.
- **Custom**: Admin-defined types (label + description).

Custom cohort types are managed by admins at `/admin/cohort-types`. Cohorts can reference a custom type and optionally override the display label.

## Check-In Frequency Hierarchy

Effective check-in frequency is resolved in the following order:

1. **Cohort override**: `Cohort.checkInFrequencyDays`
2. **User override**: `User.checkInFrequencyDays`
3. **System default**: `SystemSettings.defaultCheckInFrequencyDays`

This value is used for reminder scheduling, engagement calculations, and dashboard expectations.

## Reminder Timing Rules (UTC)

All reminders are scheduled globally using **`SystemSettings.notificationTimeUtc`** (HH:mm, UTC):

- **Scheduled reminders** fire on the expected check-in day.
- **Missed reminders** fire once the expected check-in day passes.

## Migration Flow (Legacy Cohorts)

Legacy cohorts (those without a `type`) require migration:

1. **Update**: Admin sets type, optional custom type, and check-in frequency.
2. **Skip**: Admin applies defaults (Timed + system frequency).
3. **Cancel**: Migration is aborted and logged; cohort remains blocked.

All migration actions are logged in the audit log.

## Audit Log Reference

Audit log entries are available at `/admin/audit-log`. Actions relevant to cohort types and migration include:

- `custom_cohort_type_created`
- `custom_cohort_type_updated`
- `custom_cohort_type_deleted`
- `cohort_migration_updated`
- `cohort_migration_skipped`
- `cohort_migration_cancelled`
