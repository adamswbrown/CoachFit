import { test, expect } from '@playwright/test'

// This test assumes an admin user exists with only the ADMIN role and valid credentials
// and that the admin dashboard allows creation of admin-only users.

test.describe('Admin-only user creation', () => {
  test('Admin can create an admin-only user (no coach/client roles)', async ({ page }) => {
    // Login as an admin
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', 'admin@test.local')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/admin')

    // Go to Users management
    await page.click('text=Users')

    // Click "+ Create Admin" button
    await page.click('text=Create Admin')

    // Fill in the form for a new admin-only user
    const newEmail = `adminonly+${Date.now()}@test.local`
    await page.fill('input[name="email"]', newEmail)
    await page.fill('input[name="name"]', 'Admin Only User')
    await page.fill('input[name="password"]', 'adminonly123')
    // Ensure only ADMIN role is selected
    await page.check('input[name="role-admin"]')
    await page.uncheck('input[name="role-coach"]')
    await page.uncheck('input[name="role-client"]')
    await page.click('button[type="submit"]')

    // Confirm user appears in the list with only ADMIN role
    await expect(page.locator(`tr:has-text("${newEmail}")`)).toBeVisible()
    await expect(page.locator(`tr:has-text("${newEmail}") td:has-text("ADMIN")`)).toBeVisible()
    await expect(page.locator(`tr:has-text("${newEmail}") td:has-text("COACH")`)).not.toBeVisible()
    await expect(page.locator(`tr:has-text("${newEmail}") td:has-text("CLIENT")`)).not.toBeVisible()
  })

  test('Non-admin cannot create admin-only user', async ({ page }) => {
    // Login as a coach (not admin)
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', 'coach@test.local')
    await page.fill('input[type="password"]', 'coach123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/coach-dashboard')

    // Try to access admin user creation page
    await page.goto('http://localhost:3000/admin')
    // Should be forbidden or redirected
    await expect(page).not.toHaveURL('**/admin')
    // Or see a forbidden message
    await expect(page.locator('text=Forbidden')).toBeVisible()
  })
})
