import fs from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import {
  CreditPeriodType,
  CreditProductMode,
  PrismaClient,
  Role,
  SessionStatus,
} from "@prisma/client"
import { normalizeClassType, isMvpClassType } from "../lib/classes-domain"

const prisma = new PrismaClient()

const DEFAULT_BUNDLE_PATH = "/private/tmp/teamup_seed_bundle_2026-02-21.json"
const DEFAULT_EVENTS_PATH = "/private/tmp/teamup_events_all_active.json"
const DEFAULT_LEGACY_EVENTS_PATH = "/Users/adambrown/Developer/centurion/testing/teamupdata.json"
const DEFAULT_INSTRUCTORS_PATH = "/Users/adambrown/Developer/centurion/testing/instructors.json"
const DEFAULT_MEMBERSHIPS_PATH = "/Users/adambrown/Developer/centurion/testing/memberships.json"

const INSTRUCTOR_EMAIL_OVERRIDES: Record<string, string> = {
  "Gav Cunningham": "coachgav@gcgyms.com",
  "Conor Bates": "coachconor@gcgyms.com",
  "Jacki Montgomery": "coachjacki@gcgyms.com",
  "Rory Stephens": "coachrory@gcgyms.com",
  "Clare Cuming": "coachclare@gcgyms.com",
  "Josh Bunting": "coachjosh@gcgyms.com",
}

const CANONICAL_CREDIT_PRODUCTS = [
  {
    name: "Kickstarter – 6 Week Challenge",
    appliesToClassTypes: ["HIIT", "CORE", "STRENGTH"],
    creditMode: CreditProductMode.ONE_TIME_PACK,
    creditsPerPeriod: 30,
    periodType: CreditPeriodType.ONE_TIME,
    purchasePriceGbp: 297,
    purchasableByProviderOnly: false,
    note: "6 weeks × ~5 sessions/week. HR monitor included.",
  },
  {
    name: "Committed – 6 Month Membership",
    appliesToClassTypes: ["HIIT", "CORE", "STRENGTH"],
    creditMode: CreditProductMode.MONTHLY_TOPUP,
    creditsPerPeriod: 20,
    periodType: CreditPeriodType.MONTH,
    purchasePriceGbp: 109,
    purchasableByProviderOnly: false,
    note: "Standard membership allowance.",
  },
  {
    name: "Totally Committed – 12 Month Membership",
    appliesToClassTypes: ["HIIT", "CORE", "STRENGTH"],
    creditMode: CreditProductMode.MONTHLY_TOPUP,
    creditsPerPeriod: 20,
    periodType: CreditPeriodType.MONTH,
    purchasePriceGbp: 99,
    purchasableByProviderOnly: false,
    note: "Discounted annual membership.",
  },
  {
    name: "1 Session Pass",
    appliesToClassTypes: ["HIIT", "CORE", "STRENGTH"],
    creditMode: CreditProductMode.ONE_TIME_PACK,
    creditsPerPeriod: 1,
    periodType: CreditPeriodType.ONE_TIME,
    purchasePriceGbp: 9.99,
    purchasableByProviderOnly: false,
    note: "Drop-in class.",
  },
  {
    name: "2025 6 Months x 3",
    appliesToClassTypes: ["HIIT", "CORE", "STRENGTH"],
    creditMode: CreditProductMode.MONTHLY_TOPUP,
    creditsPerPeriod: 24,
    periodType: CreditPeriodType.MONTH,
    purchasePriceGbp: null,
    purchasableByProviderOnly: true,
    note: "Provider-created structured programme.",
  },
]

function getArg(flag: string, fallback?: string): string | undefined {
  const prefixed = process.argv.find((arg) => arg.startsWith(`${flag}=`))
  if (prefixed) {
    return prefixed.slice(flag.length + 1)
  }

  const idx = process.argv.indexOf(flag)
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1]
  }

  return fallback
}

function loadJsonIfExists(filePath: string | undefined): any | null {
  if (!filePath) return null
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function pickArray(payload: any, candidates: string[] = ["results", "data", "items"]): any[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload

  for (const key of candidates) {
    if (Array.isArray(payload[key])) {
      return payload[key]
    }
  }

  return []
}

function stripHtml(input: string | null | undefined): string {
  if (!input) return ""
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function coachEmailFromName(name: string): string {
  if (INSTRUCTOR_EMAIL_OVERRIDES[name]) {
    return INSTRUCTOR_EMAIL_OVERRIDES[name]
  }

  const firstName = name.trim().split(/\s+/)[0]?.toLowerCase() || "coach"
  return `coach${firstName}@gcgyms.com`
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function dateWithinWindow(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
}

function buildEventWindow(now: Date, weeks: number) {
  const start = new Date(now)
  const end = new Date(now)
  end.setUTCDate(end.getUTCDate() + weeks * 7)
  return { start, end }
}

async function upsertCoachUser(instructor: { id?: number; name: string }) {
  const email = coachEmailFromName(instructor.name)
  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      roles: true,
      passwordHash: true,
      name: true,
      onboardingComplete: true,
    },
  })

  if (existing) {
    const roles = Array.from(new Set([...(existing.roles || []), Role.COACH])) as Role[]
    const updated = await prisma.user.update({
      where: { email },
      data: {
        name: existing.name || instructor.name,
        roles,
        onboardingComplete: existing.onboardingComplete || true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })
    return updated
  }

  const passwordHash = await bcrypt.hash("CoachFitTemp!123", 10)

  return prisma.user.create({
    data: {
      email,
      name: instructor.name,
      roles: [Role.COACH],
      passwordHash,
      mustChangePassword: false,
      onboardingComplete: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })
}

function resolveEventClassType(event: any): string {
  const candidates = [event?.name, event?.offering_type?.name, event?.category?.name]
  for (const candidate of candidates) {
    const normalized = normalizeClassType(candidate)
    if (normalized) return normalized
  }
  return ""
}

function getEventDescription(event: any): string {
  return stripHtml(event?.description || event?.offering_type?.description || "")
}

function resolveWaitlistCapacity(event: any): number {
  const fromOverride = Number(event?.waitlist_max_override)
  if (Number.isFinite(fromOverride) && fromOverride >= 0) return fromOverride

  const fromOffering = Number(event?.offering_type?.waitlist_max)
  if (Number.isFinite(fromOffering) && fromOffering >= 0) return fromOffering

  return 10
}

function resolveCapacity(event: any): number {
  const value = Number(event?.max_occupancy)
  if (Number.isFinite(value) && value > 0) return value
  return 20
}

function resolveBookingOpenHours(event: any): number {
  const startsAt = toDate(event?.starts_at)
  const registrationsOpenAt = toDate(event?.registrations_open_at)
  if (startsAt && registrationsOpenAt) {
    const diffHours = Math.round((startsAt.getTime() - registrationsOpenAt.getTime()) / (60 * 60 * 1000))
    if (diffHours >= 0 && diffHours <= 24 * 60) {
      return diffHours
    }
  }
  return 24 * 14
}

function resolveBookingCloseMinutes(event: any): number {
  const startsAt = toDate(event?.starts_at)
  const registrationsCloseAt = toDate(event?.registrations_close_at)
  if (startsAt && registrationsCloseAt) {
    const diffMinutes = Math.round((startsAt.getTime() - registrationsCloseAt.getTime()) / (60 * 1000))
    if (diffMinutes >= 0 && diffMinutes <= 24 * 60) {
      return diffMinutes
    }
  }
  return 0
}

function resolveCancelCutoffMinutes(event: any): number {
  const startsAt = toDate(event?.starts_at)
  const lateCancelDeadline = toDate(event?.late_cancel_deadline)
  if (startsAt && lateCancelDeadline) {
    const diffMinutes = Math.round((startsAt.getTime() - lateCancelDeadline.getTime()) / (60 * 1000))
    if (diffMinutes >= 0 && diffMinutes <= 24 * 60) {
      return diffMinutes
    }
  }

  const fromOffering = Number(event?.offering_type?.cancellation_notice_interval)
  if (Number.isFinite(fromOffering) && fromOffering >= 0 && fromOffering <= 24 * 60) {
    return fromOffering
  }

  return 60
}

function resolveEvents(inputs: {
  bundle: any | null
  eventsJson: any | null
  legacyEvents: any | null
}): any[] {
  const bundleEvents = pickArray(inputs.bundle?.data?.events_12w)
  if (bundleEvents.length > 0) return bundleEvents

  const eventsFromFile = pickArray(inputs.eventsJson)
  if (eventsFromFile.length > 0) return eventsFromFile

  return pickArray(inputs.legacyEvents)
}

function resolveInstructors(inputs: {
  bundle: any | null
  instructorsJson: any | null
}): any[] {
  const bundleInstructors = pickArray(inputs.bundle?.data?.instructors)
  if (bundleInstructors.length > 0) return bundleInstructors
  return pickArray(inputs.instructorsJson)
}

function resolveMemberships(inputs: {
  bundle: any | null
  membershipsJson: any | null
}): any[] {
  const bundleMemberships = pickArray(inputs.bundle?.data?.memberships)
  if (bundleMemberships.length > 0) return bundleMemberships
  return pickArray(inputs.membershipsJson)
}

async function seedCreditProducts(memberships: any[]) {
  let canonicalCreatedOrUpdated = 0
  let catalogCreatedOrUpdated = 0

  for (const product of CANONICAL_CREDIT_PRODUCTS) {
    const existing = await prisma.creditProduct.findFirst({
      where: { name: product.name },
      select: { id: true },
    })

    const payload = {
      name: product.name,
      description: product.note,
      appliesToClassTypes: product.appliesToClassTypes,
      creditMode: product.creditMode,
      creditsPerPeriod: product.creditsPerPeriod,
      periodType: product.periodType,
      purchasePriceGbp: product.purchasePriceGbp,
      currency: "GBP",
      purchasableByProviderOnly: product.purchasableByProviderOnly,
      classEligible: true,
      isActive: true,
      externalSource: "manual",
      externalId: null,
    }

    if (existing) {
      await prisma.creditProduct.update({
        where: { id: existing.id },
        data: payload,
      })
    } else {
      await prisma.creditProduct.create({
        data: payload,
      })
    }

    canonicalCreatedOrUpdated += 1
  }

  const canonicalNameSet = new Set(CANONICAL_CREDIT_PRODUCTS.map((product) => product.name))

  for (const membership of memberships) {
    const membershipName = String(membership?.name || "").trim()
    if (!membershipName) continue
    if (canonicalNameSet.has(membershipName)) continue

    const membershipId = String(membership?.id || "")
    const priceDecimal =
      typeof membership?.price?.decimal === "number" ? membership.price.decimal : null

    const existing = await prisma.creditProduct.findFirst({
      where: {
        externalSource: "teamup",
        externalId: membershipId,
      },
      select: { id: true },
    })

    const payload = {
      name: membershipName,
      description: stripHtml(membership?.description || "") || null,
      appliesToClassTypes: [],
      creditMode: CreditProductMode.CATALOG_ONLY,
      creditsPerPeriod: null,
      periodType: CreditPeriodType.ONE_TIME,
      purchasePriceGbp: priceDecimal,
      currency: "GBP",
      purchasableByProviderOnly: Boolean(membership?.purchasable_only_by_provider),
      classEligible: false,
      isActive: true,
      externalSource: "teamup",
      externalId: membershipId,
    }

    if (existing) {
      await prisma.creditProduct.update({
        where: { id: existing.id },
        data: payload,
      })
    } else {
      await prisma.creditProduct.create({
        data: payload,
      })
    }

    catalogCreatedOrUpdated += 1
  }

  return {
    canonicalCreatedOrUpdated,
    catalogCreatedOrUpdated,
  }
}

async function main() {
  const bundlePath = getArg("--bundle", DEFAULT_BUNDLE_PATH)
  const eventsPath = getArg("--events", DEFAULT_EVENTS_PATH)
  const legacyEventsPath = getArg("--legacy-events", DEFAULT_LEGACY_EVENTS_PATH)
  const instructorsPath = getArg("--instructors", DEFAULT_INSTRUCTORS_PATH)
  const membershipsPath = getArg("--memberships", DEFAULT_MEMBERSHIPS_PATH)
  const weeks = Number(getArg("--weeks", "12"))

  const bundle = loadJsonIfExists(bundlePath)
  const eventsJson = loadJsonIfExists(eventsPath)
  const legacyEvents = loadJsonIfExists(legacyEventsPath)
  const instructorsJson = loadJsonIfExists(instructorsPath)
  const membershipsJson = loadJsonIfExists(membershipsPath)

  const instructors = resolveInstructors({ bundle, instructorsJson })
  const memberships = resolveMemberships({ bundle, membershipsJson })
  const allEvents = resolveEvents({ bundle, eventsJson, legacyEvents })

  if (allEvents.length === 0) {
    throw new Error("No TeamUp events found from provided sources")
  }

  const now = new Date()
  const { start, end } = buildEventWindow(now, Number.isFinite(weeks) && weeks > 0 ? weeks : 12)

  const coachesByName = new Map<string, { id: string; email: string; name: string | null }>()
  for (const instructor of instructors) {
    const name = String(instructor?.name || "").trim()
    if (!name) continue
    const coach = await upsertCoachUser({ id: instructor?.id, name })
    coachesByName.set(name, coach)
  }

  // Ensure hardcoded instructors always exist, even if API payload changes.
  for (const [name] of Object.entries(INSTRUCTOR_EMAIL_OVERRIDES)) {
    if (!coachesByName.has(name)) {
      const coach = await upsertCoachUser({ name })
      coachesByName.set(name, coach)
    }
  }

  const filteredEvents = allEvents
    .map((event) => {
      const startsAt = toDate(event?.starts_at)
      const endsAt = toDate(event?.ends_at)
      if (!startsAt || !endsAt) return null

      const classType = resolveEventClassType(event)
      if (!isMvpClassType(classType)) return null
      if (!dateWithinWindow(startsAt, start, end)) return null

      const instructorName = String(event?.instructors?.[0]?.name || "").trim()
      const coach =
        (instructorName ? coachesByName.get(instructorName) : null) ||
        coachesByName.get("Gav Cunningham") ||
        Array.from(coachesByName.values())[0]

      if (!coach) {
        return null
      }

      return {
        sourceEventId: String(event?.id || ""),
        classType,
        startsAt,
        endsAt,
        instructorName,
        instructorId: coach.id,
        locationLabel: String(event?.venue?.name || "Main Facility").trim() || "Main Facility",
        description: getEventDescription(event),
        capacity: resolveCapacity(event),
        waitlistCapacity: resolveWaitlistCapacity(event),
        bookingOpenHoursBefore: resolveBookingOpenHours(event),
        bookingCloseMinutesBefore: resolveBookingCloseMinutes(event),
        cancelCutoffMinutes: resolveCancelCutoffMinutes(event),
      }
    })
    .filter(Boolean) as Array<{
    sourceEventId: string
    classType: string
    startsAt: Date
    endsAt: Date
    instructorName: string
    instructorId: string
    locationLabel: string
    description: string
    capacity: number
    waitlistCapacity: number
    bookingOpenHoursBefore: number
    bookingCloseMinutesBefore: number
    cancelCutoffMinutes: number
  }>

  const templateCache = new Map<string, { id: string; capacity: number }>()
  let templatesCreated = 0
  let templatesUpdated = 0

  for (const event of filteredEvents) {
    const templateKey = `${event.instructorId}:${event.classType}:${event.locationLabel}`
    if (templateCache.has(templateKey)) continue

    const existingTemplate = await prisma.classTemplate.findFirst({
      where: {
        ownerCoachId: event.instructorId,
        name: event.classType,
        classType: event.classType,
        locationLabel: event.locationLabel,
      },
      select: {
        id: true,
        capacity: true,
      },
    })

    if (existingTemplate) {
      const updatedTemplate = await prisma.classTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          description: event.description || null,
          capacity: event.capacity,
          waitlistEnabled: true,
          waitlistCapacity: event.waitlistCapacity,
          bookingOpenHoursBefore: event.bookingOpenHoursBefore,
          bookingCloseMinutesBefore: event.bookingCloseMinutesBefore,
          cancelCutoffMinutes: event.cancelCutoffMinutes,
          creditsRequired: 1,
          isActive: true,
        },
        select: {
          id: true,
          capacity: true,
        },
      })

      templateCache.set(templateKey, updatedTemplate)
      templatesUpdated += 1
      continue
    }

    const createdTemplate = await prisma.classTemplate.create({
      data: {
        ownerCoachId: event.instructorId,
        name: event.classType,
        classType: event.classType,
        description: event.description || null,
        scope: "FACILITY",
        locationLabel: event.locationLabel,
        roomLabel: null,
        capacity: event.capacity,
        waitlistEnabled: true,
        waitlistCapacity: event.waitlistCapacity,
        bookingOpenHoursBefore: event.bookingOpenHoursBefore,
        bookingCloseMinutesBefore: event.bookingCloseMinutesBefore,
        cancelCutoffMinutes: event.cancelCutoffMinutes,
        creditsRequired: 1,
        isActive: true,
      },
      select: {
        id: true,
        capacity: true,
      },
    })

    templateCache.set(templateKey, createdTemplate)
    templatesCreated += 1
  }

  const templateIds = Array.from(templateCache.values()).map((template) => template.id)

  const existingSessions = await prisma.classSession.findMany({
    where: {
      classTemplateId: { in: templateIds.length > 0 ? templateIds : ["00000000-0000-0000-0000-000000000000"] },
      startsAt: {
        gte: start,
        lte: end,
      },
    },
    select: {
      classTemplateId: true,
      startsAt: true,
    },
  })

  const existingSessionSet = new Set(
    existingSessions.map((row) => `${row.classTemplateId}:${row.startsAt.toISOString()}`),
  )

  const sessionsToCreate: Array<{
    classTemplateId: string
    instructorId: string | null
    startsAt: Date
    endsAt: Date
    capacityOverride: number | null
    status: SessionStatus
    cancelReason: string | null
  }> = []

  for (const event of filteredEvents) {
    const templateKey = `${event.instructorId}:${event.classType}:${event.locationLabel}`
    const template = templateCache.get(templateKey)
    if (!template) continue

    const dedupeKey = `${template.id}:${event.startsAt.toISOString()}`
    if (existingSessionSet.has(dedupeKey)) {
      continue
    }

    sessionsToCreate.push({
      classTemplateId: template.id,
      instructorId: event.instructorId,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      capacityOverride: event.capacity !== template.capacity ? event.capacity : null,
      status: SessionStatus.SCHEDULED,
      cancelReason: null,
    })

    existingSessionSet.add(dedupeKey)
  }

  let sessionsCreated = 0
  if (sessionsToCreate.length > 0) {
    const chunkSize = 500
    for (let i = 0; i < sessionsToCreate.length; i += chunkSize) {
      const chunk = sessionsToCreate.slice(i, i + chunkSize)
      const result = await prisma.classSession.createMany({
        data: chunk,
      })
      sessionsCreated += result.count
    }
  }

  const creditProductStats = await seedCreditProducts(memberships)

  console.log("TeamUp seed import complete")
  console.log(
    JSON.stringify(
      {
        sources: {
          bundlePath,
          eventsPath,
          legacyEventsPath,
          instructorsPath,
          membershipsPath,
        },
        windows: {
          from: start.toISOString(),
          to: end.toISOString(),
          weeks,
        },
        counts: {
          instructorsFound: instructors.length,
          coachesEnsured: coachesByName.size,
          sourceEvents: allEvents.length,
          filteredEvents: filteredEvents.length,
          templatesCreated,
          templatesUpdated,
          sessionsCreated,
          canonicalCreditProductsSeeded: creditProductStats.canonicalCreatedOrUpdated,
          catalogCreditProductsSeeded: creditProductStats.catalogCreatedOrUpdated,
        },
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error("TeamUp seed import failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
