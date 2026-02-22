import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { classSessionQuerySchema } from "@/lib/validations"
import { getCoachAccessibleSessionWhere } from "@/lib/classes-service"

const querySchema = classSessionQuerySchema.extend({
  status: z.enum(["SCHEDULED", "CANCELLED", "COMPLETED"]).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const parsed = querySchema.parse({
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      ownerCoachId: searchParams.get("ownerCoachId") || undefined,
      cohortId: searchParams.get("cohortId") || undefined,
      classType: searchParams.get("classType") || undefined,
      status: searchParams.get("status") || undefined,
    })

    const where: any = {
      ...(parsed.from || parsed.to
        ? {
            startsAt: {
              ...(parsed.from ? { gte: new Date(parsed.from) } : {}),
              ...(parsed.to ? { lte: new Date(parsed.to) } : {}),
            },
          }
        : {
            startsAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            },
          }),
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.classType ? { classTemplate: { classType: parsed.classType } } : {}),
      ...(parsed.cohortId ? { classTemplate: { cohortId: parsed.cohortId } } : {}),
      ...(parsed.ownerCoachId ? { classTemplate: { ownerCoachId: parsed.ownerCoachId } } : {}),
    }

    if (!isAdmin(session.user)) {
      where.AND = [getCoachAccessibleSessionWhere(session.user.id)]
    }

    const sessions = await db.classSession.findMany({
      where,
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        classTemplate: {
          include: {
            ownerCoach: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            cohort: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  in: ["BOOKED", "WAITLISTED", "ATTENDED", "NO_SHOW"],
                },
              },
            },
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
      take: 500,
    })

    return NextResponse.json({ sessions }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 },
      )
    }

    console.error("Error listing sessions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
