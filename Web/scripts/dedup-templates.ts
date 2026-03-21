/**
 * One-off script to deduplicate ClassTemplates.
 *
 * Keeps the canonical template per classType (from the current seed),
 * reassigns orphaned sessions, and deletes duplicates.
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const CANONICAL: Record<string, string> = {
  HIIT: "40b8ee8f-7832-49d8-86fd-11fbaf532e6b",
  CORE: "53e5d55b-1679-4f7a-a32a-8335b0bbe129",
  Strength: "cd5fb9f4-a3ba-4a26-9b54-7304fd98c80b",
}

async function main() {
  const allTemplates = await db.classTemplate.findMany({
    select: { id: true, classType: true, name: true },
  })

  console.log(`Found ${allTemplates.length} total templates\n`)

  for (const [classType, canonicalId] of Object.entries(CANONICAL)) {
    const duplicates = allTemplates.filter(
      (t) => t.classType === classType && t.id !== canonicalId
    )

    if (duplicates.length === 0) {
      console.log(`${classType}: no duplicates`)
      continue
    }

    console.log(`${classType}: ${duplicates.length} duplicate(s) to remove`)

    for (const dup of duplicates) {
      // Reassign sessions from duplicate to canonical
      const reassigned = await db.classSession.updateMany({
        where: { classTemplateId: dup.id },
        data: { classTemplateId: canonicalId },
      })

      if (reassigned.count > 0) {
        console.log(`  Reassigned ${reassigned.count} sessions from ${dup.id} → ${canonicalId}`)
      }

      // Delete the duplicate template
      await db.classTemplate.delete({ where: { id: dup.id } })
      console.log(`  Deleted duplicate template ${dup.id} (${dup.name})`)
    }
  }

  // Also remove any templates with classTypes not in CANONICAL (unexpected)
  const knownTypes = Object.keys(CANONICAL)
  const unknownTemplates = allTemplates.filter(
    (t) => !knownTypes.includes(t.classType)
  )

  if (unknownTemplates.length > 0) {
    console.log(`\nFound ${unknownTemplates.length} template(s) with unknown classType:`)
    for (const t of unknownTemplates) {
      console.log(`  ${t.id} — ${t.classType} (${t.name})`)
    }
    console.log("  Leaving these untouched — review manually if needed")
  }

  // Final count
  const remaining = await db.classTemplate.count()
  console.log(`\nDone. ${remaining} template(s) remaining.`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
