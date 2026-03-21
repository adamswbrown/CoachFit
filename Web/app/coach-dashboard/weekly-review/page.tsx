import { redirect } from "next/navigation"

export default function WeeklyReviewRedirect() {
  redirect("/coach-dashboard/challenges?tab=weekly-review")
}
