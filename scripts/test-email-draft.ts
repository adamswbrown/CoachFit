/**
 * Test script for email draft generation
 * Run with: npx tsx scripts/test-email-draft.ts
 */

import { generateWeeklyEmailDraft } from "../lib/utils/email-draft"

// Test case 1: Full stats with Loom URL
console.log("=== Test Case 1: Full Stats with Loom URL ===\n")
const draft1 = generateWeeklyEmailDraft({
  clientName: "John Doe",
  weekStart: "2026-01-13",
  stats: {
    checkInCount: 6,
    checkInRate: 0.857,
    avgWeight: 185.2,
    weightTrend: -1.5,
    avgSteps: 8234,
    avgCalories: 1850,
    avgSleepMins: 450,
  },
  loomUrl: "https://www.loom.com/share/abc123xyz",
})
console.log(draft1)
console.log("\n" + "=".repeat(60) + "\n")

// Test case 2: Minimal stats, no Loom URL
console.log("=== Test Case 2: Minimal Stats, No Loom URL ===\n")
const draft2 = generateWeeklyEmailDraft({
  clientName: null,
  weekStart: "2026-01-13",
  stats: {
    checkInCount: 3,
    checkInRate: 0.428,
    avgWeight: null,
    weightTrend: null,
    avgSteps: null,
    avgCalories: null,
    avgSleepMins: null,
  },
  loomUrl: null,
})
console.log(draft2)
console.log("\n" + "=".repeat(60) + "\n")

// Test case 3: Weight gain scenario
console.log("=== Test Case 3: Weight Gain Scenario ===\n")
const draft3 = generateWeeklyEmailDraft({
  clientName: "Sarah Smith",
  weekStart: "2026-01-13",
  stats: {
    checkInCount: 7,
    checkInRate: 1.0,
    avgWeight: 142.8,
    weightTrend: 2.3,
    avgSteps: 12500,
    avgCalories: 2100,
    avgSleepMins: 510,
  },
  loomUrl: "https://www.loom.com/share/def456",
})
console.log(draft3)
console.log("\n" + "=".repeat(60) + "\n")

console.log("✅ All test cases completed successfully!")
