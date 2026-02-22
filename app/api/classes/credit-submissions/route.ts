import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"

const querySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  clientId: z.string().uuid().optional(),
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
      status: searchParams.get("status") || undefined,
      clientId: searchParams.get("clientId") || undefined,
    })

    const where: any = {
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.clientId ? { clientId: parsed.clientId } : {}),
    }

    if (!isAdmin(session.user)) {
      where.AND = [
        {
          OR: [
            { client: { invitedByCoachId: session.user.id } },
            {
              client: {
                CohortMembership: {
                  some: {
                    Cohort: {
                      OR: [
                        { coachId: session.user.id },
                        { coachMemberships: { some: { coachId: session.user.id } } },
                      ],
                    },
                  },
                },
              },
            },
            { creditProduct: { ownerCoachId: session.user.id } },
          ],
        },
      ]
    }

    const submissions = await db.creditSubmission.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creditProduct: {
          select: {
            id: true,
            name: true,
            creditMode: true,
            creditsPerPeriod: true,
            classEligible: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 300,
    })

    return NextResponse.json({ submissions }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 },
      )
    }

    console.error("Error loading credit submissions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
