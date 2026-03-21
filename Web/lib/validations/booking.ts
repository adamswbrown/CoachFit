import { z } from "zod"

export const bookClassSchema = z.object({
  sessionId: z.string().uuid("sessionId must be a valid UUID"),
})

export const cancelBookingSchema = z.object({
  bookingId: z.string().uuid("bookingId must be a valid UUID"),
})

export const scheduleQuerySchema = z.object({
  date: z.string().refine((d) => !isNaN(new Date(d).getTime()), {
    message: "date must be a valid ISO date string",
  }),
  classType: z.string().optional(),
})

export const createSessionSchema = z.object({
  templateId: z.string().uuid("templateId must be a valid UUID"),
  startsAt: z.string().datetime({ message: "startsAt must be a valid ISO datetime" }),
  instructorId: z.string().uuid("instructorId must be a valid UUID").optional(),
  durationMinutes: z.number().int().min(5).max(120).default(25),
})

export const updateSessionSchema = z.object({
  status: z.enum(["SCHEDULED", "CANCELLED"]).optional(),
  instructorId: z.string().uuid("instructorId must be a valid UUID").optional(),
  capacityOverride: z.number().int().min(1).optional(),
  cancelReason: z.string().optional(),
})

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  classType: z.string().min(1, "classType is required").max(100),
  description: z.string().optional(),
  locationLabel: z.string().min(1, "locationLabel is required").max(255),
  roomLabel: z.string().optional(),
  capacity: z.number().int().min(1).default(20),
  waitlistEnabled: z.boolean().default(true),
  waitlistCapacity: z.number().int().min(0).default(10),
  bookingOpenHoursBefore: z.number().int().min(1).default(336),
  bookingCloseMinutesBefore: z.number().int().min(0).default(0),
  cancelCutoffMinutes: z.number().int().min(0).default(60),
  creditsRequired: z.number().int().min(1).default(1),
  scope: z.enum(["FACILITY", "COHORT_ONLY"]).default("FACILITY"),
  cohortId: z.string().uuid().optional(),
})

export const updateTemplateSchema = createTemplateSchema.partial()

export const bulkCreateSessionsSchema = z.object({
  templateId: z.string().uuid("templateId must be a valid UUID"),
  startDate: z.string().refine((d) => !isNaN(new Date(d).getTime()), {
    message: "startDate must be a valid date string",
  }),
  endDate: z.string().refine((d) => !isNaN(new Date(d).getTime()), {
    message: "endDate must be a valid date string",
  }),
  recurrencePattern: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/, "startTime must be in HH:mm format"),
        instructorId: z.string().uuid().optional(),
      })
    )
    .min(1, "At least one recurrence pattern entry is required"),
})

export const clientBookingsQuerySchema = z.object({
  status: z
    .enum(["BOOKED", "WAITLISTED", "CANCELLED", "LATE_CANCEL", "ATTENDED", "NO_SHOW"])
    .optional(),
})
