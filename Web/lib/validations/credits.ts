import { z } from "zod"

export const createCreditProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(1000).optional(),
  creditMode: z.enum(["MONTHLY_TOPUP", "ONE_TIME_PACK", "CATALOG_ONLY"]),
  creditsPerPeriod: z.number().int().positive().optional(),
  periodType: z.enum(["MONTH", "ONE_TIME"]).optional(),
  purchasePriceGbp: z.number().positive().optional(),
  appliesToClassTypes: z.array(z.string()).default([]),
  purchasableByProviderOnly: z.boolean().default(false),
  classEligible: z.boolean().default(true),
  allowRepeatPurchase: z.boolean().default(true),
  rolloverPolicy: z.enum(["NONE", "CAPPED", "UNLIMITED"]).default("NONE"),
})

export const updateCreditProductSchema = createCreditProductSchema.partial()

export const creditSubmissionSchema = z.object({
  creditProductId: z.string().uuid("creditProductId must be a valid UUID"),
  revolutReference: z.string().optional(),
  note: z.string().max(500, "Note must be 500 characters or less").optional(),
  paymentMethod: z.enum(["revolut_checkout", "manual_transfer"]).default("revolut_checkout"),
})

export const creditAdjustmentSchema = z.object({
  clientId: z.string().uuid("clientId must be a valid UUID"),
  amount: z
    .number()
    .int("Amount must be an integer")
    .refine((v) => v !== 0, "Amount must be non-zero"),
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be 500 characters or less"),
})

export const approveRejectSubmissionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
})

export const subscribeClientSchema = z.object({
  clientId: z.string().uuid("clientId must be a valid UUID"),
  creditProductId: z.string().uuid("creditProductId must be a valid UUID"),
  monthlyCredits: z.number().int().positive("monthlyCredits must be a positive integer"),
  startDate: z.string().refine((d) => !isNaN(new Date(d).getTime()), {
    message: "startDate must be a valid date string",
  }),
})

export const creditLedgerQuerySchema = z.object({
  clientId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
