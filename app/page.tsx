import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getMemberships } from "@/lib/dashboards"
import { dashboardHref, type ModuleKey } from "@/lib/modules"

// Which dashboard to open first when a person manages more than one.
const PRIORITY: ModuleKey[] = ["verification", "bao", "supply_office", "cashier", "seller"]

/**
 * Landing after sign-in: people assigned to a management dashboard (e.g. the Verification Admin)
 * go straight to it; everyone else lands on the marketplace.
 */
export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const memberships = await getMemberships(supabase, user.id).catch(() => [])
  const first = [...memberships].sort((a, b) => PRIORITY.indexOf(a.module) - PRIORITY.indexOf(b.module))[0]
  redirect(first ? dashboardHref(first) : "/marketplace")
}
