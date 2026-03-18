# Email Template System - Developer Guide

## Architecture Overview

The email template system allows administrators to manage transactional email content through a database-backed template system with fallback support.

### Key Components

1. **Database Model** (`prisma/schema.prisma`)
   - `EmailTemplate` model stores template content
   - Fields: key, name, description, subjectTemplate, bodyTemplate, textTemplate, availableTokens, enabled, isSystem

2. **Service Layer** (`lib/email-templates.ts`)
   - Template rendering with token substitution
   - HTML escaping for security
   - CRUD operations for templates

3. **Email Service** (`lib/email.ts`)
   - `sendSystemEmail()` function uses templates with fallbacks
   - `sendTransactionalEmail()` legacy function for direct sending

4. **Admin UI** (`app/admin/email-templates/`)
   - List view for all templates
   - Edit view with preview functionality
   - Enable/disable toggle

5. **API Routes** (`app/api/admin/email-templates/`)
   - GET `/api/admin/email-templates` - List all templates
   - GET `/api/admin/email-templates/[key]` - Get single template
   - PUT `/api/admin/email-templates/[key]` - Update template
   - POST `/api/admin/email-templates/preview` - Preview with mock data

## Token Substitution System

### Whitelisted Tokens

Only these tokens can be used in templates for security:

```typescript
const TOKEN_WHITELIST = [
  "userName",
  "userEmail",
  "coachName",
  "coachEmail",
  "cohortName",
  "loginUrl",
  "appName",
] as const
```

### Token Syntax

Templates use double curly braces: `{{tokenName}}`

**Example:**
```html
<p>Hi{{userName}},</p>
<p>Your coach {{coachName}} has invited you to join {{cohortName}}.</p>
<p><a href="{{loginUrl}}">Sign in here</a></p>
```

### Security Features

1. **HTML Escaping:** All token values are HTML-escaped by default
2. **Whitelist Enforcement:** Only approved tokens are substituted
3. **Unknown Token Removal:** Any unrecognized tokens are removed
4. **No Script Execution:** Templates cannot execute JavaScript

## Sending Emails with Templates

### Using sendSystemEmail

```typescript
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"

await sendSystemEmail({
  templateKey: EMAIL_TEMPLATE_KEYS.WELCOME_CLIENT,
  to: "user@example.com",
  variables: {
    userName: " John",
    loginUrl: "https://app.example.com/login",
  },
  isTestUser: false,
  // Fallback content if template not found or disabled
  fallbackSubject: "Welcome to CoachFit",
  fallbackHtml: "<p>Welcome...</p>",
  fallbackText: "Welcome...",
})
```

### Template Keys

Available template keys are defined in `EMAIL_TEMPLATE_KEYS`:

```typescript
export const EMAIL_TEMPLATE_KEYS = {
  WELCOME_CLIENT: "welcome_client",
  WELCOME_COACH: "welcome_coach",
  COACH_INVITE: "coach_invite",
  COHORT_INVITE: "cohort_invite",
  PASSWORD_SET: "password_set",
  PASSWORD_RESET: "password_reset",
} as const
```

## Database Seeding

### Initial Setup

Run the seed script to create default templates:

```bash
npm run db:seed-email-templates
```

This script:
- Creates all default templates
- Uses upsert to avoid duplicates
- Preserves existing customizations
- Can be run multiple times safely

### Seed Script Logic

```typescript
// scripts/seed-email-templates.ts
await db.emailTemplate.upsert({
  where: { key: template.key },
  update: {
    // Only update metadata, preserve content
    name: template.name,
    description: template.description,
    availableTokens: template.availableTokens,
  },
  create: {
    ...template,
    isSystem: true,
    enabled: true,
  },
})
```

## Adding New Email Templates

### 1. Add Template Key

```typescript
// lib/email-templates.ts
export const EMAIL_TEMPLATE_KEYS = {
  // ... existing keys
  NEW_TEMPLATE: "new_template",
} as const
```

### 2. Add to Seed Data

```typescript
// scripts/seed-email-templates.ts
const DEFAULT_TEMPLATES = [
  // ... existing templates
  {
    key: EMAIL_TEMPLATE_KEYS.NEW_TEMPLATE,
    name: "New Template Name",
    description: "Description of when this is sent",
    subjectTemplate: "Subject with {{tokens}}",
    bodyTemplate: "<html>...</html>",
    textTemplate: "Plain text version...",
    availableTokens: ["userName", "loginUrl"],
  },
]
```

### 3. Use in Application Code

```typescript
await sendSystemEmail({
  templateKey: EMAIL_TEMPLATE_KEYS.NEW_TEMPLATE,
  to: recipient,
  variables: { userName, loginUrl },
  fallbackSubject: "...",
  fallbackHtml: "...",
  fallbackText: "...",
})
```

### 4. Run Seed Script

```bash
npm run db:seed-email-templates
```

## Template Service API

### renderEmailTemplate

Renders a template with variables:

```typescript
const rendered = await renderEmailTemplate(
  EMAIL_TEMPLATE_KEYS.WELCOME_CLIENT,
  { userName: " John", loginUrl: "https://..." }
)
// Returns: { subject, html, text } or null if disabled
```

### getAllEmailTemplates

Fetches all templates for admin UI:

```typescript
const templates = await getAllEmailTemplates()
// Returns array of EmailTemplate objects
```

### updateEmailTemplate

Updates template content:

```typescript
await updateEmailTemplate("welcome_client", {
  name: "Updated Name",
  subjectTemplate: "New Subject",
  bodyTemplate: "<html>...</html>",
  textTemplate: "...",
  enabled: true,
})
```

## Migration

The email template table migration is in:
```
prisma/migrations/[timestamp]_add_email_templates/migration.sql
```

Run with:
```bash
npm run db:migrate
```

## Testing

### Testing Email Sending

Use the `isTestUser` flag to suppress actual email sending:

```typescript
await sendSystemEmail({
  templateKey: EMAIL_TEMPLATE_KEYS.WELCOME_CLIENT,
  to: "test@test.local",
  variables: { ... },
  isTestUser: true, // Email logged but not sent
  // ...
})
```

### Testing Template Preview

```bash
curl -X POST http://localhost:3000/api/admin/email-templates/preview \
  -H "Content-Type: application/json" \
  -d '{
    "subjectTemplate": "Welcome {{userName}}",
    "bodyTemplate": "<p>Hi {{userName}}</p>",
    "textTemplate": "Hi {{userName}}",
    "mockVariables": {"userName": " John"}
  }'
```

## Fallback Behavior

If a template is not found or disabled, `sendSystemEmail` uses provided fallback content:

1. Checks database for template
2. If found and enabled → use template
3. If not found or disabled → use fallback
4. If no fallback provided → returns error

**Always provide fallbacks** to ensure emails work even if templates are misconfigured.

## Best Practices

### For Developers

1. **Always provide fallbacks** when calling `sendSystemEmail`
2. **Use template keys from constants**, never hardcode strings
3. **Only use whitelisted tokens** in variables object
4. **Test with `isTestUser: true`** during development
5. **Run seed script** after adding new templates

### For Template Content

1. **Keep subjects concise** (under 60 characters)
2. **Use inline CSS** for styling (external CSS doesn't work)
3. **Provide both HTML and text** versions
4. **Test across email clients** for compatibility
5. **Avoid complex layouts** (simple is better for email)

### For Security

1. **Never disable HTML escaping** in production
2. **Don't add tokens to whitelist** without security review
3. **Validate all user input** before passing to templates
4. **Keep isSystem: true** for default templates
5. **Audit template changes** regularly

## Troubleshooting

### Template not rendering

Check:
- Template exists in database
- Template is enabled
- Template key matches exactly
- Variables object has required tokens

### Tokens not replaced

Check:
- Token name is in whitelist
- Syntax is correct: `{{tokenName}}`
- Variable is provided in variables object
- No typos in token names

### Fallback always used

Check:
- Database connection working
- Template enabled in database
- Template key correct
- Check server logs for errors

## Performance Considerations

- Templates are fetched from database on each send
- Consider caching for high-volume scenarios
- Use `isTestUser` flag to skip sending in development
- Batch email sending when possible

## Security Considerations

- All token values are HTML-escaped
- Only whitelisted tokens are substituted
- Admin-only access to template management
- System templates cannot be deleted
- No JavaScript execution in templates

## Future Enhancements

Potential improvements:

- Template versioning and history
- A/B testing support
- Template categories/tags
- Multi-language support
- Scheduled template changes
- Template analytics/metrics
