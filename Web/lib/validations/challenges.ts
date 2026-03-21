import { z } from "zod"

export const enrollInChallengeSchema = z.object({
  cohortId: z.string().uuid(),
})

export const challengeProgressQuerySchema = z.object({
  cohortId: z.string().uuid(),
})

export const challengeListQuerySchema = z.object({
  status: z.enum(["active", "completed", "all"]).optional().default("all"),
})
