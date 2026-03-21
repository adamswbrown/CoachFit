import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Seed credit products based on real Hitsona Bangor (TeamUp) membership data.
 *
 * Products seeded:
 *   Session packs: 1 Session Pass, 3/5/10 PT Sessions, Intro PT Session
 *   Service packs: Sports Massage, 3 Pack Massages
 *   Challenge: 8 Week Challenge (provider-only)
 *   Subscriptions: Monthly HIIT Unlimited, Monthly HIIT + CORE Unlimited
 *
 * Owner: Gav Cunningham (coachgav@gcgyms.com) — primary Hitsona coach.
 * Falls back to any COACH user if Gav doesn't exist.
 */
async function seedCreditProducts() {
  console.log("🏋️ Seeding Hitsona credit products...\n")

  // Find the real coach to own these products
  let coach = await prisma.user.findFirst({
    where: { email: "coachgav@gcgyms.com" },
    select: { id: true, name: true, email: true },
  })

  if (!coach) {
    // Fallback: find any coach
    coach = await prisma.user.findFirst({
      where: { roles: { has: "COACH" } },
      select: { id: true, name: true, email: true },
    })
  }

  if (!coach) {
    console.error("❌ No coach user found. Run the main seed first (npm run db:seed).")
    return
  }

  console.log(`📋 Owner: ${coach.name} (${coach.email})\n`)

  const coachId = coach.id

  // ── Session Packs (ONE_TIME_PACK) ──────────────────────────────────────────

  const packs = [
    {
      name: "1 Session Pass",
      description: "Single session drop-in pass for any class.",
      creditMode: "ONE_TIME_PACK" as const,
      creditsPerPeriod: 1,
      periodType: "ONE_TIME" as const,
      purchasePriceGbp: 9.99,
      classEligible: true,
      allowRepeatPurchase: true,
      purchasableByProviderOnly: false,
      externalSource: "teamup",
      externalId: "hitsona-1-session",
    },
    {
      name: "3 PT Sessions",
      description: "3-session personal training pack.",
      creditMode: "ONE_TIME_PACK" as const,
      creditsPerPeriod: 3,
      periodType: "ONE_TIME" as const,
      purchasePriceGbp: 110.0,
      classEligible: true,
      allowRepeatPurchase: true,
      purchasableByProviderOnly: false,
      externalSource: "teamup",
      externalId: "hitsona-3-pt",
    },
    {
      name: "5 PT Sessions",
      description: "5-session personal training pack.",
      creditMode: "ONE_TIME_PACK" as const,
      creditsPerPeriod: 5,
      periodType: "ONE_TIME" as const,
      purchasePriceGbp: 150.0,
      classEligible: true,
      allowRepeatPurchase: true,
      purchasableByProviderOnly: false,
      externalSource: "teamup",
      externalId: "hitsona-5-pt",
    },
    {
      name: "10 PT Sessions",
      description: "10-session personal training pack. Best value.",
      creditMode: "ONE_TIME_PACK" as const,
      creditsPerPeriod: 10,
      periodType: "ONE_TIME" as const,
      purchasePriceGbp: 275.0,
      classEligible: true,
      allowRepeatPurchase: true,
      purchasableByProviderOnly: false,
      externalSource: "teamup",
      externalId: "hitsona-10-pt",
    },
    {
      name: "Intro PT Session",
      description: "One-time introductory personal training session for new members.",
      creditMode: "ONE_TIME_PACK" as const,
      creditsPerPeriod: 1,
      periodType: "ONE_TIME" as const,
      purchasePriceGbp: 30.0,
      classEligible: true,
      allowRepeatPurchase: false,
      purchasableByProviderOnly: false,
      externalSource: "teamup",
      externalId: "hitsona-intro-pt",
    },
    {
      name: "Sports Massage",
      description: "Single sports massage session.",
      creditMode: "ONE_TIME_PACK" as const,
      creditsPerPeriod: 1,
      periodType: "ONE_TIME" as const,
      purchasePriceGbp: 40.0,
      classEligible: false,
      allowRepeatPurchase: true,
      purchasableByProviderOnly: false,
      externalSource: "teamup",
      externalId: "hitsona-massage-1",
    },
    {
      name: "3 Pack Massages",
      description: "3-session sports massage pack.",
      creditMode: "ONE_TIME_PACK" as const,
      creditsPerPeriod: 3,
      periodType: "ONE_TIME" as const,
      purchasePriceGbp: 110.0,
      classEligible: false,
      allowRepeatPurchase: true,
      purchasableByProviderOnly: false,
      externalSource: "teamup",
      externalId: "hitsona-massage-3",
    },
  ]

  // ── Challenge (ONE_TIME_PACK, provider-only) ───────────────────────────────

  const challenge = {
    name: "8 Week Challenge",
    description:
      "56-day transformation challenge. Includes daily class access, body composition tracking, and coach-led accountability. Non-refundable.",
    creditMode: "ONE_TIME_PACK" as const,
    creditsPerPeriod: 56,
    periodType: "ONE_TIME" as const,
    purchasePriceGbp: 250.0,
    classEligible: true,
    allowRepeatPurchase: false,
    purchasableByProviderOnly: true,
    externalSource: "teamup",
    externalId: "hitsona-8wk-challenge",
  }

  // ── Monthly Subscriptions (MONTHLY_TOPUP) ──────────────────────────────────

  const subscriptions = [
    {
      name: "Monthly HIIT Unlimited",
      description: "Unlimited HIIT classes per month. Credits renew on the 1st.",
      creditMode: "MONTHLY_TOPUP" as const,
      creditsPerPeriod: 30,
      periodType: "MONTH" as const,
      purchasePriceGbp: 49.0,
      classEligible: true,
      appliesToClassTypes: ["HIIT"],
      allowRepeatPurchase: false,
      purchasableByProviderOnly: true,
      rolloverPolicy: "NONE",
      externalSource: "teamup",
      externalId: "hitsona-monthly-hiit",
    },
    {
      name: "Monthly HIIT + CORE Unlimited",
      description:
        "Unlimited HIIT and CORE classes per month. Credits renew on the 1st.",
      creditMode: "MONTHLY_TOPUP" as const,
      creditsPerPeriod: 30,
      periodType: "MONTH" as const,
      purchasePriceGbp: 59.0,
      classEligible: true,
      appliesToClassTypes: ["HIIT", "CORE"],
      allowRepeatPurchase: false,
      purchasableByProviderOnly: true,
      rolloverPolicy: "NONE",
      externalSource: "teamup",
      externalId: "hitsona-monthly-hiit-core",
    },
  ]

  // ── Upsert all products ────────────────────────────────────────────────────

  const allProducts = [...packs, challenge, ...subscriptions]
  let created = 0
  let updated = 0

  for (const product of allProducts) {
    // Find existing by externalSource + externalId (index exists but not unique,
    // so we use findFirst + create/update instead of upsert)
    const existing = await prisma.creditProduct.findFirst({
      where: {
        externalSource: product.externalSource,
        externalId: product.externalId,
      },
    })

    const data = {
      name: product.name,
      description: product.description,
      creditMode: product.creditMode,
      creditsPerPeriod: product.creditsPerPeriod,
      periodType: product.periodType,
      purchasePriceGbp: product.purchasePriceGbp,
      classEligible: product.classEligible,
      allowRepeatPurchase: product.allowRepeatPurchase,
      purchasableByProviderOnly: product.purchasableByProviderOnly,
      appliesToClassTypes: "appliesToClassTypes" in product ? product.appliesToClassTypes : [],
      rolloverPolicy: "rolloverPolicy" in product ? product.rolloverPolicy : "NONE",
      isActive: true,
    }

    if (existing) {
      await prisma.creditProduct.update({
        where: { id: existing.id },
        data,
      })
      updated++
    } else {
      await prisma.creditProduct.create({
        data: {
          ...data,
          ownerCoachId: coachId,
          currency: "GBP",
          externalSource: product.externalSource,
          externalId: product.externalId,
        },
      })
      created++
    }

    console.log(`  ✓ ${product.name} — £${product.purchasePriceGbp.toFixed(2)}, ${product.creditsPerPeriod} credits`)
  }

  console.log(`\n✅ Credit products seeded: ${created} created, ${updated} updated`)
  console.log(`   Total: ${allProducts.length} products owned by ${coach.name}`)
}

// ── Run ──────────────────────────────────────────────────────────────────────

seedCreditProducts()
  .catch((e) => {
    console.error("❌ Error seeding credit products:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
