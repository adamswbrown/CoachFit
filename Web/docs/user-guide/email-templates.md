# Email Template Management

This guide explains how to manage email templates in the CoachFit admin panel.

## Overview

CoachFit uses a configurable email template system that allows administrators to:

- View all system email templates
- Edit email content without code changes
- Enable/disable specific templates
- Preview templates with mock data
- Use token substitution for dynamic content

## Accessing Email Templates

1. Log in as an admin user
2. Navigate to **Admin → Email Templates** in the sidebar
3. You'll see a list of all available email templates

## Email Template Types

The system includes the following default templates:

### 1. Welcome Email - Client
**Key:** `welcome_client`  
**Sent when:** A new client signs up or is created via OAuth  
**Available tokens:** `userName`, `loginUrl`

### 2. Welcome Email - Coach
**Key:** `welcome_coach`  
**Sent when:** Admin creates a new coach account  
**Available tokens:** `userName`, `userEmail`, `loginUrl`

### 3. Coach Invitation
**Key:** `coach_invite`  
**Sent when:** Coach invites a client (global invite)  
**Available tokens:** `coachName`, `loginUrl`

### 4. Cohort Invitation
**Key:** `cohort_invite`  
**Sent when:** Client is invited to a specific cohort  
**Available tokens:** `coachName`, `cohortName`, `loginUrl`

### 5. Password Set (First Time)
**Key:** `password_set`  
**Sent when:** Admin sets password for OAuth-only user  
**Available tokens:** `userName`, `loginUrl`

### 6. Password Reset
**Key:** `password_reset`  
**Sent when:** Admin resets existing password  
**Available tokens:** `userName`, `loginUrl`

## Editing Email Templates

1. Click **Edit** next to any template in the list
2. You can modify:
   - Template name and description
   - Subject line
   - HTML body
   - Plain text version
   - Enable/disable status

### Using Tokens

Tokens are placeholders that get replaced with actual values when emails are sent. Use the syntax `{{tokenName}}` in your templates.

**Example:**
```html
<p>Hi{{userName}},</p>
<p>Welcome to CoachFit! Click here to sign in: {{loginUrl}}</p>
```

Available tokens for each template are shown in the sidebar when editing.

### Previewing Changes

Before saving:
1. Click the **Preview** button
2. The system will show how the email will look with mock data
3. Review the rendered HTML and plain text versions
4. Make adjustments as needed

### Saving Changes

1. Click **Save Changes** to apply your edits
2. Changes take effect immediately for new emails
3. Already-sent emails are not affected

## Enabling/Disabling Templates

You can temporarily disable a template without deleting it:

1. From the template list, click **Disable** next to a template
2. Disabled templates will use hardcoded fallback content
3. Click **Enable** to re-activate the template

**Note:** System templates cannot be deleted, only disabled.

## Best Practices

### Template Content
- Keep subject lines under 60 characters for better mobile display
- Use clear, friendly language
- Include relevant call-to-action buttons
- Test with preview before saving changes

### Token Usage
- Only use whitelisted tokens (shown in the sidebar)
- Provide fallback text for optional tokens
- Use proper spacing: `Hi{{userName}},` becomes "Hi John," not "HiJohn,"

### HTML Formatting
- Use inline CSS for email styling
- Keep layouts simple and mobile-friendly
- Test in multiple email clients if possible
- Avoid complex JavaScript (emails don't execute scripts)

## Security

The email template system includes several security measures:

- **Token whitelist:** Only approved variables can be substituted
- **HTML escaping:** All values are automatically escaped to prevent XSS
- **No script execution:** Templates cannot execute JavaScript
- **System templates:** Cannot be deleted, only edited or disabled
- **Admin-only access:** Only admin users can modify templates

## Troubleshooting

### Template not updating
- Ensure you clicked **Save Changes**
- Check that the template is **Enabled**
- Clear your browser cache

### Emails still using old content
- Verify the template is enabled
- Check that fallback content matches if template is disabled
- Review application logs for errors

### Tokens not replaced
- Ensure token names match exactly (case-sensitive)
- Use proper syntax: `{{tokenName}}` not `{tokenName}` or `{{token name}}`
- Verify the token is in the available tokens list

### Preview not working
- Check all required fields are filled
- Ensure HTML is valid
- Review browser console for errors

## Technical Details

For developers working with the email template system:

- **Database model:** `EmailTemplate` in `prisma/schema.prisma`
- **Service layer:** `lib/email-templates.ts`
- **API routes:** `/api/admin/email-templates/*`
- **Seed script:** `npm run db:seed-email-templates`
- **Migration:** See `prisma/migrations/*/add_email_templates`

## Need Help?

If you encounter issues or need to customize templates beyond the admin interface, contact your system administrator or refer to the developer documentation.
