import { verifyWebhook } from "@clerk/nextjs/webhooks"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { processInvitesForUser } from "@/lib/auth"
import { Role } from "@/lib/types"

/**
 * Clerk webhook handler.
 *
 * Processes Clerk events to sync user data with our database:
 * - user.created: Create local User record, set default CLIENT role, process invites, send welcome email
 * - user.updated: Sync email/name changes
 */
export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)
    const eventType = evt.type

    if (eventType === "user.created") {
      const { id: clerkId, email_addresses, first_name, last_name, image_url } = evt.data
      const primaryEmail = email_addresses?.[0]?.email_address
      if (!primaryEmail) {
        console.error("[WEBHOOK] No email for user.created event:", clerkId)
        return NextResponse.json({ error: "No email" }, { status: 400 })
      }

      const normalizedEmail = primaryEmail.toLowerCase().trim()
      const name = [first_name, last_name].filter(Boolean).join(" ") || null

      // Check if user already exists (by email — may have been created via signup API)
      // Use case-insensitive search to catch records stored with different casing
      let user = await db.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: { id: true, clerkId: true, roles: true },
      })

      if (user) {
        // Link existing user to Clerk
        if (!user.clerkId) {
          await db.user.update({
            where: { id: user.id },
            data: { clerkId, image: image_url || null },
          })
        }
      } else {
        // Create new user
        user = await db.user.create({
          data: {
            clerkId,
            email: normalizedEmail,
            name,
            image: image_url || null,
            roles: [Role.CLIENT],
          },
          select: { id: true, clerkId: true, roles: true },
        })
      }

      // Process pending invites
      await processInvitesForUser(user.id, normalizedEmail)

      // Sync roles to Clerk public metadata so client can read them
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { roles: true, isTestUser: true, mustChangePassword: true, onboardingComplete: true },
      })

      if (dbUser) {
        try {
          const { clerkClient } = await import("@clerk/nextjs/server")
          const client = await clerkClient()
          await client.users.updateUserMetadata(clerkId, {
            publicMetadata: {
              dbId: user.id,
              roles: dbUser.roles,
              isTestUser: dbUser.isTestUser,
              mustChangePassword: dbUser.mustChangePassword,
              onboardingComplete: dbUser.onboardingComplete,
            },
          })
        } catch (metaErr) {
          console.error("[WEBHOOK] Failed to sync metadata to Clerk:", metaErr)
        }
      }

      // Send welcome email (fire-and-forget)
      if (normalizedEmail && !normalizedEmail.endsWith(".local")) {
        try {
          const { sendSystemEmail } = await import("@/lib/email")
          const { EMAIL_TEMPLATE_KEYS } = await import("@/lib/email-templates")
          const loginUrl = `${process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ? process.env.VERCEL_URL || "http://localhost:3000" : "http://localhost:3000"}/login`

          void sendSystemEmail({
            templateKey: EMAIL_TEMPLATE_KEYS.WELCOME_CLIENT,
            to: normalizedEmail,
            variables: {
              userName: name ? ` ${name}` : "",
              loginUrl,
            },
            isTestUser: dbUser?.isTestUser,
            fallbackSubject: "Welcome to CoachFit",
            fallbackHtml: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1f2937;">Welcome to CoachFit!</h2>
                <p>Hi${name ? ` ${name}` : ""},</p>
                <p>Welcome to CoachFit! We're excited to have you on board.</p>
                <p>You're all set — your coach will guide you next.</p>
                <p style="margin-top: 24px;">
                  <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Sign in to your dashboard
                  </a>
                </p>
              </div>
            `,
            fallbackText: `Welcome to CoachFit!\n\nHi${name ? ` ${name}` : ""},\n\nWelcome! Your coach will guide you next.\n\nSign in: ${loginUrl}`,
          })
        } catch (emailErr) {
          console.error("[WEBHOOK] Error sending welcome email:", emailErr)
        }
      }

      return NextResponse.json({ success: true })
    }

    if (eventType === "user.updated") {
      const { id: clerkId, email_addresses, first_name, last_name, image_url } = evt.data
      const primaryEmail = email_addresses?.[0]?.email_address

      if (primaryEmail) {
        const user = await db.user.findFirst({ where: { clerkId } })
        if (user) {
          await db.user.update({
            where: { id: user.id },
            data: {
              email: primaryEmail.toLowerCase().trim(),
              name: [first_name, last_name].filter(Boolean).join(" ") || user.name,
              image: image_url || user.image,
            },
          })
        }
      }

      return NextResponse.json({ success: true })
    }

    // Unhandled event type — acknowledge it
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[WEBHOOK] Error verifying/processing webhook:", err)
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 })
  }
}
