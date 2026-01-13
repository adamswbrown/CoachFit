# CoachFit User Documentation

Welcome to CoachFit - a comprehensive fitness tracking platform designed for coaches and clients to work together on fitness goals.

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [For Clients](#for-clients)
4. [For Coaches](#for-coaches)
5. [For Administrators](#for-administrators)
6. [Troubleshooting](#troubleshooting)

---

## Overview

CoachFit enables:

- **Coaches** to create cohorts, invite clients, and monitor client progress
- **Clients** to log daily fitness entries (weight, steps, calories, sleep quality)
- **Analytics** for coaches to track cohort performance and individual client trends
- **Role-based access control** with support for CLIENT, COACH, and ADMIN roles
- **Invitation system** for seamless client onboarding

### Key Features

- ✅ Daily fitness entry logging (weight, steps, calories, sleep quality)
- ✅ Personal dashboard with quick stats
- ✅ Entry history with visual tracking
- ✅ Automatic coach assignment via invitations
- ✅ Cohort management for coaches
- ✅ Comprehensive analytics and reporting
- ✅ Beautiful, responsive UI

---

## Getting Started

### Account Types

CoachFit supports three types of accounts:

1. **Client Accounts** - For individuals tracking their fitness progress
2. **Coach Accounts** - For fitness professionals managing client cohorts
3. **Admin Accounts** - For platform administrators managing users and system settings

### Authentication

You can sign in using:

- **Google OAuth** (recommended - one-click sign in)
- **Email and password** (traditional sign in)

### First Time Setup

1. Navigate to the login page
2. Click "Sign Up" if you don't have an account
3. Choose your authentication method (Google or Email/Password)
4. Complete the onboarding process based on your role
5. Start using CoachFit!

---

# For Clients

## Introduction

As a client, CoachFit helps you track your daily fitness progress and share it with your coach. Your coach can review your data and provide guidance to help you reach your goals.

## Onboarding

### Invited by a Coach

If your coach has invited you:

1. You'll receive an email invitation (if email notifications are enabled)
2. Click the invitation link or sign up with the email address your coach used
3. Complete your account setup
4. You'll see a welcome message explaining how CoachFit works
5. Once your coach assigns you to a cohort, you can start logging entries

### Self-Signup

If you sign up on your own:

1. Create an account using Google OAuth or email/password
2. Complete the onboarding process
3. Your dashboard will show a message that you're waiting for a coach
4. Once a coach invites you and assigns you to a cohort, you can start tracking

## Logging Your Check-Ins

### Daily Check-In Form

The check-in form allows you to log:

- **Date** - Select the date for your entry (defaults to today)
- **Weight** (optional) - Your weight in pounds (lbs)
- **Steps** (optional) - Number of steps taken
- **Calories** (optional) - Calories consumed
- **Sleep Quality** (optional) - Rate your sleep quality from 1-10

### How to Submit a Check-In

1. Navigate to your dashboard
2. Find the "Log Your Check-In" form
3. Fill in the data you want to track:
    - Use the date picker to select the date (or use today's date)
    - Enter your weight, steps, calories, and/or sleep quality
    - All fields are optional - only fill in what you want to track
4. Click "Submit Check-In"
5. Your entry will be saved and visible to your coach

### Tips for Check-Ins

- **Consistency is key** - Try to log entries regularly (daily or as your coach recommends)
- **You can update entries** - If you make a mistake, you can submit another entry for the same date to update it
- **Partial entries are fine** - You don't need to fill in every field every time
- **Use the increment/decrement buttons** - The form has up/down arrows next to number fields for easy adjustment

## Viewing Your Data

### Entry History

You can view your past entries to see your progress over time. Your coach can also see this data to help guide your fitness journey.

### What Your Coach Sees

Your coach can see:

- All your check-in entries
- Trends in your weight, steps, calories, and sleep quality
- Analytics and progress charts
- This helps them provide personalized guidance

## Working with Your Coach

### Coach Assignment

- Your coach will invite you via email (if enabled) or add you directly to a cohort
- Once assigned, you'll be able to start logging entries
- You can be part of multiple cohorts if your coach manages different programs

### Communication Model

CoachFit is designed around a **data-driven interaction model**:

1. **You check in regularly** - Log your progress data (weight, steps, calories, etc.)
2. **Your coach reviews weekly** - They review your data to track progress and identify patterns
3. **Your coach provides guidance** - Based on your data, your coach can provide feedback, adjustments, and personalized recommendations

This model reduces the need for constant back-and-forth communication while ensuring your coach has the data they need to help you succeed.

---

# For Coaches

## Introduction

As a coach, CoachFit helps you manage your clients, track their progress, and provide data-driven guidance. You can organize clients into cohorts, invite new clients, and monitor their fitness journey through comprehensive analytics.

## Onboarding

When you first log in as a coach:

1. You'll see a welcome message explaining how CoachFit works
2. The system will guide you through the key concepts:
    - Clients check in regularly with their progress data
    - You review weekly to track progress and provide guidance
    - You guide progress through notes, adjustments, and personalized feedback
3. Complete onboarding to access your dashboard

## Dashboard Overview

Your coach dashboard is the central hub for managing all your clients and cohorts. Here's what you'll see:

### Statistics Cards

- **Total Clients** - Number of clients across all cohorts
- **Pending Invites** - Clients who have been invited but haven't completed setup
- **Active Clients** - Clients who have submitted entries recently
- **Connected Clients** - Clients who are assigned to cohorts

### Client Filters

You can filter your client list by:

- **All** - Show all clients
- **Active** - Clients who have submitted entries recently
- **Connected** - Clients assigned to cohorts
- **Pending** - Clients with pending invitations
- **Offline** - Clients who haven't submitted entries in a while
- **Unassigned** - Clients not yet assigned to a cohort
- **Invited** - Clients who have been invited
- **Needs Attention** - Clients who may need your help

## Managing Cohorts

### What is a Cohort?

A cohort is a group of clients working on a similar program or goal. Cohorts help you:

- Organize clients into logical groups
- Track group performance
- Manage program-specific settings
- View cohort-level analytics

### Creating a Cohort

1. Click the "Create Cohort" button on your dashboard
2. Enter a name for your cohort (e.g., "Spring 2024 Fitness Challenge")
3. Configure check-in prompts (optional):
    - Enable/disable specific prompts (weight, steps, calories)
    - Add custom prompts if needed
4. Click "Create Cohort"
5. Your new cohort will appear in your cohorts list

### Cohort Settings

Each cohort can have custom check-in configurations:

- **Enabled Prompts** - Choose which data fields clients should track (weight, steps, calories)
- **Custom Prompts** - Add your own questions or data points
- **Prompt Types** - Scale (1-10), text, or number

### Viewing Cohorts

- Navigate to the "Cohorts" section from the sidebar
- See all your cohorts with client counts
- Click on a cohort to view details and analytics

## Inviting Clients

### Global Invitations

You can invite clients in two ways:

1. **Invite to Specific Cohort** - Invite a client directly to a cohort
2. **Global Invite** - Invite a client who will be assigned to a cohort later

### How to Invite a Client

1. Click "Invite Client" on your dashboard
2. Enter the client's email address
3. Choose whether to:
    - Assign them to a specific cohort immediately
    - Create a global invite (assign to cohort later)
4. Click "Send Invitation"
5. The client will receive an email (if email notifications are enabled) with instructions

### Client Assignment

After inviting a client:

1. They'll appear in your client list
2. If you created a global invite, you can assign them to a cohort later
3. Use the "Assign to Cohort" dropdown next to their name
4. Select the cohort and confirm

## Managing Clients

### Client List

Your dashboard shows all your clients with:

- **Name and Email** - Client identification
- **Status** - Current status (Active, Pending, Offline, etc.)
- **Cohort Assignment** - Which cohort(s) they belong to
- **Last Entry** - When they last submitted a check-in
- **Quick Actions** - Assign to cohort, view details, etc.

### Viewing Client Details

Click on a client's name to:

- View all their entries
- See analytics and trends
- View progress charts
- Add coach notes

### Client Analytics

For each client, you can see:

- **Weight Trends** - Chart showing weight changes over time
- **Step Averages** - 7-day and 30-day averages
- **Calorie Averages** - 7-day and 30-day averages
- **Sleep Quality** - Trends in sleep quality ratings
- **Progress Summary** - Overall progress metrics

## Analytics

### Cohort Analytics

View comprehensive analytics for each cohort:

1. Navigate to "Cohorts" from the sidebar
2. Click on a cohort name
3. Click "View Analytics" or navigate to the Analytics tab

You'll see:

- **Cohort Summary Cards**:
    - Active Clients count
    - Average Weight Change across the cohort
    - Average Steps (7-day and 30-day)
- **Client Progress Table**:
    - Individual client metrics
    - Latest weight and weight change
    - Step averages (7-day and 30-day)
    - Calorie averages (30-day)
    - Links to individual client details

### Individual Client Analytics

For detailed client analytics:

1. Click on a client's name from your dashboard
2. Navigate to their analytics page
3. View:
    - Weight trend charts
    - Step and calorie averages
    - Sleep quality trends
    - Progress over time

## Best Practices

### Regular Reviews

- Review client data weekly to identify trends
- Look for patterns in weight, activity, and sleep
- Provide timely feedback based on data

### Cohort Organization

- Organize clients by program, goal, or timeline
- Use descriptive cohort names
- Keep cohorts focused (3-10 clients per cohort works well)

### Client Communication

- Use the data to guide your conversations
- Reference specific trends when providing feedback
- Celebrate progress and address concerns proactively

---

# For Administrators

## Introduction

As an administrator, you have full access to manage users, roles, cohorts, and system settings. This section covers all administrative functions.

## Dashboard Overview

Your admin dashboard provides:

- **Quick Stats**:
    - Total Users
    - Number of Coaches
    - Number of Cohorts
- **Two Main Tabs**:
    - **Users** - Manage all users, roles, and permissions
    - **Cohorts** - View and manage all cohorts across the platform

## Managing Users

### User List

The Users tab shows all users in the system with:

- **Email** - User's email address
- **Name** - User's display name
- **Roles** - Current roles (CLIENT, COACH, ADMIN)
- **Auth Providers** - How they signed in (Google, Email/Password)
- **Cohorts** - Which cohorts they belong to or coach
- **Created Date** - When the account was created

### Search and Filter

- Use the search bar to find users by email or name
- Filter by role if needed

### Managing Roles

### Adding Roles

To grant a user additional roles:

1. Find the user in the Users list
2. Click the "+" button next to the role you want to add
3. Confirm the action
4. The user will immediately have access to that role's features

### Removing Roles

To remove a role from a user:

1. Find the user in the Users list
2. Click the "-" button next to the role you want to remove
3. Confirm the action
4. The user will lose access to that role's features

**Important**: Be careful when removing roles, especially ADMIN roles.

### Creating Coaches

To create a new coach account:

1. Click the "+ Create Coach" button at the top of the dashboard
2. Fill in the form:
    - **Email** - Coach's email address (required)
    - **Name** - Coach's display name (optional)
    - **Password** - Initial password (required)
3. Click "Create Coach"
4. The coach will be created with the COACH role
5. They can log in immediately with the provided password

### Resetting Passwords

To reset a user's password:

1. Find the user in the Users list
2. Click "Reset Password" next to their name
3. Enter a new password
4. Click "Update Password"
5. The user can now log in with the new password

**Note**: This only works for users who signed up with email/password. Users who only use Google OAuth don't have passwords.

## Managing Cohorts

### Cohort List

The Cohorts tab shows all cohorts in the system with:

- **Cohort Name** - Name of the cohort
- **Coach** - Which coach owns/manages the cohort
- **Active Clients** - Number of active clients in the cohort
- **Pending Invites** - Number of pending invitations
- **Created Date** - When the cohort was created

### Assigning Coaches to Cohorts

If a cohort doesn't have a coach assigned:

1. Go to the Cohorts tab
2. Find the cohort without a coach
3. Use the dropdown to select a coach
4. Click "Assign Coach"
5. The coach will now have access to manage that cohort

## System Management

### User Overview

Admins can view a comprehensive overview of:

- All users and their roles
- System-wide statistics
- Cohort distribution
- User activity

### Best Practices

- **Regular Audits** - Periodically review user roles and permissions
- **Coach Management** - Ensure coaches are properly assigned to cohorts
- **Password Security** - Use strong passwords when resetting user passwords
- **Role Management** - Only grant ADMIN role to trusted users

---

# Troubleshooting

## Common Issues

### Can't Log In

- **Check your email/password** - Make sure you're using the correct credentials
- **Try Google OAuth** - If you signed up with Google, use the "Sign in with Google" option
- **Reset Password** - Contact an admin to reset your password if needed
- **Check Email** - Make sure you're using the email address associated with your account

### Can't See My Coach/Clients

- **Check Assignment** - Make sure you've been assigned to a cohort (for clients) or that clients are assigned to your cohorts (for coaches)
- **Check Invitations** - If you were invited, make sure you've accepted the invitation
- **Contact Admin** - If you believe there's an error, contact a platform administrator

### Check-In Not Saving

- **Check Internet Connection** - Make sure you have a stable internet connection
- **Try Again** - Sometimes network issues can cause temporary failures
- **Check Date** - Make sure you've selected a valid date
- **Contact Support** - If the problem persists, contact support

### Can't Access Certain Pages

- **Check Your Role** - Some features are only available to specific roles (CLIENT, COACH, ADMIN)
- **Complete Onboarding** - Make sure you've completed the onboarding process
- **Contact Admin** - If you believe you should have access, contact an administrator

## Getting Help

If you need additional help:

1. Check this documentation first
2. Contact your coach (if you're a client)
3. Contact a platform administrator
4. Review the error messages - they often provide helpful information

---

## Additional Notes

### Email Notifications

Email notifications (invitations, welcome emails) are currently **disabled by default**. This is intentional for testing purposes. If you need email notifications enabled, contact a platform administrator.

### Test Accounts

If you see a banner saying "Test account — emails are not delivered," this means you're using a test account. Test accounts work normally but don't send emails.

### Platform Status

This platform is in **pre-alpha** status. While core functionality is working, some features may be under development or not fully polished. We welcome feedback and suggestions!

---

**Last Updated**: January 2025
**Version**: 1.0.0
