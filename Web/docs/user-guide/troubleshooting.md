# Troubleshooting Guide

Common issues and solutions for CoachFit users.

---

## Table of Contents

1. [Login Issues](#login-issues)
2. [Account Issues](#account-issues)
3. [Check-In Issues](#check-in-issues)
4. [Cohort and Assignment Issues](#cohort-and-assignment-issues)
5. [Data and Analytics Issues](#data-and-analytics-issues)
6. [Email Issues](#email-issues)
7. [Getting Additional Help](#getting-additional-help)

---

## Login Issues

### Can't Log In

**Symptoms**: Unable to access your account

**Solutions**:

1. **Check your email/password**
   - Make sure you're using the correct credentials
   - Check for typos or extra spaces
   - Passwords are case-sensitive

2. **Try Google OAuth**
   - If you signed up with Google, use the "Sign in with Google" option
   - Don't try to use email/password if you only have OAuth

3. **Reset Password**
   - Click "Forgot Password" on the login page
   - Or contact an admin to reset your password

4. **Check Email**
   - Make sure you're using the email address associated with your account
   - Try any alternate email addresses you might have used

5. **Clear Browser Cache**
   - Clear your browser cookies and cache
   - Try in an incognito/private browsing window
   - Try a different browser

### "Invalid Credentials" Error

**Cause**: Email/password combination is incorrect

**Solutions**:
- Double-check your password
- Try resetting your password
- Verify you're using the correct email
- Contact an admin if you continue to have issues

### OAuth Not Working

**Symptoms**: Google or Apple sign-in fails

**Solutions**:
1. Check if you're signed into the correct Google/Apple account
2. Try signing out of all accounts and signing back in
3. Clear browser cookies
4. Try a different browser
5. Verify OAuth is enabled for the platform

---

## Account Issues

### Can't See My Coach/Clients

**For Clients**:

**Symptoms**: Dashboard shows "waiting for coach"

**Solutions**:
1. **Check Assignment** - Make sure you've been assigned to a cohort
2. **Check Invitations** - If you were invited, verify you accepted the invitation
3. **Contact Your Coach** - Ask them to verify your cohort assignment
4. **Contact Admin** - If you believe there's an error

**For Coaches**:

**Symptoms**: Can't see clients you invited

**Solutions**:
1. **Check if they signed up** - Clients must complete registration
2. **Verify email address** - Make sure you used the correct email
3. **Check cohort assignment** - Ensure clients are assigned to your cohorts
4. **Review pending invites** - Check if invitations are still pending

### Wrong Role

**Symptoms**: Don't have access to features you should

**Solutions**:
1. **Verify your role** - Check your account settings
2. **Contact admin** - Request the correct role be added
3. **Complete onboarding** - Make sure you finished the setup process

---

## Check-In Issues

### Check-In Not Saving

**Symptoms**: Form doesn't submit or shows error

**Solutions**:

1. **Check Internet Connection**
   - Make sure you have a stable internet connection
   - Try refreshing the page
   - Check if other websites load

2. **Check Date**
   - Make sure you've selected a valid date
   - Date cannot be in the future
   - Verify date format is correct

3. **Check Field Values**
   - Weight: Must be a positive number
   - Steps: Must be a non-negative integer
   - Calories: Must be a non-negative integer
   - Sleep Quality: Must be 1-10
   - Perceived Effort: Must be 1-10

4. **Try Again**
   - Sometimes network issues cause temporary failures
   - Wait a moment and submit again
   - Try refreshing the page

5. **Contact Support**
   - If the problem persists, contact support
   - Provide error messages if shown

### Can't Update Previous Entry

**Symptoms**: Trying to edit an old entry doesn't work

**Solution**:
- Submit a new entry for the same date
- The system will automatically update the existing entry
- This is by design - one entry per day

### Missing Fields in Form

**Symptoms**: Not seeing all check-in fields

**Solution**:
- Your coach may have customized the check-in form for your cohort
- Only enabled fields will show
- Contact your coach if you need additional fields

---

## Cohort and Assignment Issues

### Not Assigned to Cohort

**For Clients**:

**Symptoms**: Dashboard shows "waiting for coach"

**Solutions**:
1. Contact your coach
2. Verify your coach has your correct email address
3. Make sure your coach assigned you to a cohort
4. Check if you completed onboarding

**For Coaches**:

**Symptoms**: Can't assign client to cohort

**Solutions**:
1. Verify the client signed up and completed onboarding
2. Make sure they used the email address you invited
3. Check if you have permission to manage that cohort
4. Try refreshing the page

### Can't Create Cohort

**Symptoms**: "Create Cohort" button doesn't work

**Solutions**:
1. Verify you have the COACH role
2. Make sure you're logged in
3. Try refreshing the page
4. Clear browser cache
5. Contact an admin if issue persists

---

## Data and Analytics Issues

### Client Data Not Showing

**For Coaches**:

**Symptoms**: Can't see client entries

**Solutions**:
1. **Confirm client submitted entries** - Check with the client
2. **Check date range filter** - Adjust the date range
3. **Verify cohort assignment** - Make sure client is in your cohort
4. **Refresh the page** - Sometimes data takes a moment to load

### Analytics Not Loading

**Symptoms**: Charts or stats don't appear

**Solutions**:
1. **Check internet connection** - Ensure stable connection
2. **Refresh the page** - Force a reload
3. **Clear browser cache** - Remove old cached data
4. **Try different browser** - Test in another browser
5. **Check if there's data** - Analytics require entry data to display

### Incorrect Calculations

**Symptoms**: Averages or totals seem wrong

**Solutions**:
1. **Check date range** - Verify you're looking at the correct time period
2. **Review raw data** - Look at individual entries
3. **Account for missing days** - Averages exclude days without entries
4. **Contact support** - Report if calculations are consistently wrong

---

## Email Issues

### Not Receiving Emails

**Symptoms**: No invitation or welcome emails

**Possible Causes**:

1. **Test Account**
   - If you see "Test account — emails are not delivered" banner
   - This is intentional - test accounts don't send emails
   - This is normal for development/testing

2. **Spam Folder**
   - Check your spam/junk folder
   - Add CoachFit to safe senders list

3. **Email Not Configured**
   - Email notifications may not be enabled
   - Contact an admin to verify email setup

4. **Wrong Email Address**
   - Verify your email address is correct in account settings
   - Ask your coach if they used the correct email

**Note**: Email notifications are currently disabled by default for testing purposes.

---

## Can't Access Certain Pages

**Symptoms**: "Access Denied" or redirected to login

**Solutions**:

1. **Check Your Role**
   - Some features are only available to specific roles
   - CLIENT: Can only access client dashboard
   - COACH: Has access to coach features
   - ADMIN: Has access to admin features

2. **Complete Onboarding**
   - Make sure you've completed the onboarding process
   - Check if there are any pending steps

3. **Verify Authentication**
   - Make sure you're logged in
   - Try logging out and back in

4. **Contact Admin**
   - If you believe you should have access, contact an administrator

---

## Browser Issues

### Page Not Loading Correctly

**Solutions**:

1. **Clear Browser Cache**
   - Clear cookies and cached data
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

2. **Try Different Browser**
   - Test in Chrome, Firefox, Safari, or Edge
   - Update your browser to the latest version

3. **Disable Browser Extensions**
   - Ad blockers or security extensions may interfere
   - Try in incognito/private mode

4. **Check JavaScript**
   - Make sure JavaScript is enabled
   - CoachFit requires JavaScript to function

---

## Mobile Issues

### App Not Working on Mobile

**Solutions**:

1. **Use Mobile Browser**
   - CoachFit is a web application, not a native app
   - Open in Safari (iOS) or Chrome (Android)

2. **Check Mobile Data**
   - Ensure you have internet connection
   - Try switching between WiFi and mobile data

3. **Clear Mobile Browser Cache**
   - Clear browsing data in browser settings

4. **Try Desktop Version**
   - If mobile view has issues, try desktop site option

---

## Getting Additional Help

If you need additional help:

### For Clients

1. Check this troubleshooting guide first
2. Review the [Client Guide](./clients.md)
3. Contact your coach
4. Contact a platform administrator

### For Coaches

1. Check this troubleshooting guide first
2. Review the [Coach Guide](./coaches.md)
3. Contact a platform administrator
4. Check for system status updates

### For Admins

1. Check this troubleshooting guide first
2. Review the [Admin Guide](./admins.md)
3. Check system logs
4. Review the [Developer Guide](../development/README.md)
5. Open a [GitHub Issue](https://github.com/adamswbrown/CoachFit/issues)

### Reporting Bugs

When reporting a bug, include:

- **What you were trying to do** - Describe your goal
- **What happened** - What went wrong
- **Error messages** - Copy any error text
- **Steps to reproduce** - How to recreate the issue
- **Browser and device** - What you're using
- **Screenshots** - If applicable

---

## Platform Status

### Pre-Alpha Status

CoachFit is currently in **pre-alpha** status. This means:

- Core functionality is working
- Some features may be under development
- Minor bugs may be present
- Email notifications may be disabled
- We welcome feedback and bug reports!

### Known Limitations

- Email notifications disabled by default (for testing)
- Test accounts don't send emails (by design)
- Some advanced features still in development

---

## Helpful Resources

- [Complete User Guide](./README.md)
- [Client Guide](./clients.md)
- [Coach Guide](./coaches.md)
- [Admin Guide](./admins.md)
- [Getting Started](./getting-started.md)

---

**Last Updated**: January 2025
