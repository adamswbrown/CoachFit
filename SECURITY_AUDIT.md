# CoachFit Security Audit Report

**Audit Date:** 2026-01-31
**Auditor:** Claude Security Review
**Codebase Version:** Commit 41434ab

---

## Executive Summary

This security audit of the CoachFit application identified **4 critical vulnerabilities**, **4 high-severity issues**, **5 medium-severity concerns**, and **3 low-severity findings**. The most severe issues involve **unauthenticated API endpoints** that allow arbitrary data injection for any user and **overly permissive CORS configurations** that enable cross-site attacks.

**Immediate action is required** on the critical vulnerabilities before any production deployment.

---

## Critical Vulnerabilities

### 1. CRITICAL: Unauthenticated HealthKit Data Ingestion Endpoints

**Severity:** Critical
**CVSS Score:** 9.8 (Critical)
**Affected Files:**
- `app/api/ingest/workouts/route.ts`
- `app/api/ingest/steps/route.ts`
- `app/api/ingest/sleep/route.ts`
- `app/api/ingest/profile/route.ts`

**Description:**
The HealthKit data ingestion endpoints have **no authentication whatsoever**. Any attacker who knows (or guesses) a valid user UUID can inject arbitrary health data into that user's account.

**Proof of Concept:**
```bash
# Attacker can inject fake workout data for any user
curl -X POST https://coachfit.example.com/api/ingest/workouts \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "victim-user-uuid-here",
    "workouts": [{
      "workout_type": "Running",
      "start_time": "2026-01-31T10:00:00Z",
      "end_time": "2026-01-31T11:00:00Z",
      "duration_seconds": 3600,
      "calories_active": 500
    }]
  }'
```

**Impact:**
- Complete data integrity compromise for all users
- Coaches receive manipulated client data
- Health decisions based on false data
- Potential legal liability for fitness advice based on fake data

**Remediation:**
1. Implement authentication for all `/api/ingest/*` endpoints
2. Require valid pairing code validation before accepting data
3. Add rate limiting to prevent bulk data injection
4. Consider signed request verification from iOS app

---

### 2. CRITICAL: Overly Permissive CORS Configuration

**Severity:** Critical
**CVSS Score:** 8.1 (High)
**Affected Files:**
- `app/api/pair/route.ts`
- `app/api/ingest/workouts/route.ts`
- `app/api/ingest/steps/route.ts`
- `app/api/ingest/sleep/route.ts`
- `app/api/ingest/profile/route.ts`

**Description:**
Multiple API endpoints return `Access-Control-Allow-Origin: *`, allowing any website to make cross-origin requests to these endpoints.

**Code Evidence:**
```typescript
// app/api/ingest/workouts/route.ts:122-124
response.headers.set('Access-Control-Allow-Origin', '*')
response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
```

**Impact:**
- Enables cross-site request forgery (CSRF) attacks
- Malicious websites can silently call these APIs
- Combined with lack of authentication, allows complete data manipulation

**Remediation:**
1. Replace `*` with specific allowed origins (e.g., iOS app bundle identifier scheme)
2. Implement proper CORS configuration in Next.js middleware
3. Add CSRF token validation for state-changing operations

---

### 3. CRITICAL: Missing Route Protection Middleware

**Severity:** Critical
**CVSS Score:** 8.6 (High)
**Expected File:** `middleware.ts` (does not exist)

**Description:**
The `CLAUDE.md` documentation mentions middleware for route protection, but **no middleware.ts file exists**. All authentication relies on individual API route implementations, meaning any route that forgets to check authentication is vulnerable.

**Evidence:**
The ingest endpoints demonstrate what happens when routes don't implement auth checks - they become completely exposed.

**Impact:**
- No centralized authentication enforcement
- Easy to introduce unauthenticated routes accidentally
- No consistent JWT validation across routes

**Remediation:**
1. Create `middleware.ts` with authentication checks for protected routes
2. Define explicit public routes whitelist
3. Implement role-based route protection at middleware level

```typescript
// Recommended middleware.ts structure
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicPaths = ['/login', '/signup', '/api/auth', '/api/public']
const ingestPaths = ['/api/ingest/'] // Should require pairing validation

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if path requires authentication
  if (!publicPaths.some(p => pathname.startsWith(p))) {
    // Validate JWT token
    const token = request.cookies.get('next-auth.session-token')
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}
```

---

### 4. CRITICAL: Admin Override Backdoor

**Severity:** Critical
**CVSS Score:** 7.5 (High)
**Affected Files:**
- `lib/permissions-server.ts`
- `prisma/schema.prisma` (SystemSettings.adminOverrideEmail)

**Description:**
The application implements an admin override mechanism that grants admin privileges to any user whose email matches either:
1. The `ADMIN_OVERRIDE_EMAIL` environment variable
2. The `adminOverrideEmail` field in SystemSettings table

**Code Evidence:**
```typescript
// lib/permissions-server.ts:12-31
async function checkAdminOverride(email: string): Promise<boolean> {
  const envOverrideEmail = process.env.ADMIN_OVERRIDE_EMAIL
  if (envOverrideEmail && envOverrideEmail.toLowerCase() === email.toLowerCase()) {
    return true
  }
  const settings = await db.systemSettings.findFirst()
  if (settings?.adminOverrideEmail?.toLowerCase() === email.toLowerCase()) {
    return true
  }
  return false
}
```

**Impact:**
- Environment variable leakage grants attacker admin access
- Database compromise allows setting arbitrary admin email
- No audit trail when admin override is used
- Bypasses normal role assignment process

**Remediation:**
1. Remove or severely restrict admin override functionality
2. If kept, require additional verification (2FA, IP whitelist)
3. Add comprehensive audit logging for override usage
4. Consider time-limited override tokens instead

---

## High Severity Issues

### 5. HIGH: Missing Rate Limiting

**Severity:** High
**CVSS Score:** 6.5 (Medium)
**Affected:** All API endpoints

**Description:**
No rate limiting is implemented on any API endpoints, making the application vulnerable to:
- Brute force attacks on login
- Credential stuffing attacks
- DoS through bulk API calls
- Email bombing via invitation endpoints

**Remediation:**
1. Implement rate limiting middleware (e.g., using `@upstash/ratelimit`)
2. Add specific limits for:
   - Login attempts: 5/minute per IP
   - Password changes: 3/hour per user
   - Invitations: 20/hour per coach
   - Data ingestion: 100 requests/minute per client

---

### 6. HIGH: Weak Password Policy

**Severity:** High
**CVSS Score:** 5.9 (Medium)
**Affected Files:**
- `lib/validations.ts`
- `app/api/auth/signup/route.ts`

**Description:**
The password policy only requires 8 characters minimum with no complexity requirements.

**Code Evidence:**
```typescript
// lib/validations.ts:123
password: z.string().min(8, "Password must be at least 8 characters"),
```

**Remediation:**
1. Require minimum 12 characters
2. Add complexity requirements (uppercase, lowercase, number, symbol)
3. Check against common password lists
4. Implement password strength indicator in UI

```typescript
export const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain uppercase letter")
  .regex(/[a-z]/, "Password must contain lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character")
```

---

### 7. HIGH: Information Leakage in Error Responses

**Severity:** High
**CVSS Score:** 5.3 (Medium)
**Affected Files:** Multiple API routes

**Description:**
Error responses leak implementation details that could aid attackers.

**Code Evidence:**
```typescript
// app/api/cohorts/[id]/route.ts:376
{ error: "Internal server error", details: process.env.NODE_ENV === "development" ? errorMessage : undefined }

// app/api/entries/route.ts:131-133
return NextResponse.json(
  { error: "Internal server error", message: error?.message || "Unknown error" },
```

**Impact:**
- Development mode exposes full error details
- Even in production, some error messages leak
- Zod validation errors reveal schema structure

**Remediation:**
1. Never expose internal error details to clients
2. Use generic error messages for all responses
3. Log detailed errors server-side only
4. Remove `message` field from error responses

---

### 8. HIGH: Weak Pairing Code Generation

**Severity:** High
**CVSS Score:** 5.9 (Medium)
**Affected Files:**
- `lib/healthkit/pairing.ts`

**Description:**
Pairing codes use `Math.random()` which is not cryptographically secure, and the codes are only 6 alphanumeric characters.

**Code Evidence:**
```typescript
// lib/healthkit/pairing.ts:17-24
export function generatePairingCode(): string {
  let code = ""
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * PAIRING_CODE_CHARS.length)
    code += PAIRING_CODE_CHARS[randomIndex]
  }
  return code
}
```

**Impact:**
- ~887 million possible codes can be brute-forced
- `Math.random()` is predictable in some environments
- 24-hour validity window increases attack surface

**Remediation:**
1. Use `crypto.randomBytes()` for secure random generation
2. Increase code length to 8-10 characters
3. Add rate limiting on pairing attempts
4. Reduce validity window to 15-30 minutes

```typescript
import { randomBytes } from 'crypto'

export function generatePairingCode(): string {
  const bytes = randomBytes(6) // 48 bits of entropy
  let code = ''
  for (const byte of bytes) {
    code += PAIRING_CODE_CHARS[byte % PAIRING_CODE_CHARS.length]
  }
  return code
}
```

---

## Medium Severity Issues

### 9. MEDIUM: No Session Invalidation on Password Change

**Severity:** Medium
**CVSS Score:** 4.3 (Medium)
**Affected Files:**
- `app/api/client/change-password/route.ts`
- `app/api/admin/users/[id]/reset-password/route.ts`

**Description:**
When a user's password is changed, existing JWT sessions remain valid until they expire. This means a compromised session continues to work even after password change.

**Remediation:**
1. Implement session token versioning
2. Store password change timestamp in JWT
3. Invalidate all sessions on password change
4. Consider using database-backed sessions

---

### 10. MEDIUM: OAuth Account Linking Vulnerability

**Severity:** Medium
**CVSS Score:** 5.4 (Medium)
**Affected Files:**
- `lib/auth.ts` (signIn callback)

**Description:**
When a user signs in via OAuth with an email that matches an existing user, the code deletes the temporary OAuth user and links the account to the existing user. This could potentially allow account takeover.

**Code Evidence:**
```typescript
// lib/auth.ts:162-196
if (existingUser && existingUser.id !== user.id) {
  await db.user.delete({ where: { id: user.id } })
  await db.account.create({
    data: { userId: existingUser.id, ... }
  })
  user.id = existingUser.id
}
```

**Impact:**
- If OAuth provider email can be spoofed, allows account takeover
- Relies entirely on OAuth provider's email verification

**Remediation:**
1. Require email verification before linking accounts
2. Send notification email when new OAuth provider is linked
3. Require re-authentication before linking

---

### 11. MEDIUM: IDOR in HealthKit Data Access

**Severity:** Medium
**CVSS Score:** 4.9 (Medium)
**Affected Files:**
- `app/api/healthkit/workouts/route.ts`

**Description:**
The HealthKit workouts endpoint checks if a client's `invitedByCoachId` matches the requesting coach. However, the client might be in cohorts owned by other coaches (via the co-coach system), potentially allowing unauthorized access.

**Code Evidence:**
```typescript
// app/api/healthkit/workouts/route.ts:46-56
if (!isAdmin(session.user)) {
  const client = await db.user.findUnique({
    where: { id: clientId },
    select: { invitedByCoachId: true },
  })
  if (!client || client.invitedByCoachId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
}
```

**Remediation:**
1. Check cohort membership and co-coach relationships
2. Use consistent authorization logic across all client data endpoints

---

### 12. MEDIUM: Test User Email Detection Bypass

**Severity:** Medium
**CVSS Score:** 3.7 (Low)
**Affected Files:**
- Multiple files checking for `.test.local` or `.local` email suffixes

**Description:**
Test users are identified by email suffix (`.test.local` or `.local`). Emails to test users are suppressed. An attacker could register with these suffixes to avoid email notifications.

**Remediation:**
1. Use a database flag (`isTestUser`) consistently
2. Don't allow public registration with test domains
3. Block `.local` domain registrations

---

### 13. MEDIUM: Soft Delete Email Collision

**Severity:** Medium
**CVSS Score:** 4.0 (Medium)
**Affected Files:**
- `app/api/user/delete-account/route.ts`

**Description:**
Soft delete changes user's email to `deleted_{id}@deleted.local`. The original email is freed, allowing re-registration. The deleted account data could be restored to the wrong user.

**Remediation:**
1. Keep original email stored separately for recovery
2. Prevent re-registration of recently deleted emails for 30 days
3. Use `isDeleted` flag instead of email modification

---

## Low Severity Issues

### 14. LOW: bcrypt Cost Factor

**Severity:** Low
**CVSS Score:** 2.4 (Low)
**Affected Files:**
- `app/api/auth/signup/route.ts`
- `app/api/client/change-password/route.ts`
- `app/api/admin/users/[id]/reset-password/route.ts`

**Description:**
bcrypt uses 10 rounds (cost factor). While adequate, 12 rounds provides better security margin.

**Remediation:**
Increase to 12 rounds: `bcrypt.hash(password, 12)`

---

### 15. LOW: Missing Security Headers

**Severity:** Low
**CVSS Score:** 3.1 (Low)
**Affected:** Application-wide

**Description:**
No explicit security headers configuration found:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

**Remediation:**
Add security headers in `next.config.js`:

```javascript
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]
```

---

### 16. LOW: Console Logging of Sensitive Information

**Severity:** Low
**CVSS Score:** 2.0 (Low)
**Affected:** Multiple files

**Description:**
Error logging in production may include sensitive information in stack traces.

**Remediation:**
1. Use structured logging (e.g., pino)
2. Sanitize logs to remove PII
3. Configure log levels based on environment

---

## Positive Security Findings

The audit also identified several good security practices:

1. **Proper use of Prisma ORM** - Prevents SQL injection
2. **Zod input validation** - Consistent schema validation
3. **bcrypt for password hashing** - Industry standard
4. **Role-based access control** - Well-structured permissions
5. **Audit logging** - AdminAction model tracks sensitive operations
6. **Email template token whitelist** - Prevents template injection
7. **HTML escaping in emails** - XSS prevention in email content
8. **Cascade deletes configured** - Proper data cleanup

---

## Remediation Priority

### Immediate (Before Production)
1. Add authentication to `/api/ingest/*` endpoints
2. Fix CORS configuration
3. Create middleware.ts for route protection
4. Review/remove admin override backdoor

### Short-term (Within 2 weeks)
5. Implement rate limiting
6. Strengthen password policy
7. Fix pairing code generation
8. Add security headers

### Medium-term (Within 1 month)
9. Session invalidation on password change
10. Review OAuth account linking
11. Fix IDOR issues
12. Improve error handling

### Long-term (Ongoing)
13. Regular dependency audits
14. Penetration testing
15. Security training for developers

---

## Appendix: Files Reviewed

- `lib/auth.ts`
- `lib/permissions.ts`
- `lib/permissions-server.ts`
- `lib/validations.ts`
- `lib/validations/healthkit.ts`
- `lib/email.ts`
- `lib/email-templates.ts`
- `lib/healthkit/pairing.ts`
- `app/api/auth/signup/route.ts`
- `app/api/admin/users/[id]/route.ts`
- `app/api/admin/users/[id]/roles/route.ts`
- `app/api/admin/users/[id]/reset-password/route.ts`
- `app/api/clients/[id]/route.ts`
- `app/api/clients/[id]/entries/route.ts`
- `app/api/entries/route.ts`
- `app/api/pair/route.ts`
- `app/api/pairing-codes/generate/route.ts`
- `app/api/ingest/workouts/route.ts`
- `app/api/ingest/steps/route.ts`
- `app/api/ingest/sleep/route.ts`
- `app/api/ingest/profile/route.ts`
- `app/api/healthkit/workouts/route.ts`
- `app/api/cohorts/[id]/route.ts`
- `app/api/cohorts/[id]/clients/route.ts`
- `app/api/invites/route.ts`
- `app/api/client/change-password/route.ts`
- `app/api/user/export-data/route.ts`
- `app/api/user/delete-account/route.ts`
- `prisma/schema.prisma`
- `package.json`

---

*This audit was performed based on static code analysis. Dynamic testing and penetration testing are recommended as follow-up activities.*
