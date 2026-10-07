"use server"

import { attempt } from "@/lib/action-result"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { requireAdminActor, logAudit } from "@/lib/admin"

async function decideVerificationImpl(formData: FormData) {
  const requestId = formData.get("request_id") as string
  const decision = formData.get("decision") as string
  const reason = (formData.get("reason") as string) || null
  const returnTo = (formData.get("return_to") as string) || null
  if (!requestId || !["approved", "rejected", "needs_resubmission", "under_review"].includes(decision)) {
    throw new Error("Invalid decision")
  }

  const { supabase, actorId } = await requireAdminActor("queue")

  const { data: request, error: fetchError } = await supabase
    .from("verification_requests")
    .select("user_id, claimed_affiliation, student_employee_id")
    .eq("id", requestId)
    .maybeSingle()
  if (fetchError || !request) throw new Error(fetchError?.message ?? "Request not found")

  // One account per I.D. number — refuse to verify a second account with the same number.
  if (decision === "approved") {
    const { data: holder } = await supabase
      .from("profiles")
      .select("id")
      .eq("student_employee_id", request.student_employee_id)
      .eq("is_identity_verified", true)
      .neq("id", request.user_id)
      .limit(1)
      .maybeSingle()
    if (holder) {
      throw new Error(`I.D. number ${request.student_employee_id} already belongs to another verified account. See Duplicate Detection.`)
    }
  }

  const { error } = await supabase
    .from("verification_requests")
    .update({ status: decision, reviewed_by: actorId, review_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", requestId)
  if (error) throw new Error(error.message)

  if (decision === "approved") {
    await supabase
      .from("profiles")
      .update({
        verification_status: "approved",
        is_identity_verified: true,
        affiliation: request.claimed_affiliation,
        student_employee_id: request.student_employee_id,
      })
      .eq("id", request.user_id)
  } else if (decision === "rejected") {
    // Declined users remain guests: unverified, no access to restricted products.
    await supabase
      .from("profiles")
      .update({ verification_status: "rejected", is_identity_verified: false, affiliation: "external" })
      .eq("id", request.user_id)
  } else {
    await supabase.from("profiles").update({ verification_status: "pending" }).eq("id", request.user_id)
  }

  await logAudit(supabase, actorId, { requestId, userId: request.user_id, action: `verification_${decision}`, reason })

  revalidatePath("/admin", "layout")
  if (returnTo) redirect(returnTo)
}

async function updateAccountStatusImpl(formData: FormData) {
  const userId = formData.get("user_id") as string
  const status = formData.get("status") as string
  const reason = (formData.get("reason") as string) || null
  if (!userId || !["active", "suspended", "flagged", "banned"].includes(status)) {
    throw new Error("Invalid account status")
  }

  const { supabase, actorId } = await requireAdminActor("users")

  const { error } = await supabase.from("profiles").update({ account_status: status }).eq("id", userId)
  if (error) throw new Error(error.message)

  await logAudit(supabase, actorId, { userId, action: `account_${status}`, reason })

  revalidatePath("/admin", "layout")
}

/** Permanently deletes an account and everything it owns (see scripts/21_delete_user.sql). */
async function deleteUserImpl(formData: FormData) {
  const userId = formData.get("user_id") as string
  const reason = (formData.get("reason") as string) || null
  if (!userId) throw new Error("Missing user")

  const { supabase, actorId } = await requireAdminActor("users")
  if (userId === actorId) throw new Error("You cannot delete your own account.")

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing service role configuration.")
  const service = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: target } = await service.from("profiles").select("full_name, student_employee_id").eq("id", userId).maybeSingle()

  // Uploaded I.D. documents live under verification-docs/<userId>/.
  const { data: docs } = await service.storage.from("verification-docs").list(userId, { limit: 1000 })
  if (docs?.length) await service.storage.from("verification-docs").remove(docs.map((f) => `${userId}/${f.name}`))

  const { error } = await service.auth.admin.deleteUser(userId)
  if (error) {
    throw new Error(/foreign key|violates/i.test(error.message)
      ? `This account is still referenced by other records. Run scripts/21_delete_user.sql in Supabase, then try again. (${error.message})`
      : error.message)
  }

  // The user row is gone, so the log names them in the reason instead of linking to them.
  const who = `${target?.full_name || "Unnamed user"}${target?.student_employee_id ? ` (${target.student_employee_id})` : ""}`
  await logAudit(supabase, actorId, { action: "account_deleted", reason: reason ? `${who} — ${reason}` : who })

  revalidatePath("/admin", "layout")
  redirect("/admin/users")
}

async function updateSellerStatusImpl(formData: FormData) {
  const sellerId = formData.get("seller_id") as string
  const status = formData.get("status") as string
  if (!sellerId || !["active", "suspended"].includes(status)) throw new Error("Invalid storefront status")

  const { supabase, actorId } = await requireAdminActor("organizations")

  const { error } = await supabase.from("seller_profiles").update({ status }).eq("id", sellerId)
  if (error) throw new Error(error.message)

  await logAudit(supabase, actorId, { userId: sellerId, action: `seller_${status}` })

  revalidatePath("/admin", "layout")
}

/** Resolve a seller's report of a (dummy) buyer account: dismiss, suspend or ban. */
async function resolveAccountReportImpl(formData: FormData) {
  const reportId = formData.get("report_id") as string
  const decision = formData.get("decision") as string
  const note = (formData.get("note") as string) || null
  if (!reportId || !["dismiss", "suspend", "ban"].includes(decision)) throw new Error("Invalid decision")

  const { supabase, actorId } = await requireAdminActor("reports")
  const { data: report } = await supabase.from("account_reports").select("reported_user, reason").eq("id", reportId).maybeSingle()
  if (!report) throw new Error("Report not found")

  if (decision !== "dismiss") {
    const status = decision === "ban" ? "banned" : "suspended"
    const { error } = await supabase.from("profiles").update({ account_status: status }).eq("id", report.reported_user)
    if (error) throw new Error(error.message)
    await logAudit(supabase, actorId, { userId: report.reported_user, action: `account_${status}`, reason: note ?? `Report: ${report.reason.replace(/_/g, " ")}` })
  } else {
    // Dismissed: lift the automatic flag unless other reports are still open.
    const { count } = await supabase.from("account_reports").select("id", { count: "exact", head: true })
      .eq("reported_user", report.reported_user).eq("status", "open").neq("id", reportId)
    if (!count) await supabase.from("profiles").update({ account_status: "active" }).eq("id", report.reported_user).eq("account_status", "flagged")
    await logAudit(supabase, actorId, { userId: report.reported_user, action: "report_dismissed", reason: note })
  }

  const { error } = await supabase.from("account_reports")
    .update({ status: decision === "dismiss" ? "dismissed" : "actioned", resolved_by: actorId, resolved_at: new Date().toISOString() })
    .eq("id", reportId)
  if (error) throw new Error(error.message)

  revalidatePath("/admin", "layout")
}

// ── Exported actions: return ActionResult (lib/action-result.ts) instead of throwing ──
export async function decideVerification(...args: Parameters<typeof decideVerificationImpl>) {
  return attempt(() => decideVerificationImpl(...args))
}
export async function updateAccountStatus(...args: Parameters<typeof updateAccountStatusImpl>) {
  return attempt(() => updateAccountStatusImpl(...args))
}
export async function deleteUser(...args: Parameters<typeof deleteUserImpl>) {
  return attempt(() => deleteUserImpl(...args))
}
export async function updateSellerStatus(...args: Parameters<typeof updateSellerStatusImpl>) {
  return attempt(() => updateSellerStatusImpl(...args))
}
export async function resolveAccountReport(...args: Parameters<typeof resolveAccountReportImpl>) {
  return attempt(() => resolveAccountReportImpl(...args))
}
