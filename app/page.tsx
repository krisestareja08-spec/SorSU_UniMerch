import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getMyMemberships } from "@/lib/dashboards"
import { dashboardHref, primaryDashboard } from "@/lib/modules"

/**
 * Landing after sign-in: people assigned to a management dashboard (e.g. the Verification Admin)
 * go straight to it; everyone else lands on the marketplace.
 */
export default async function Page() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const memberships = await getMyMemberships(user.id).catch(() => [])
  const first = primaryDashboard(memberships)
  redirect(first ? dashboardHref(first) : "/marketplace")
}
