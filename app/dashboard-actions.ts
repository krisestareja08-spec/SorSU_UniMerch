"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getMemberships } from "@/lib/dashboards"
import { logAudit } from "@/lib/admin"
import { MODULES, grantablePages, type ModuleKey } from "@/lib/modules"

/**
 * Member management for any dashboard. Only that dashboard's Main Admin may manage its members.
 * The Verification Admin (with the "dashboards" permission) may appoint / replace Main Admins.
 */
async function authorize(dashboardId: string, scope: "main" | "appoint") {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const memberships = await getMemberships(supabase, user.id)
  const own = memberships.find((m) => m.id === dashboardId)
  const verification = memberships.find((m) => m.module === "verification")
  const isVerificationAppointer = !!verification && (verification.isMain || verification.permissions.includes("dashboards") || verification.permissions.includes("organizations") || verification.permissions.includes("cashiers"))

  const allowed = scope === "main" ? own?.isMain || isVerificationAppointer : isVerificationAppointer
  if (!allowed) throw new Error("Only this dashboard's Main Admin can manage its members.")

  const { data: dashboard } = await supabase.from("dashboards").select("id, module, name").eq("id", dashboardId).maybeSingle()
  if (!dashboard) throw new Error("Dashboard not found")
  return { supabase, actorId: user.id, dashboard: dashboard as { id: string; module: ModuleKey; name: string } }
}

function cleanPermissions(module: ModuleKey, raw: FormDataEntryValue[]) {
  const valid = new Set(grantablePages(module).map((p) => p.perm))
  return raw.map(String).filter((p) => valid.has(p))
}

function revalidate(module: ModuleKey) {
  revalidatePath(`${MODULES[module].basePath}/members`)
  revalidatePath("/admin/dashboards")
  revalidatePath("/admin/sellers")
}

async function findUser(supabase: Awaited<ReturnType<typeof createClient>>, email: string) {
  const { data } = await supabase.rpc("find_user_by_email", { p_email: email.trim() })
  const match = Array.isArray(data) ? data[0] : data
  if (!match?.id) throw new Error(`No UniMerch account uses ${email}. They need to sign up first.`)
  return match as { id: string; full_name: string | null }
}

export async function addMember(formData: FormData) {
  const dashboardId = formData.get("dashboard_id") as string
  const email = (formData.get("email") as string) ?? ""
  const { supabase, actorId, dashboard } = await authorize(dashboardId, "main")
  if (!email.trim()) throw new Error("Enter the member's email.")

  const target = await findUser(supabase, email)
  const permissions = cleanPermissions(dashboard.module, formData.getAll("permissions"))

  const { error } = await supabase.from("dashboard_members").insert({
    dashboard_id: dashboardId, user_id: target.id, is_main: false, permissions, added_by: actorId,
  })
  if (error) throw new Error(error.code === "23505" ? "That user is already a member of this dashboard." : error.message)

  await logAudit(supabase, actorId, { userId: target.id, action: "member_added", reason: `${dashboard.name}: ${permissions.join(", ") || "no pages"}` })
  revalidate(dashboard.module)
}

export async function updateMemberPermissions(formData: FormData) {
  const dashboardId = formData.get("dashboard_id") as string
  const userId = formData.get("user_id") as string
  const { supabase, actorId, dashboard } = await authorize(dashboardId, "main")
  const permissions = cleanPermissions(dashboard.module, formData.getAll("permissions"))

  const { error } = await supabase
    .from("dashboard_members")
    .update({ permissions })
    .eq("dashboard_id", dashboardId)
    .eq("user_id", userId)
    .eq("is_main", false)
  if (error) throw new Error(error.message)

  await logAudit(supabase, actorId, { userId, action: "member_permissions", reason: `${dashboard.name}: ${permissions.join(", ") || "no pages"}` })
  revalidate(dashboard.module)
}

export async function removeMember(formData: FormData) {
  const dashboardId = formData.get("dashboard_id") as string
  const userId = formData.get("user_id") as string
  const { supabase, actorId, dashboard } = await authorize(dashboardId, "main")

  const { error } = await supabase
    .from("dashboard_members")
    .delete()
    .eq("dashboard_id", dashboardId)
    .eq("user_id", userId)
    .eq("is_main", false)
  if (error) throw new Error(error.message)

  await logAudit(supabase, actorId, { userId, action: "member_removed", reason: dashboard.name })
  revalidate(dashboard.module)
}

async function setMainAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dashboardId: string,
  newMainId: string,
  actorId: string,
) {
  // Demote the current Main Admin to a regular member first (only one Main Admin is allowed).
  const { error: demoteError } = await supabase
    .from("dashboard_members")
    .update({ is_main: false })
    .eq("dashboard_id", dashboardId)
    .eq("is_main", true)
  if (demoteError) throw new Error(demoteError.message)

  const { error } = await supabase
    .from("dashboard_members")
    .upsert({ dashboard_id: dashboardId, user_id: newMainId, is_main: true, added_by: actorId }, { onConflict: "dashboard_id,user_id" })
  if (error) throw new Error(error.message)
}

/** Main Admin hands full control to another member of the same dashboard. */
export async function transferMainAdmin(formData: FormData) {
  const dashboardId = formData.get("dashboard_id") as string
  const userId = formData.get("user_id") as string
  const { supabase, actorId, dashboard } = await authorize(dashboardId, "main")

  const { data: member } = await supabase
    .from("dashboard_members").select("user_id").eq("dashboard_id", dashboardId).eq("user_id", userId).maybeSingle()
  if (!member) throw new Error("The new Main Admin must already be a member of this dashboard.")

  await setMainAdmin(supabase, dashboardId, userId, actorId)
  await logAudit(supabase, actorId, { userId, action: "main_admin_changed", reason: dashboard.name })
  revalidate(dashboard.module)
}

/** Verification Admin appoints (or replaces) any dashboard's Main Admin by email. */
export async function appointMainAdmin(formData: FormData) {
  const dashboardId = formData.get("dashboard_id") as string
  const email = (formData.get("email") as string) ?? ""
  const { supabase, actorId, dashboard } = await authorize(dashboardId, "appoint")
  if (!email.trim()) throw new Error("Enter the new Main Admin's email.")

  const target = await findUser(supabase, email)
  await setMainAdmin(supabase, dashboardId, target.id, actorId)
  await logAudit(supabase, actorId, { userId: target.id, action: "main_admin_changed", reason: `${dashboard.name} → ${email}` })
  revalidate(dashboard.module)
}
