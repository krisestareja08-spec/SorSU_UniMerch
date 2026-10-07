"use server"

import { attempt } from "@/lib/action-result"

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { assertDashboard } from "@/lib/dashboards"
import { logAudit } from "@/lib/admin"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"
import { cashierBranchName, type CashierScope } from "@/lib/cashier-branches"

/**
 * Verification Admin creates a Cashier branch: its dashboard + store (the store is created
 * automatically by the database) and appoints the branch's Main Admin.
 */
async function createCashierBranchImpl(formData: FormData) {
  const { supabase, userId: actorId } = await assertDashboard("verification", "cashiers")

  const campus = formData.get("campus") as Campus
  const scope = (formData.get("scope") as CashierScope) || "campus"
  const department = ((formData.get("department") as string) ?? "").trim()
  const adminMode = formData.get("admin_mode") === "new" ? "new" : "existing"
  const email = ((formData.get("email") as string) ?? "").trim()
  const password = formData.get("password") as string
  const adminName = ((formData.get("admin_name") as string) ?? "").trim()

  if (!(campus in CAMPUS_LABELS)) throw new Error("Choose the campus this cashier branch belongs to.")
  if (!["campus", "department", "centralized"].includes(scope)) throw new Error("Choose what the branch serves.")
  if (scope === "department" && department.length < 2) throw new Error("Enter the department this branch serves.")
  if (!email) throw new Error("Enter the Main Admin's email.")

  const name = cashierBranchName(campus, scope, department)
  const { data: existing } = await supabase.from("dashboards").select("id").eq("module", "cashier").eq("name", name).maybeSingle()
  if (existing) throw new Error(`"${name}" already exists.`)

  // Main Admin: an existing account, or a new login
  let mainAdminId: string
  if (adminMode === "existing") {
    const { data: found } = await supabase.rpc("find_user_by_email", { p_email: email })
    const match = Array.isArray(found) ? found[0] : found
    if (!match?.id) throw new Error(`No UniMerch account uses ${email}. Ask them to sign up first, or create a new login.`)
    mainAdminId = match.id
  } else {
    if (!adminName) throw new Error("Enter the Main Admin's full name.")
    if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.")
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Missing service role configuration.")
    const admin = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: adminName, affiliation: "staff", campus },
    })
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create the login.")
    mainAdminId = created.user.id
    await admin.from("profiles").upsert({ id: mainAdminId, full_name: adminName, role: "buyer", affiliation: "staff", campus }, { onConflict: "id" })
  }

  const { data: dashboard, error: dashError } = await supabase
    .from("dashboards")
    .insert({ module: "cashier", name, campus, scope, department: scope === "department" ? department : null, created_by: actorId })
    .select("id")
    .single()
  if (dashError || !dashboard) {
    throw new Error(dashError?.message.includes("scope") ? "Run scripts/19_cashier_branches.sql in Supabase first." : dashError?.message ?? "Failed to create the branch.")
  }

  const { error: memberError } = await supabase
    .from("dashboard_members")
    .insert({ dashboard_id: dashboard.id, user_id: mainAdminId, is_main: true, added_by: actorId })
  if (memberError) throw new Error(memberError.message)

  await logAudit(supabase, actorId, { userId: mainAdminId, action: "cashier_branch_created", reason: `${name} — Main Admin ${email}` })
  revalidatePath("/admin/cashiers")
}

// ── Exported actions: return ActionResult (lib/action-result.ts) instead of throwing ──
export async function createCashierBranch(...args: Parameters<typeof createCashierBranchImpl>) {
  return attempt(() => createCashierBranchImpl(...args))
}
