# CoachFit Work Log

## 2026-02-04: System Notifications Implementation

### Summary
Implemented comprehensive push notification and email notification system for the PWA, enabling scheduled reminders and real-time notifications.

### Features Delivered

#### Notification Types
| Type | Schedule | Channels |
|------|----------|----------|
| Daily Check-in Reminder | User-configurable: Morning (8 AM), Afternoon (2 PM), Evening (6 PM) | Push + Email |
| Weekly Questionnaire | Sunday 9 AM | Push + Email |
| Missed Entry Reminder | Daily 10 AM (if user missed logging) | Push + Email |
| Missed Questionnaire | Tuesday & Thursday 10 AM | Push + Email |
| Coach Note Notification | Immediate (when coach creates note) | Push + Email |

#### User Preferences
Users can configure in `/client-dashboard/settings`:
- Enable/disable each notification type individually
- Choose daily reminder time (morning/afternoon/evening)
- Toggle email notifications on/off
- Toggle push notifications on/off

### Files Created

**Core Infrastructure:**
- `lib/notifications.ts` - Notification service (send push, email, logging)
- `hooks/useNotifications.ts` - React hook for UI subscription management

**API Endpoints:**
- `app/api/notifications/subscribe/route.ts` - Push subscription management
- `app/api/notifications/preferences/route.ts` - User preferences CRUD

**Cron Jobs:**
- `app/api/cron/daily-reminders/route.ts` - Daily check-in reminders
- `app/api/cron/weekly-questionnaire/route.ts` - Sunday questionnaire reminders
- `app/api/cron/missed-entries/route.ts` - Missed entry reminders
- `app/api/cron/missed-questionnaires/route.ts` - Missed questionnaire reminders

**Scripts:**
- `scripts/generate-vapid-keys.ts` - VAPID key generation utility
- `scripts/setup-notification-email-templates.ts` - Resend template setup

**Documentation:**
- `docs/NOTIFICATION_SETUP.md` - Complete setup guide

### Files Modified

**Schema:**
- `prisma/schema.prisma` - Added PushSubscription, NotificationLog models; extended UserPreference

**Service Worker:**
- `public/sw.js` - Added push event handler and notification click handling

**UI:**
- `app/client-dashboard/settings/page.tsx` - Added notification preferences section

**Configuration:**
- `vercel.json` - Added cron job schedules
- `package.json` - Added npm scripts and web-push dependency

**Email:**
- `lib/email-templates.ts` - Added notification email template keys

### Database Changes

New models added:
```prisma
model PushSubscription {
  id, userId, endpoint, p256dh, auth, userAgent, timestamps
}

model NotificationLog {
  id, userId, type, channel, title, body, status, errorMessage, metadata, timestamps
}
```

Extended UserPreference with:
- `dailyReminderEnabled` (default: true)
- `dailyReminderTime` (default: "morning")
- `weeklyReminderEnabled` (default: true)
- `missedEntryReminder` (default: true)
- `missedQuestionnaireReminder` (default: true)
- `coachNoteNotification` (default: true)
- `emailNotifications` (default: true)
- `pushNotifications` (default: true)

### Setup Required

See `docs/NOTIFICATION_SETUP.md` for complete instructions.

**Quick Start:**
```bash
# 1. Generate VAPID keys
npm run notifications:generate-vapid

# 2. Add to .env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public_key>
VAPID_PRIVATE_KEY=<private_key>
VAPID_SUBJECT=mailto:notifications@coachfit.app
CRON_SECRET=<generate_random_secret>

# 3. Setup email templates (optional)
npm run notifications:setup-templates
```

### Dependencies Added
- `web-push` - Web Push notification library
- `@types/web-push` - TypeScript types

### Commits
- `3bf00e8` - Add system notification infrastructure for PWA
- `fd0f9ed` - Add notification system setup documentation

### Branch
`claude/add-system-notifications-Rut1P`

### State
- [x] Schema designed and implemented
- [x] VAPID key generation script created
- [x] Push subscription API endpoints created
- [x] Service worker push handling added
- [x] Notification preferences UI added
- [x] Email templates defined
- [x] Notification service library built
- [x] Cron API endpoints created
- [x] Vercel cron configuration added
- [x] Build passes
- [x] Documentation created
- [ ] **Pending:** Database migration (runs on deploy)
- [ ] **Pending:** VAPID keys need to be generated and added to env
- [ ] **Pending:** CRON_SECRET needs to be added to env
- [ ] **Pending:** Email templates setup in Resend (optional)

### Next Steps
1. Merge PR or push to main
2. Generate VAPID keys: `npm run notifications:generate-vapid`
3. Add environment variables to Vercel
4. Deploy (migration runs automatically)
5. Test notification flow

---

## Previous Work

See `docs/misc/CHANGES.md` for earlier work logs.
