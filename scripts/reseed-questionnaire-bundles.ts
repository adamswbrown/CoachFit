import { db } from "../lib/db"
import { DEFAULT_TEMPLATES } from "../lib/default-questionnaire-templates"

async function reseedQuestionnaireBundles() {
  const bundleJson = {
    week1: DEFAULT_TEMPLATES.week1,
    week2: DEFAULT_TEMPLATES.week2,
    week3: DEFAULT_TEMPLATES.week3,
    week4: DEFAULT_TEMPLATES.week4,
    week5: DEFAULT_TEMPLATES.week5,
  }

  const cohorts = await db.cohort.findMany({
    select: { id: true, name: true },
  })

  let updated = 0
  for (const cohort of cohorts) {
    await db.questionnaireBundle.upsert({
      where: { cohortId: cohort.id },
      create: {
        cohortId: cohort.id,
        bundleJson: bundleJson as any,
      },
      update: {
        bundleJson: bundleJson as any,
      },
    })
    updated += 1
    console.log(`Updated questionnaire bundle for cohort: ${cohort.name}`)
  }

  console.log(`Done. Updated ${updated} cohorts.`)
}

reseedQuestionnaireBundles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to reseed questionnaire bundles:", error)
    process.exit(1)
  })
