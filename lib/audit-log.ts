import { db } from "@/lib/db"
import { Role } from "@/lib/types"

export type AuditActor = {
  id: string
  email?: string | null
  name?: string | null
  roles?: Role[]
}

export type AuditLogInput = {
  actor: AuditActor
  actionType: string
  targetType: string
  targetId?: string | null
  details?: Record<string, any>
  reason?: string | null
  insightId?: string | null
}

export async function logAuditAction(input: AuditLogInput): Promise<void> {
  try {
    await db.adminAction.create({
      data: {
        adminId: input.actor.id,
        actionType: input.actionType,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        details: {
          actorEmail: input.actor.email ?? null,
          actorName: input.actor.name ?? null,
          actorRoles: input.actor.roles ?? [],
          ...(input.details ?? {}),
        },
        reason: input.reason ?? null,
        insightId: input.insightId ?? null,
      },
    })
  } catch (error) {
    console.error("Audit log write failed:", error)
  }
}
