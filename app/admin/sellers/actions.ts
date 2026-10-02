"use server"

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { assertDashboard } from "@/lib/dashboards"
import { logAudit } from "@/lib/admin"

/**
 * Creates a seller ORGANIZATION: its store (storefront), its Seller Dashboard, and appoints the
 * dashboard's Main Admin — either an existing user or a newly created login.
 */
export async function createOrganization(formData: FormData) {
  const { supabase, userId: actorId } = await assertDashboard("verification", "organizations")

  const orgName = (formData.get("org_name") as string)?.trim()
  const description = (formData.get("description") as string) || null
  const category = formData.get("category") as string
  const campus = formData.get("campus") as string
  const adminMode = formData.get("admin_mode") === "new" ? "new" : "existing"
  const email = (formData.get("email") as string)?.trim()
  const password = formData.get("password") as string
  const adminName = (formData.get("admin_name") as string)?.trim()

  if (!orgName || !category || !campus || !email) throw new Error("Please fill in every required field.")

  // ── Resolve the Main Admin account ───────────────────────────────────────
  let mainAdminId: string
  if (adminMode === "existing") {
    const { data: found } = await supabase.rpc("find_user_by_email", { p_email: email })
    const match = Array.isArray(found) ? found[0] : found
    if (!match?.id) throw new Error(`No UniMerch account uses ${email}. Ask them to sign up first, or create a new login.`)
    mainAdminId = match.id
  } else {
    if (!adminName) throw new Error("Enter the Main Admin's full name.")
    if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.")
    const serviceUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceUrl || !serviceKey) throw new Error("Missing service role configuration.")
    const admin = createAdminClient(serviceUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: adminName, affiliation: "external", campus },
    })
    if (createError || !created.user) throw new Error(createError?.message ?? "Failed to create the login.")
    mainAdminId = created.user.id
    await admin.from("profiles").upsert(
      { id: mainAdminId, full_name: adminName, role: "buyer", affiliation: "external", campus },
      { onConflict: "id" },
    )
  }

  // ── Store (organization) + its Seller Dashboard + Main Admin ─────────────
  const { data: store, error: storeError } = await supabase
    .from("seller_profiles")
    .insert({ org_name: orgName, description, category, campus, created_by: actorId, status: "active" })
    .select("id")
    .single()
  if (storeError || !store) throw new Error(storeError?.message ?? "Failed to create the organization's store.")

  const { data: dashboard, error: dashError } = await supabase
    .from("dashboards")
    .insert({ module: "seller", name: orgName, store_id: store.id, created_by: actorId })
    .select("id")
    .single()
  if (dashError || !dashboard) throw new Error(dashError?.message ?? "Failed to create the Seller Dashboard.")

  const { error: memberError } = await supabase
    .from("dashboard_members")
    .insert({ dashboard_id: dashboard.id, user_id: mainAdminId, is_main: true, added_by: actorId })
  if (memberError) throw new Error(memberError.message)

  await logAudit(supabase, actorId, {
    userId: mainAdminId,
    action: "seller_created",
    reason: `${orgName} — Main Admin ${email}${adminMode === "new" ? " (new login)" : ""}`,
  })

  redirect("/admin/sellers?created=1")
}
