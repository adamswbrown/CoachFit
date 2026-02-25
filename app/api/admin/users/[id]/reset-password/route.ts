import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"
import { logAuditAction } from "@/lib/audit-log"

import { passwordSchema } from "@/lib/validations"

// bcrypt cost factor - 12 rounds for strong security
const BCRYPT_ROUNDS = 12

const resetPasswordSchema = z.object({
  password: passwordSchema,
  sendEmail: z.boolean().optional().default(true),
})

// POST /api/admin/users/[id]/reset-password - Reset a user's password
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id: userId } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { password, sendEmail } = resetPasswordSchema.parse(body)

    // Get the user
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isTestUser: true, passwordHash: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const isFirstPassword = !user.passwordHash

    // Hash the new password with increased cost factor
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    // Update user's password and set passwordChangedAt for session invalidation
    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: true,
      },
    })

    // Send email notification if requested
    if (sendEmail && !user.isTestUser) {
      const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`

      if (isFirstPassword) {
        // First-time password
        await sendSystemEmail({
          templateKey: EMAIL_TEMPLATE_KEYS.PASSWORD_SET,
          to: user.email,
          variables: {
            userName: user.name || "",
            userEmail: user.email,
            loginUrl,
          },
          fallbackSubject: "You Can Now Sign In with Email & Password",
          fallbackHtml: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1f2937;">New Sign-In Option Available</h2>
              <p>Hi${user.name ? ` ${user.name}` : ""},</p>
              <p>Good news! Your administrator has set up a password for your CoachFit account.</p>
              <p>You can now sign in using your email and new password.</p>
              <p>Contact your administrator for your password, then sign in:</p>
              <p style="margin-top: 24px;">
                <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Sign in
                </a>
              </p>
              <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
                If you did not expect this, please contact your administrator.
              </p>
            </div>
          `,
          fallbackText: `New Sign-In Option Available\n\nHi${user.name ? ` ${user.name}` : ""},\n\nGood news! Your administrator has set up a password for your CoachFit account.\n\nYou can now sign in using your email and new password.\n\nContact your administrator for your password, then sign in: ${loginUrl}\n\nIf you did not expect this, please contact your administrator.`,
          isTestUser: user.isTestUser,
        })
      } else {
        // Password reset - user already had a password
        await sendSystemEmail({
          templateKey: EMAIL_TEMPLATE_KEYS.PASSWORD_RESET,
          to: user.email,
          variables: {
            userName: user.name || "",
            userEmail: user.email,
            loginUrl,
          },
          fallbackSubject: "Your CoachFit Password Has Been Reset",
          fallbackHtml: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1f2937;">Password Reset</h2>
              <p>Hi${user.name ? ` ${user.name}` : ""},</p>
              <p>Your password has been reset by an administrator.</p>
              <p>Please contact your administrator for your new password, then sign in:</p>
              <p style="margin-top: 24px;">
                <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Sign in
                </a>
              </p>
              <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
                If you did not expect this, please contact your administrator immediately.
              </p>
            </div>
          `,
          fallbackText: `Password Reset\n\nHi${user.name ? ` ${user.name}` : ""},\n\nYour password has been reset by an administrator.\n\nPlease contact your administrator for your new password, then sign in: ${loginUrl}\n\nIf you did not expect this, please contact your administrator immediately.`,
          isTestUser: user.isTestUser,
        })
      }
    }

    const actionWord = isFirstPassword ? "set" : "reset"
    await logAuditAction({
      actor: session.user,
      actionType: "ADMIN_RESET_PASSWORD",
      targetType: "user",
      targetId: user.id,
      details: { isFirstPassword, sendEmail },
    })
    return NextResponse.json(
      { 
        message: `Password ${actionWord} successfully${sendEmail && !user.isTestUser ? ". Notification email sent." : "."}`,
        isFirstPassword,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      )
    }
    console.error("Error resetting password:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
