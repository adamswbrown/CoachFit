import { db } from "../lib/db"
import { DEFAULT_TEMPLATES } from "../lib/default-questionnaire-templates"

async function seedQuestionnaireTemplates() {
  console.log("🚀 Seeding questionnaire template cohorts...\n")

  try {
    // Create a "Template Coach" user if doesn't exist
    let templateCoach = await db.user.findFirst({
      where: { email: "template-coach@coachfit.internal" },
    })

    if (!templateCoach) {
      console.log("📝 Creating template coach user...")
      templateCoach = await db.user.create({
        data: {
          email: "template-coach@coachfit.internal",
          name: "Template Coach",
          roles: ["COACH"],
          isTestUser: true,
        },
      })
      console.log("✅ Template coach created\n")
    } else {
      console.log("✓ Template coach already exists\n")
    }

    // Create 5 template cohorts (one for each week)
    const weeks = [1, 2, 3, 4, 5] as const

    for (const weekNum of weeks) {
      const cohortName = `Template: Week ${weekNum} Six Week Transformation`
      
      // Check if cohort already exists
      const existingCohort = await db.cohort.findFirst({
        where: {
          name: cohortName,
          coachId: templateCoach.id,
        },
      })

      if (existingCohort) {
        console.log(`⚠️  Cohort "${cohortName}" already exists, skipping...`)
        continue
      }

      console.log(`📦 Creating cohort: ${cohortName}`)
      
      // Create cohort
      const cohort = await db.cohort.create({
        data: {
          name: cohortName,
          coachId: templateCoach.id,
        },
      })

      console.log(`✅ Cohort created (ID: ${cohort.id})`)

      // Get the template for this week
      const templateKey = `week${weekNum}` as keyof typeof DEFAULT_TEMPLATES
      const template = DEFAULT_TEMPLATES[templateKey]

      // Create bundleJson with all 5 weeks (for template, use the same template for all weeks)
      const bundleJson = {
        week1: DEFAULT_TEMPLATES.week1,
        week2: DEFAULT_TEMPLATES.week2,
        week3: DEFAULT_TEMPLATES.week3,
        week4: DEFAULT_TEMPLATES.week4,
        week5: DEFAULT_TEMPLATES.week5,
      }

      // Create QuestionnaireBundle
      console.log(`📝 Creating questionnaire bundle for Week ${weekNum}...`)
      
      await db.questionnaireBundle.create({
        data: {
          cohortId: cohort.id,
          bundleJson: bundleJson as any,
        },
      })

      console.log(`✅ Questionnaire bundle created for Week ${weekNum}\n`)
    }

    console.log("\n✨ All template cohorts created successfully!")
    console.log("\n📌 Template Cohorts:")
    console.log("   - Template: Week 1 Six Week Transformation")
    console.log("   - Template: Week 2 Six Week Transformation")
    console.log("   - Template: Week 3 Six Week Transformation")
    console.log("   - Template: Week 4 Six Week Transformation")
    console.log("   - Template: Week 5 Six Week Transformation")
    console.log("\n💡 Coaches can now clone these templates when creating questionnaires for their cohorts.")
    console.log("\nDone! ✨")
  } catch (error) {
    console.error("❌ Error seeding questionnaire templates:", error)
    process.exit(1)
  }
}

seedQuestionnaireTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
