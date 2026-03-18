import { SignIn } from "@clerk/nextjs"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-gray-50 px-4 py-6 sm:py-8 overflow-y-auto">
      <div className="max-w-md w-full">
        <div className="mb-6 sm:mb-8 flex justify-center">
          <img
            src="/coachfit-logo-login.png"
            alt="CoachFit Logo"
            style={{ maxWidth: "min(100%, 320px)", height: "auto" }}
            width={400}
            height={130}
            loading="eager"
          />
        </div>

        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
            Fitness, guided by coaches.
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            Check-ins, weekly review, and progress built around real support.
          </p>
        </div>

        <div className="flex justify-center">
          <SignIn
            routing="hash"
            forceRedirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border border-gray-200 rounded-lg",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton:
                  "border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium",
                formButtonPrimary:
                  "bg-gray-700 hover:bg-gray-800 text-sm font-medium",
                footerActionLink: "text-blue-600 hover:text-blue-700 font-medium",
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
