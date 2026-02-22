import { test, expect } from "@playwright/test"

test.describe("Classes MVP flow", () => {
  test.skip(!process.env.E2E_LOCAL_AUTH, "Set E2E_LOCAL_AUTH=1 to run local auth-dependent tests")

  test("coach can reach classes and credits pages", async ({ page }) => {
    await page.goto("http://localhost:3000/login")
    await page.fill('input[type="email"]', "coachgav@gcgyms.com")
    await page.fill('input[type="password"]', "admin123")
    await page.click('button[type="submit"]')
    await page.waitForURL("**/coach-dashboard")

    await page.click("text=Classes")
    await page.waitForURL("**/coach-dashboard/classes")
    await expect(page.locator("h1:has-text('Classes')")).toBeVisible()

    await page.click("text=Credits")
    await page.waitForURL("**/coach-dashboard/classes/credits")
    await expect(page.locator("h1:has-text('Class Credits')")).toBeVisible()
  })

  test("client can access class booking screen", async ({ page }) => {
    await page.goto("http://localhost:3000/login")
    await page.fill('input[type="email"]', "client@test.local")
    await page.fill('input[type="password"]', "client123")
    await page.click('button[type="submit"]')
    await page.waitForURL("**/client-dashboard")

    await page.click("text=Classes")
    await page.waitForURL("**/client-dashboard/classes")
    await expect(page.locator("h1:has-text('Classes')")).toBeVisible()
  })
})
