export const metadata = {
  title: "CoachFit Setup",
  description: "Set up your CoachFit instance",
}

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
