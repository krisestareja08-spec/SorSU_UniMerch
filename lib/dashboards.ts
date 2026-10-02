import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth"
import { MODULES, MULTI_INSTANCE, canUse, type DashboardCtx, type DashboardSummary, type ModuleKey } from "@/lib/modules"

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Remembers which organization / cashier branch a person is working in (per module). */
export function activeDashboardCookie(module: ModuleKey) {
  return module === "seller" ? "active_seller_dashboard" : `active_${module}_dashboard`
}

type MemberRow = {
  is_main: boolean
  permissions: string[] | null
  dashboards: { id: string; module: ModuleKey; name: string; store_id: string | null } | { id: string; module: ModuleKey; name: string; store_id: string | null }[] | null
}

/** Every dashboard the user is assigned to (empty for regular users). */
export async function getMemberships(supabase: Supabase, userId: string) {
  const { data } = await supabase
    .from("dashboard_members")
    .select("is_main, permissions, dashboards(id, module, name, store_id)")
    .eq("user_id", userId)

  const rows = (data ?? []) as MemberRow[]
  return rows
    .map((r) => {
      const d = Array.isArray(r.dashboards) ? r.dashboards[0] : r.dashboards
      if (!d) return null
      return {
        id: d.id,
        module: d.module,
        name: d.name,
        storeId: d.store_id,
        isMain: r.is_main,
        permissions: r.permissions ?? [],
      }
    })
    .filter((d): d is DashboardSummary & { permissions: string[] } => d !== null)
    .sort((a, b) => a.module.localeCompare(b.module) || a.name.localeCompare(b.name))
}

/**
 * Guard for every management page. Replaces role checks: the signed-in user must be a member of
 * a dashboard of this module, and (unless Main Admin) must have been granted `perm`.
 * `perm === "members"` is Main-Admin-only.
 */
export async function requireDashboard(module: ModuleKey, perm: string | null = null): Promise<DashboardCtx> {
  const { id: userId, email, profile } = await requireUser()
  const supabase = await createClient()
  const memberships = await getMemberships(supabase, userId)
  const candidates = memberships.filter((m) => m.module === module)
  if (candidates.length === 0) redirect(`/dashboard?denied=${module}`)

  // A user may belong to several organizations / cashier branches — use the one they last switched to.
  let current = candidates[0]
  if (MULTI_INSTANCE.includes(module) && candidates.length > 1) {
    const active = (await cookies()).get(activeDashboardCookie(module))?.value
    current = candidates.find((c) => c.id === active) ?? candidates[0]
  }

  const allowed = perm === "members" ? current.isMain : canUse(current, perm)
  if (!allowed) redirect(MODULES[module].basePath)

  return {
    userId,
    email,
    fullName: profile.full_name,
    module,
    dashboardId: current.id,
    dashboardName: current.name,
    storeId: current.storeId,
    isMain: current.isMain,
    permissions: current.permissions,
    dashboards: memberships.map(({ id, module, name, storeId, isMain }) => ({ id, module, name, storeId, isMain })),
  }
}

/** Same check for server actions (throws instead of redirecting). */
export async function assertDashboard(module: ModuleKey, perm: string | null = null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const memberships = await getMemberships(supabase, user.id)
  let candidates = memberships.filter((m) => m.module === module)
  if (MULTI_INSTANCE.includes(module) && candidates.length > 1) {
    const active = (await cookies()).get(activeDashboardCookie(module))?.value
    candidates = [candidates.find((c) => c.id === active) ?? candidates[0]]
  }
  const current = candidates[0]
  if (!current) throw new Error("You are not a member of this dashboard.")
  const allowed = perm === "members" ? current.isMain : canUse(current, perm)
  if (!allowed) throw new Error("You don't have permission for this section.")
  return { supabase, userId: user.id, dashboard: current, storeId: current.storeId }
}
