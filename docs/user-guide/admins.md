# Admin Guide

Complete guide for administrators managing the CoachFit platform.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Dashboard Overview](#dashboard-overview)
3. [Managing Users](#managing-users)
4. [Managing Cohorts](#managing-cohorts)
5. [System Management](#system-management)
6. [Best Practices](#best-practices)

---

## Introduction

As an administrator, you have full access to manage users, roles, cohorts, and system settings. This section covers all administrative functions.

### What You Can Do

- ✅ Manage all users and roles
- ✅ Create coach accounts
- ✅ Reset user passwords
- ✅ View all cohorts across the platform
- ✅ Assign coaches to cohorts
- ✅ View system-wide statistics
- ✅ Access attention dashboard and insights

---

## Dashboard Overview

Your admin dashboard provides comprehensive platform management tools.

### Quick Stats

At the top of your dashboard:

- **Total Users** - All users in the system
- **Number of Coaches** - Active coaches
- **Number of Cohorts** - All cohorts across the platform
- **System Health** - Platform status and metrics

### Main Tabs

- **Users** - Manage all users, roles, and permissions
- **Cohorts** - View and manage all cohorts
- **Attention** - View insights and attention scores
- **System** - Platform-wide settings and monitoring

---

## Managing Users

### User List

The Users tab shows all users in the system with:

- **Email** - User's email address
- **Name** - User's display name
- **Roles** - Current roles (CLIENT, COACH, ADMIN)
- **Auth Providers** - How they signed in (Google, Email/Password, Apple)
- **Cohorts** - Which cohorts they belong to or coach
- **Created Date** - When the account was created

### Search and Filter

- Use the search bar to find users by email or name
- Filter by role (CLIENT, COACH, ADMIN)
- Sort by date created, last login, etc.

### Managing Roles

#### Adding Roles

To grant a user additional roles:

1. Find the user in the Users list
2. Click the "+" button next to the role you want to add
3. Confirm the action
4. The user will immediately have access to that role's features

**Important**: Users can have multiple roles (e.g., COACH + ADMIN)

#### Removing Roles

To remove a role from a user:

1. Find the user in the Users list
2. Click the "-" button next to the role you want to remove
3. Confirm the action
4. The user will lose access to that role's features

**Warning**: Be careful when removing roles, especially ADMIN roles.

### Creating Coaches

To create a new coach account:

1. Click the "+ Create Coach" button at the top of the dashboard
2. Fill in the form:
    - **Email** - Coach's email address (required)
    - **Name** - Coach's display name (optional)
    - **Password** - Initial password (required, minimum 8 characters)
3. Click "Create Coach"
4. The coach will be created with the COACH role
5. They can log in immediately with the provided password
6. Encourage them to change their password after first login

### Resetting Passwords

To reset a user's password:

1. Find the user in the Users list
2. Click "Reset Password" next to their name
3. Enter a new password (minimum 8 characters)
4. Click "Update Password"
5. The user can now log in with the new password

**Note**: This only works for users who signed up with email/password. Users who only use OAuth (Google, Apple) don't have passwords.

### Viewing User Details

Click on a user to view:

- Complete profile information
- Role history
- Cohort memberships (for clients)
- Cohorts coached (for coaches)
- Activity history
- Login history

---

## Managing Cohorts

### Cohort List

The Cohorts tab shows all cohorts in the system with:

- **Cohort Name** - Name of the cohort
- **Coach** - Which coach owns/manages the cohort
- **Active Clients** - Number of active clients in the cohort
- **Pending Invites** - Number of pending invitations
- **Created Date** - When the cohort was created
- **Last Activity** - Most recent client entry

### Viewing Cohort Details

Click on a cohort to view:

- All clients in the cohort
- Cohort analytics
- Check-in configuration
- Invitation history

### Assigning Coaches to Cohorts

If a cohort doesn't have a coach assigned or needs reassignment:

1. Go to the Cohorts tab
2. Find the cohort
3. Use the dropdown to select a coach
4. Click "Assign Coach"
5. The coach will now have access to manage that cohort

**Use Cases**:
- Coach leaves platform - reassign their cohorts
- Coach overload - redistribute cohorts
- Specialty programs - assign to subject matter experts

---

## System Management

### Attention Dashboard

View auto-generated insights and attention scores:

1. Navigate to the "Attention" tab
2. View insights by priority (Red, Amber, Green)
3. Review insights for:
    - Users who need attention
    - Coaches at capacity
    - Cohorts with low activity
    - System-wide trends

### System Overview

Access platform-wide metrics:

- Total users by role
- Active vs. inactive users
- Cohort distribution
- Entry submission trends
- System health metrics

### User Activity Monitoring

Track platform usage:

- Daily active users
- Entry submission rates
- Coach-client ratios
- Cohort sizes

---

## Best Practices

### Regular Audits

- **Weekly**: Review new user signups and role assignments
- **Monthly**: Audit coach-to-client ratios
- **Quarterly**: Review inactive users and cohorts

### Coach Management

- Ensure coaches are properly assigned to cohorts
- Monitor coach capacity (aim for 5-15 clients per coach)
- Provide support to coaches with large cohorts
- Create new coach accounts as needed

### User Management

- Only grant ADMIN role to trusted users
- Remove roles when users leave the platform
- Keep user data up to date
- Monitor for suspicious activity

### Password Security

- Use strong passwords when resetting user passwords (12+ characters)
- Encourage users to change default passwords
- Never share passwords via insecure channels

### Role Management

- **CLIENT**: Default role for all new users
- **COACH**: Grant to fitness professionals managing clients
- **ADMIN**: Grant only to platform administrators

### Data Management

- Regularly review cohort assignments
- Archive inactive cohorts (if feature available)
- Monitor storage and database size
- Ensure data backups are working

---

## Admin Actions Audit Trail

All admin actions are logged for compliance:

- Role additions/removals
- Password resets
- Coach creations
- Cohort reassignments

View audit trail:
1. Navigate to Admin Dashboard
2. Click "Audit Trail"
3. Filter by action type, date, or admin user

---

## Troubleshooting

### Can't Grant Role

- Verify you have ADMIN role
- Check if the user already has that role
- Refresh the page and try again

### Password Reset Not Working

- Confirm user signed up with email/password (not OAuth)
- Check password meets minimum requirements
- Verify user email is correct

### Cohort Assignment Issues

- Make sure the coach has COACH role
- Verify the cohort exists
- Check for database errors in logs

---

## Emergency Procedures

### User Locked Out

1. Reset their password
2. Verify their email address
3. Check auth provider status
4. Contact technical support if issue persists

### Coach Leaving Platform

1. Reassign all their cohorts to other coaches
2. Notify affected clients
3. Remove COACH role (or deactivate account)
4. Document the transition

### System Issues

1. Check system health dashboard
2. Review error logs
3. Contact technical support
4. Document the issue

---

## Need Help?

- Review this Admin Guide
- Check the [Troubleshooting Guide](./troubleshooting.md)
- Contact platform technical support
- Review system logs

---

**Last Updated**: January 2025
