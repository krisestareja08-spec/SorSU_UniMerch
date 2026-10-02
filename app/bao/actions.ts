"use server"

import { revalidatePath } from "next/cache"
import { assertDashboard } from "@/lib/dashboards"
import { logAudit } from "@/lib/admin"

/** BAO pulls a product with a violation off the marketplace (hidden from buyers until restored). */
export async function pullProduct(formData: FormData) {
  const productId = formData.get("product_id") as string
  const reason = ((formData.get("reason") as string) ?? "").trim()
  if (!productId) throw new Error("Missing product")
  if (reason.length < 5) throw new Error("Give the reason for pulling this product (at least 5 characters).")

  const { supabase, userId } = await assertDashboard("bao", "marketplace")
  const { data: product } = await supabase.from("products").select("name, seller_id").eq("id", productId).maybeSingle()
  const { error } = await supabase
    .from("products")
    .update({ status: "pulled", pulled_reason: reason, pulled_at: new Date().toISOString(), pulled_by: userId, bao_comment: `Pulled by BAO: ${reason}` })
    .eq("id", productId)
  if (error) throw new Error(error.message.includes("pulled") ? "Run scripts/15_bao_bi.sql in Supabase to enable pulling products." : error.message)

  await logAudit(supabase, userId, { action: "product_pulled", reason: `${product?.name ?? productId}: ${reason}` })
  revalidatePath("/bao", "layout")
}

/** BAO puts a pulled product back on the marketplace. */
export async function restoreProduct(formData: FormData) {
  const productId = formData.get("product_id") as string
  const { supabase, userId } = await assertDashboard("bao", "marketplace")
  const { data: product } = await supabase.from("products").select("name").eq("id", productId).maybeSingle()
  const { error } = await supabase
    .from("products")
    .update({ status: "approved", pulled_reason: null, pulled_at: null, pulled_by: null, bao_comment: null })
    .eq("id", productId)
  if (error) throw new Error(error.message)

  await logAudit(supabase, userId, { action: "product_restored", reason: product?.name ?? productId })
  revalidatePath("/bao", "layout")
}

/** BAO flags a store for a violation (optionally about one product); the store is notified. */
export async function flagStoreViolation(formData: FormData) {
  const storeId = formData.get("store_id") as string
  const productId = (formData.get("product_id") as string) || null
  const reason = ((formData.get("reason") as string) ?? "").trim()
  const severity = formData.get("severity") === "serious" ? "serious" : "warning"
  if (!storeId) throw new Error("Missing store")
  if (reason.length < 5) throw new Error("Describe the violation (at least 5 characters).")

  const { supabase, userId } = await assertDashboard("bao", "marketplace")
  let productName: string | null = null
  if (productId) {
    const { data } = await supabase.from("products").select("name").eq("id", productId).maybeSingle()
    productName = data?.name ?? null
  }
  const { error } = await supabase.from("store_violations").insert({
    store_id: storeId, product_id: productId, product_name: productName, severity, reason, flagged_by: userId,
  })
  if (error) throw new Error(error.message.includes("store_violations") ? "Run scripts/18_store_violations.sql in Supabase to enable flagging." : error.message)

  await logAudit(supabase, userId, { action: "store_flagged", reason: `${productName ? `${productName}: ` : ""}${reason}` })
  revalidatePath("/bao", "layout")
}

/** BAO acknowledges or flags a sales report submitted by a store. */
export async function reviewSalesReport(formData: FormData) {
  const reportId = formData.get("report_id") as string
  const decision = formData.get("decision") as string
  const note = ((formData.get("note") as string) ?? "").trim() || null
  if (!reportId || !["acknowledged", "flagged"].includes(decision)) throw new Error("Invalid decision")

  const { supabase, userId } = await assertDashboard("bao", "reports")
  const { error } = await supabase
    .from("sales_reports")
    .update({ status: decision, bao_note: note, reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq("id", reportId)
  if (error) throw new Error(error.message)

  await logAudit(supabase, userId, { action: `report_${decision}`, reason: note })
  revalidatePath("/bao/reports")
}
