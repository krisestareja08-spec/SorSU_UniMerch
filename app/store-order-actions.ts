"use server"

import { attempt } from "@/lib/action-result"

import { createClient as createServiceClient } from "@supabase/supabase-js"
import { assertDashboard } from "@/lib/dashboards"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"
import type { ModuleKey } from "@/lib/modules"

export type BuyerIdentity = {
  buyerName: string | null
  verified: boolean
  affiliation: string | null
  idNumber: string | null
  department: string | null
  restrictedItems: string[]
  idUrl: string | null
  idPath: string | null
  corUrl: string | null
  corPath: string | null
}

const STORE_MODULES: ModuleKey[] = ["seller", "cashier", "supply_office"]

/** Service-role client — used only AFTER the caller's store membership has been checked. */
function serviceClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing service role configuration.")
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * For orders containing RESTRICTED items: lets the store's staff (members with the Orders
 * permission of the store that sold the item) see the buyer's verified I.D. before confirming.
 * Verification documents are private, so after authorization the lookup uses the service role.
 */
async function getBuyerIdentityImpl(orderId: string, module: ModuleKey): Promise<BuyerIdentity> {
  if (!STORE_MODULES.includes(module)) throw new Error("Invalid dashboard")
  const { supabase, storeId } = await assertDashboard(module, "orders")
  if (!storeId) throw new Error("This dashboard has no store.")

  // Must be this store's order, and must include a restricted product from this store.
  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, products(is_restricted)")
    .eq("order_id", orderId)
    .eq("seller_id", storeId)
  const restrictedItems = ((items ?? []) as unknown as { product_name: string; products: { is_restricted: boolean } | { is_restricted: boolean }[] | null }[])
    .filter((i) => {
      const p = Array.isArray(i.products) ? i.products[0] : i.products
      return !!p?.is_restricted
    })
    .map((i) => i.product_name)
  if (restrictedItems.length === 0) throw new Error("This order has no restricted items from your store.")

  const { data: order } = await supabase.from("orders").select("buyer_id").eq("id", orderId).maybeSingle()
  if (!order?.buyer_id) throw new Error("Order not found")

  const service = serviceClient()

  const [{ data: profile }, { data: request }] = await Promise.all([
    service.from("profiles").select("full_name, affiliation, is_identity_verified, student_employee_id, department").eq("id", order.buyer_id).maybeSingle(),
    service
      .from("verification_requests")
      .select("document_url, cor_url")
      .eq("user_id", order.buyer_id)
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const sign = async (path: string | null) => {
    if (!path) return null
    const { data } = await service.storage.from("verification-docs").createSignedUrl(path, 60 * 5)
    return data?.signedUrl ?? null
  }

  return {
    buyerName: profile?.full_name ?? null,
    verified: !!profile?.is_identity_verified,
    affiliation: profile?.is_identity_verified ? AFFILIATION_LABELS[profile.affiliation as Affiliation] ?? profile.affiliation : null,
    idNumber: profile?.student_employee_id ?? null,
    department: profile?.department ?? null,
    restrictedItems,
    idUrl: await sign(request?.document_url ?? null),
    idPath: request?.document_url ?? null,
    corUrl: await sign(request?.cor_url ?? null),
    corPath: request?.cor_url ?? null,
  }
}

/** Which of these orders contain restricted items from the current store (for badges / gating). */
async function restrictedOrderIdsImpl(module: ModuleKey, orderIds: string[]): Promise<string[]> {
  if (!STORE_MODULES.includes(module) || orderIds.length === 0) return []
  const { supabase, storeId } = await assertDashboard(module, "orders")
  const { data } = await supabase
    .from("order_items")
    .select("order_id, products!inner(is_restricted)")
    .eq("seller_id", storeId ?? "")
    .eq("products.is_restricted", true)
    .in("order_id", orderIds)
  return [...new Set((data ?? []).map((r) => r.order_id as string))]
}

export type OrderBuyer = { name: string | null; contact: string | null; verified: boolean; accountStatus: string }

/**
 * Buyer details for this store's orders, so staff can recognise dummy accounts.
 * Only orders that contain this store's items are returned.
 */
async function getOrderBuyersImpl(module: ModuleKey, orderIds: string[]): Promise<Record<string, OrderBuyer>> {
  if (!STORE_MODULES.includes(module) || orderIds.length === 0) return {}
  const { supabase, storeId } = await assertDashboard(module, "orders")
  const { data: own } = await supabase.from("order_items").select("order_id").eq("seller_id", storeId ?? "").in("order_id", orderIds)
  const ownIds = [...new Set((own ?? []).map((r) => r.order_id as string))]
  if (ownIds.length === 0) return {}

  const { data: orders } = await supabase.from("orders").select("id, buyer_id").in("id", ownIds)
  const service = serviceClient()
  const buyerIds = [...new Set((orders ?? []).map((o) => o.buyer_id as string))]
  const { data: profiles } = await service.from("profiles").select("id, full_name, contact, is_identity_verified, account_status").in("id", buyerIds)
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]))

  const result: Record<string, OrderBuyer> = {}
  for (const o of orders ?? []) {
    const p = byId.get(o.buyer_id)
    result[o.id] = {
      name: p?.full_name ?? null,
      contact: p?.contact ?? null,
      verified: !!p?.is_identity_verified,
      accountStatus: p?.account_status ?? "active",
    }
  }
  return result
}

export type ReportReason = "dummy_account" | "fake_identity" | "no_show" | "abusive" | "other"

/** Store staff report / flag a buyer (e.g. a dummy account). The account is flagged for the Verification Admin. */
async function reportBuyerImpl(input: { orderId: string; module: ModuleKey; reason: ReportReason; details: string }) {
  if (!STORE_MODULES.includes(input.module)) throw new Error("Invalid dashboard")
  if (!["dummy_account", "fake_identity", "no_show", "abusive", "other"].includes(input.reason)) throw new Error("Choose a reason.")
  const details = input.details.trim().slice(0, 1000)
  if (input.reason === "other" && details.length < 10) throw new Error("Describe the problem (at least 10 characters).")

  const { supabase, userId, storeId } = await assertDashboard(input.module, "orders")
  if (!storeId) throw new Error("This dashboard has no store.")

  const { data: own } = await supabase.from("order_items").select("order_id").eq("order_id", input.orderId).eq("seller_id", storeId).limit(1)
  if (!own?.length) throw new Error("You can only report buyers of your own store's orders.")
  const { data: order } = await supabase.from("orders").select("buyer_id").eq("id", input.orderId).maybeSingle()
  if (!order?.buyer_id) throw new Error("Order not found")

  const { error } = await supabase.from("account_reports").insert({
    reported_user: order.buyer_id,
    reporter_id: userId,
    store_id: storeId,
    order_id: input.orderId,
    reason: input.reason,
    details: details || null,
  })
  if (error) throw new Error(error.message.includes("account_reports") ? "Reporting isn't enabled yet — run scripts/12_profile_rules.sql." : error.message)
}

// ── Exported actions: return ActionResult (lib/action-result.ts) instead of throwing ──
export async function getBuyerIdentity(...args: Parameters<typeof getBuyerIdentityImpl>) {
  return attempt(() => getBuyerIdentityImpl(...args))
}
export async function restrictedOrderIds(...args: Parameters<typeof restrictedOrderIdsImpl>) {
  return attempt(() => restrictedOrderIdsImpl(...args))
}
export async function getOrderBuyers(...args: Parameters<typeof getOrderBuyersImpl>) {
  return attempt(() => getOrderBuyersImpl(...args))
}
export async function reportBuyer(...args: Parameters<typeof reportBuyerImpl>) {
  return attempt(() => reportBuyerImpl(...args))
}
