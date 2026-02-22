import {
  BookingSource,
  BookingStatus,
  CreditLedgerReason,
  CreditProductMode,
  CreditSubmissionStatus,
  Prisma,
  SessionStatus,
} from "@prisma/client"
import { db } from "@/lib/db"
import { getSystemSettings } from "@/lib/system-settings"
import {
  canJoinWaitlist,
  getEffectiveSessionCapacity,
  isBookingOpen,
  isLateCancel,
  resolveBookingPolicy,
} from "@/lib/classes-policy"
import {
  getAvailableCreditsFromLedger,
  getSessionOccupancyCounts,
  monthKey,
  shouldApplyMonthlyTopup,
  endOfMonthUtc,
} from "@/lib/classes-domain"
import { sendClassNotification } from "@/lib/classes-notifications"
import type { AuditActor } from "@/lib/audit-log"

export class ClassBookingError extends Error {
  statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}

export function isClassBookingError(error: unknown): error is ClassBookingError {
  return error instanceof ClassBookingError
}

export function getCoachAccessibleTemplateWhere(userId: string): Prisma.ClassTemplateWhereInput {
  return {
    OR: [
      { ownerCoachId: userId },
      { cohort: { coachId: userId } },
      { cohort: { coachMemberships: { some: { coachId: userId } } } },
    ],
  }
}

export function getCoachAccessibleSessionWhere(userId: string): Prisma.ClassSessionWhereInput {
  return {
    OR: [
      { classTemplate: { ownerCoachId: userId } },
      { classTemplate: { cohort: { coachId: userId } } },
      { classTemplate: { cohort: { coachMemberships: { some: { coachId: userId } } } } },
      { instructorId: userId },
    ],
  }
}

async function ensureCreditAccountTx(tx: any, clientId: string) {
  return tx.clientCreditAccount.upsert({
    where: { clientId },
    create: {
      clientId,
      balance: 0,
    },
    update: {},
  })
}

export async function getAvailableCreditsTx(
  tx: any,
  clientId: string,
  at: Date = new Date(),
): Promise<number> {
  const ledgerRows = await tx.clientCreditLedger.findMany({
    where: {
      clientId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
    },
    select: {
      deltaCredits: true,
      expiresAt: true,
    },
  })

  return getAvailableCreditsFromLedger(ledgerRows, at)
}

export async function refreshClientCreditBalanceTx(
  tx: any,
  clientId: string,
  at: Date = new Date(),
): Promise<number> {
  await ensureCreditAccountTx(tx, clientId)
  const availableCredits = await getAvailableCreditsTx(tx, clientId, at)

  await tx.clientCreditAccount.update({
    where: { clientId },
    data: { balance: availableCredits },
  })

  return availableCredits
}

export async function addLedgerEntryTx(
  tx: any,
  input: {
    clientId: string
    deltaCredits: number
    reason: CreditLedgerReason
    bookingId?: string | null
    submissionId?: string | null
    creditProductId?: string | null
    subscriptionId?: string | null
    expiresAt?: Date | null
    createdByUserId?: string | null
  },
): Promise<number> {
  await ensureCreditAccountTx(tx, input.clientId)

  await tx.clientCreditLedger.create({
    data: {
      clientId: input.clientId,
      deltaCredits: input.deltaCredits,
      reason: input.reason,
      bookingId: input.bookingId ?? null,
      submissionId: input.submissionId ?? null,
      creditProductId: input.creditProductId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      expiresAt: input.expiresAt ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
  })

  return refreshClientCreditBalanceTx(tx, input.clientId)
}

async function normalizeWaitlistPositionsTx(tx: any, sessionId: string): Promise<void> {
  const waitlisted = await tx.classBooking.findMany({
    where: {
      sessionId,
      status: BookingStatus.WAITLISTED,
    },
    orderBy: [{ waitlistPosition: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
    },
  })

  for (let idx = 0; idx < waitlisted.length; idx += 1) {
    await tx.classBooking.update({
      where: { id: waitlisted[idx].id },
      data: { waitlistPosition: idx + 1 },
    })
  }
}

async function getSessionForBookingTx(tx: any, sessionId: string) {
  const session = await tx.classSession.findUnique({
    where: { id: sessionId },
    include: {
      classTemplate: true,
      bookings: {
        where: {
          status: {
            in: [
              BookingStatus.BOOKED,
              BookingStatus.WAITLISTED,
              BookingStatus.ATTENDED,
              BookingStatus.NO_SHOW,
            ],
          },
        },
      },
    },
  })

  if (!session) {
    throw new ClassBookingError("Session not found", 404)
  }

  if (session.status !== SessionStatus.SCHEDULED) {
    throw new ClassBookingError("Session is not available for booking", 400)
  }

  return session
}

export async function bookClientIntoSessionTx(
  tx: any,
  input: {
    sessionId: string
    clientId: string
    source: BookingSource
    actorUserId?: string | null
    skipCreditValidation?: boolean
    enforceBookingWindow?: boolean
    now?: Date
    settingsDefaults?: {
      bookingOpenHoursDefault?: number
      bookingCloseMinutesDefault?: number
      lateCancelCutoffMinutesDefault?: number
      defaultWaitlistCap?: number
      defaultClassCapacity?: number
      defaultCreditsPerBooking?: number
    }
  },
) {
  const now = input.now ?? new Date()
  const session = await getSessionForBookingTx(tx, input.sessionId)

  const policy = resolveBookingPolicy(
    {
      bookingOpenHoursBefore: session.classTemplate.bookingOpenHoursBefore,
      bookingCloseMinutesBefore: session.classTemplate.bookingCloseMinutesBefore,
      cancelCutoffMinutes: session.classTemplate.cancelCutoffMinutes,
      waitlistCapacity: session.classTemplate.waitlistCapacity,
      capacity: session.classTemplate.capacity,
    },
    {
      bookingOpenHoursBefore: input.settingsDefaults?.bookingOpenHoursDefault,
      bookingCloseMinutesBefore: input.settingsDefaults?.bookingCloseMinutesDefault,
      cancelCutoffMinutes: input.settingsDefaults?.lateCancelCutoffMinutesDefault,
      waitlistCapacity: input.settingsDefaults?.defaultWaitlistCap,
      capacity: input.settingsDefaults?.defaultClassCapacity,
    },
  )

  if (input.enforceBookingWindow !== false && !isBookingOpen(now, session.startsAt, policy)) {
    throw new ClassBookingError("Booking window is closed for this session", 400)
  }

  const existing = await tx.classBooking.findUnique({
    where: {
      sessionId_clientId: {
        sessionId: input.sessionId,
        clientId: input.clientId,
      },
    },
  })

  if (existing && [BookingStatus.BOOKED, BookingStatus.WAITLISTED].includes(existing.status)) {
    return { booking: existing, result: "already_exists" as const }
  }

  const capacity = getEffectiveSessionCapacity(session.classTemplate, {
    capacityOverride: session.capacityOverride,
  })

  const { bookedCount, waitlistedCount } = getSessionOccupancyCounts(session.bookings)
  const creditsRequired =
    session.classTemplate.creditsRequired ?? input.settingsDefaults?.defaultCreditsPerBooking ?? 1

  const upsertBase = {
    sessionId: input.sessionId,
    clientId: input.clientId,
    source: input.source,
    bookedByUserId: input.actorUserId ?? null,
    canceledAt: null,
    attendanceMarkedAt: null,
  }

  const upsertWhere = {
    sessionId_clientId: {
      sessionId: input.sessionId,
      clientId: input.clientId,
    },
  }

  if (bookedCount >= capacity) {
    if (!session.classTemplate.waitlistEnabled || !canJoinWaitlist(waitlistedCount, policy)) {
      throw new ClassBookingError("Class is full and waitlist is unavailable", 409)
    }

    const waitlistPosition = waitlistedCount + 1

    const booking = await tx.classBooking.upsert({
      where: upsertWhere,
      create: {
        ...upsertBase,
        status: BookingStatus.WAITLISTED,
        waitlistPosition,
      },
      update: {
        ...upsertBase,
        status: BookingStatus.WAITLISTED,
        waitlistPosition,
      },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            name: true,
            isTestUser: true,
          },
        },
      },
    })

    return {
      booking,
      result: "waitlisted" as const,
      waitlistPosition,
      session,
    }
  }

  const skipCreditValidation = Boolean(input.skipCreditValidation)

  if (!skipCreditValidation && creditsRequired > 0) {
    const available = await getAvailableCreditsTx(tx, input.clientId, now)
    if (available < creditsRequired) {
      throw new ClassBookingError("Insufficient class credits", 402)
    }
  }

  const booking = await tx.classBooking.upsert({
    where: upsertWhere,
    create: {
      ...upsertBase,
      status: BookingStatus.BOOKED,
      waitlistPosition: null,
    },
    update: {
      ...upsertBase,
      status: BookingStatus.BOOKED,
      waitlistPosition: null,
    },
    include: {
      client: {
        select: {
          id: true,
          email: true,
          name: true,
          isTestUser: true,
        },
      },
    },
  })

  if (!skipCreditValidation && creditsRequired > 0) {
    await addLedgerEntryTx(tx, {
      clientId: input.clientId,
      deltaCredits: -creditsRequired,
      reason: CreditLedgerReason.BOOKING_DEBIT,
      bookingId: booking.id,
      createdByUserId: input.actorUserId ?? null,
    })
  }

  return {
    booking,
    result: "booked" as const,
    session,
  }
}

export async function promoteWaitlistForSessionTx(
  tx: any,
  input: {
    sessionId: string
    actorUserId?: string | null
    now?: Date
    settingsDefaults?: {
      defaultClassCapacity?: number
      defaultCreditsPerBooking?: number
    }
  },
) {
  const now = input.now ?? new Date()

  const session = await tx.classSession.findUnique({
    where: { id: input.sessionId },
    include: {
      classTemplate: true,
      bookings: {
        where: {
          status: {
            in: [
              BookingStatus.BOOKED,
              BookingStatus.WAITLISTED,
              BookingStatus.ATTENDED,
              BookingStatus.NO_SHOW,
            ],
          },
        },
        include: {
          client: {
            select: {
              id: true,
              email: true,
              name: true,
              isTestUser: true,
            },
          },
        },
        orderBy: [{ waitlistPosition: "asc" }, { createdAt: "asc" }],
      },
    },
  })

  if (!session || session.status !== SessionStatus.SCHEDULED) {
    return []
  }

  if (session.startsAt.getTime() <= now.getTime()) {
    return []
  }

  const capacity = getEffectiveSessionCapacity(session.classTemplate, {
    capacityOverride: session.capacityOverride,
  })

  const { bookedCount } = getSessionOccupancyCounts(session.bookings)
  let seatsToFill = Math.max(0, capacity - bookedCount)

  if (seatsToFill === 0) {
    return []
  }

  const creditsRequired =
    session.classTemplate.creditsRequired ?? input.settingsDefaults?.defaultCreditsPerBooking ?? 1

  const waitlisted = session.bookings.filter((booking: any) => booking.status === BookingStatus.WAITLISTED)

  const promoted: any[] = []

  for (const booking of waitlisted) {
    if (seatsToFill <= 0) break

    if (creditsRequired > 0) {
      const available = await getAvailableCreditsTx(tx, booking.clientId, now)
      if (available < creditsRequired) {
        continue
      }
    }

    const updated = await tx.classBooking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.BOOKED,
        waitlistPosition: null,
        bookedByUserId: input.actorUserId ?? booking.bookedByUserId ?? null,
      },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            name: true,
            isTestUser: true,
          },
        },
        session: {
          include: {
            classTemplate: true,
          },
        },
      },
    })

    if (creditsRequired > 0) {
      await addLedgerEntryTx(tx, {
        clientId: booking.clientId,
        deltaCredits: -creditsRequired,
        reason: CreditLedgerReason.BOOKING_DEBIT,
        bookingId: booking.id,
        createdByUserId: input.actorUserId ?? null,
      })
    }

    promoted.push(updated)
    seatsToFill -= 1
  }

  await normalizeWaitlistPositionsTx(tx, input.sessionId)

  return promoted
}

export async function cancelBookingTx(
  tx: any,
  input: {
    bookingId: string
    actorUserId?: string | null
    now?: Date
    settingsDefaults?: {
      lateCancelCutoffMinutesDefault?: number
      defaultCreditsPerBooking?: number
      defaultClassCapacity?: number
    }
  },
) {
  const now = input.now ?? new Date()

  const booking = await tx.classBooking.findUnique({
    where: { id: input.bookingId },
    include: {
      client: {
        select: {
          id: true,
          email: true,
          name: true,
          isTestUser: true,
        },
      },
      session: {
        include: {
          classTemplate: true,
        },
      },
    },
  })

  if (!booking) {
    throw new ClassBookingError("Booking not found", 404)
  }

  if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.LATE_CANCEL) {
    return { booking, result: "already_cancelled" as const, promoted: [] }
  }

  if (booking.status === BookingStatus.ATTENDED || booking.status === BookingStatus.NO_SHOW) {
    throw new ClassBookingError("Attendance already marked; booking cannot be cancelled", 400)
  }

  const policy = resolveBookingPolicy(
    {
      bookingOpenHoursBefore: booking.session.classTemplate.bookingOpenHoursBefore,
      bookingCloseMinutesBefore: booking.session.classTemplate.bookingCloseMinutesBefore,
      cancelCutoffMinutes: booking.session.classTemplate.cancelCutoffMinutes,
      waitlistCapacity: booking.session.classTemplate.waitlistCapacity,
      capacity: booking.session.classTemplate.capacity,
    },
    {
      cancelCutoffMinutes: input.settingsDefaults?.lateCancelCutoffMinutesDefault,
      capacity: input.settingsDefaults?.defaultClassCapacity,
    },
  )

  const lateCancel =
    booking.status === BookingStatus.BOOKED
      ? isLateCancel(now, booking.session.startsAt, policy)
      : false

  const nextStatus =
    booking.status === BookingStatus.BOOKED && lateCancel
      ? BookingStatus.LATE_CANCEL
      : BookingStatus.CANCELLED

  const updated = await tx.classBooking.update({
    where: { id: input.bookingId },
    data: {
      status: nextStatus,
      canceledAt: now,
      waitlistPosition: null,
    },
    include: {
      client: {
        select: {
          id: true,
          email: true,
          name: true,
          isTestUser: true,
        },
      },
      session: {
        include: {
          classTemplate: true,
        },
      },
    },
  })

  if (booking.status === BookingStatus.BOOKED && !lateCancel) {
    const debits = await tx.clientCreditLedger.aggregate({
      where: {
        bookingId: booking.id,
        reason: CreditLedgerReason.BOOKING_DEBIT,
      },
      _sum: {
        deltaCredits: true,
      },
    })

    const debitedCredits = Math.abs(Math.min(0, debits._sum.deltaCredits ?? 0))
    if (debitedCredits > 0) {
      await ensureCreditAccountTx(tx, booking.clientId)

      await tx.clientCreditLedger.create({
        data: {
          clientId: booking.clientId,
          deltaCredits: debitedCredits,
          reason: CreditLedgerReason.REFUND,
          bookingId: booking.id,
          createdByUserId: input.actorUserId ?? null,
        },
      })

      // Avoid an expensive full-ledger recompute inside this transaction.
      await tx.clientCreditAccount.update({
        where: { clientId: booking.clientId },
        data: {
          balance: {
            increment: debitedCredits,
          },
        },
      })

    }
  }

  await normalizeWaitlistPositionsTx(tx, booking.sessionId)

  const promoted = await promoteWaitlistForSessionTx(tx, {
    sessionId: booking.sessionId,
    actorUserId: input.actorUserId ?? null,
    now,
    settingsDefaults: {
      defaultClassCapacity: input.settingsDefaults?.defaultClassCapacity,
      defaultCreditsPerBooking: input.settingsDefaults?.defaultCreditsPerBooking,
    },
  })

  return { booking: updated, result: "cancelled" as const, lateCancel, promoted }
}

export async function getClientCreditSummary(clientId: string, at: Date = new Date()) {
  const [account, pendingSubmissions] = await Promise.all([
    db.clientCreditAccount.findUnique({
      where: { clientId },
      select: {
        id: true,
        balance: true,
        updatedAt: true,
      },
    }),
    db.creditSubmission.count({
      where: {
        clientId,
        status: CreditSubmissionStatus.PENDING,
      },
    }),
  ])

  const ledgerRows = await db.clientCreditLedger.findMany({
    where: {
      clientId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
    },
    select: {
      deltaCredits: true,
      expiresAt: true,
    },
  })

  const availableCredits = getAvailableCreditsFromLedger(ledgerRows, at)

  return {
    balance: account?.balance ?? availableCredits,
    availableCredits,
    pendingSubmissions,
  }
}

export async function reviewCreditSubmission(
  input: {
    submissionId: string
    action: "APPROVE" | "REJECT"
    reviewerId: string
  },
) {
  return db.$transaction(async (tx) => {
    const submission = await tx.creditSubmission.findUnique({
      where: { id: input.submissionId },
      include: {
        creditProduct: true,
      },
    })

    if (!submission) {
      throw new ClassBookingError("Credit submission not found", 404)
    }

    if (submission.status !== CreditSubmissionStatus.PENDING) {
      throw new ClassBookingError("Credit submission has already been reviewed", 400)
    }

    if (input.action === "REJECT") {
      const rejected = await tx.creditSubmission.update({
        where: { id: input.submissionId },
        data: {
          status: CreditSubmissionStatus.REJECTED,
          reviewedByUserId: input.reviewerId,
          reviewedAt: new Date(),
        },
        include: {
          client: {
            select: {
              id: true,
              email: true,
              name: true,
              isTestUser: true,
            },
          },
          creditProduct: true,
        },
      })

      return {
        submission: rejected,
        creditsApplied: 0,
      }
    }

    const approved = await tx.creditSubmission.update({
      where: { id: input.submissionId },
      data: {
        status: CreditSubmissionStatus.APPROVED,
        reviewedByUserId: input.reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            name: true,
            isTestUser: true,
          },
        },
        creditProduct: true,
      },
    })

    const now = new Date()
    const product = approved.creditProduct
    const credits = Math.max(0, product.creditsPerPeriod ?? 0)

    if (product.creditMode === CreditProductMode.ONE_TIME_PACK && credits > 0) {
      await addLedgerEntryTx(tx, {
        clientId: approved.clientId,
        deltaCredits: credits,
        reason: CreditLedgerReason.PACK_PURCHASE,
        submissionId: approved.id,
        creditProductId: product.id,
        createdByUserId: input.reviewerId,
      })
    }

    if (product.creditMode === CreditProductMode.MONTHLY_TOPUP && credits > 0) {
      const currentMonth = monthKey(now)
      const existingSubscription = await tx.clientCreditSubscription.findFirst({
        where: {
          clientId: approved.clientId,
          creditProductId: product.id,
          active: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      const subscription =
        existingSubscription ||
        (await tx.clientCreditSubscription.create({
          data: {
            clientId: approved.clientId,
            creditProductId: product.id,
            monthlyCredits: credits,
            startDate: now,
            lastAppliedMonth: null,
            active: true,
          },
        }))

      if (subscription.lastAppliedMonth !== currentMonth) {
        await addLedgerEntryTx(tx, {
          clientId: approved.clientId,
          deltaCredits: credits,
          reason: CreditLedgerReason.TOPUP_MONTHLY,
          submissionId: approved.id,
          creditProductId: product.id,
          subscriptionId: subscription.id,
          expiresAt: endOfMonthUtc(now),
          createdByUserId: input.reviewerId,
        })

        await tx.clientCreditSubscription.update({
          where: { id: subscription.id },
          data: {
            monthlyCredits: credits,
            lastAppliedMonth: currentMonth,
            active: true,
          },
        })
      }
    }

    await refreshClientCreditBalanceTx(tx, approved.clientId)

    return {
      submission: approved,
      creditsApplied: credits,
    }
  })
}

export async function runMonthlyCreditTopupAndExpiry(input?: {
  runAt?: Date
  actorUserId?: string | null
}) {
  const runAt = input?.runAt ?? new Date()
  const currentMonth = monthKey(runAt)
  const expiryAt = endOfMonthUtc(runAt)

  return db.$transaction(async (tx) => {
    const subscriptions = await tx.clientCreditSubscription.findMany({
      where: {
        active: true,
        creditProduct: {
          creditMode: CreditProductMode.MONTHLY_TOPUP,
          isActive: true,
          classEligible: true,
        },
      },
      include: {
        creditProduct: true,
      },
    })

    let topupsApplied = 0
    const touchedClients = new Set<string>()

    for (const subscription of subscriptions) {
      if (!shouldApplyMonthlyTopup(subscription, runAt)) {
        continue
      }

      const credits = Math.max(0, subscription.monthlyCredits)
      if (credits <= 0) {
        continue
      }

      await addLedgerEntryTx(tx, {
        clientId: subscription.clientId,
        deltaCredits: credits,
        reason: CreditLedgerReason.TOPUP_MONTHLY,
        creditProductId: subscription.creditProductId,
        subscriptionId: subscription.id,
        expiresAt: expiryAt,
        createdByUserId: input?.actorUserId ?? null,
      })

      await tx.clientCreditSubscription.update({
        where: { id: subscription.id },
        data: {
          lastAppliedMonth: currentMonth,
        },
      })

      topupsApplied += 1
      touchedClients.add(subscription.clientId)
    }

    const expiredRows = await tx.clientCreditLedger.findMany({
      where: {
        expiresAt: {
          lte: runAt,
        },
      },
      select: {
        clientId: true,
      },
      distinct: ["clientId"],
    })

    for (const row of expiredRows) {
      touchedClients.add(row.clientId)
    }

    let balancesRecalculated = 0
    for (const clientId of touchedClients) {
      await refreshClientCreditBalanceTx(tx, clientId, runAt)
      balancesRecalculated += 1
    }

    return {
      topupsApplied,
      balancesRecalculated,
      touchedClients: touchedClients.size,
    }
  })
}

export async function getClassBookingDefaults() {
  const settings = await getSystemSettings()
  return {
    bookingOpenHoursDefault: settings.bookingOpenHoursDefault,
    bookingCloseMinutesDefault: settings.bookingCloseMinutesDefault,
    lateCancelCutoffMinutesDefault: settings.lateCancelCutoffMinutesDefault,
    defaultWaitlistCap: settings.defaultWaitlistCap,
    defaultClassCapacity: settings.defaultClassCapacity,
    defaultCreditsPerBooking: settings.defaultCreditsPerBooking,
    bookingTimezone: settings.bookingTimezone,
  }
}

export async function sendBookingNotifications(input: {
  actor: AuditActor
  result:
    | {
        booking: any
        result: "booked" | "waitlisted" | "already_exists"
        waitlistPosition?: number
        session?: any
      }
    | null
  cancelledBooking?: any
  promotedBookings?: any[]
  timezone?: string | null
}) {
  const tasks: Promise<void>[] = []

  if (input.result?.result === "booked" && input.result.booking?.client && input.result.session) {
    tasks.push(
      sendClassNotification({
        actor: input.actor,
        recipient: input.result.booking.client,
        kind: "booked",
        className: input.result.session.classTemplate?.name || input.result.session.classTemplate?.classType || "Class",
        startsAt: input.result.session.startsAt,
        locationLabel: input.result.session.classTemplate?.locationLabel,
        timezone: input.timezone,
      }),
    )
  }

  if (input.result?.result === "waitlisted" && input.result.booking?.client && input.result.session) {
    tasks.push(
      sendClassNotification({
        actor: input.actor,
        recipient: input.result.booking.client,
        kind: "waitlisted",
        className: input.result.session.classTemplate?.name || input.result.session.classTemplate?.classType || "Class",
        startsAt: input.result.session.startsAt,
        locationLabel: input.result.session.classTemplate?.locationLabel,
        timezone: input.timezone,
        waitlistPosition: input.result.waitlistPosition,
      }),
    )
  }

  if (input.cancelledBooking?.client && input.cancelledBooking?.session) {
    tasks.push(
      sendClassNotification({
        actor: input.actor,
        recipient: input.cancelledBooking.client,
        kind: "cancelled",
        className:
          input.cancelledBooking.session.classTemplate?.name ||
          input.cancelledBooking.session.classTemplate?.classType ||
          "Class",
        startsAt: input.cancelledBooking.session.startsAt,
        locationLabel: input.cancelledBooking.session.classTemplate?.locationLabel,
        timezone: input.timezone,
      }),
    )
  }

  if (input.promotedBookings?.length) {
    for (const promoted of input.promotedBookings) {
      if (!promoted.client || !promoted.session) continue
      tasks.push(
        sendClassNotification({
          actor: input.actor,
          recipient: promoted.client,
          kind: "waitlist_promoted",
          className: promoted.session.classTemplate?.name || promoted.session.classTemplate?.classType || "Class",
          startsAt: promoted.session.startsAt,
          locationLabel: promoted.session.classTemplate?.locationLabel,
          timezone: input.timezone,
        }),
      )
    }
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks)
  }
}
