"use server"

import { revalidatePath } from "next/cache"
import { attempt } from "@/lib/action-result"
import { assertDashboard } from "@/lib/dashboards"

/**
 * Supply Office branches are stocked by the Main Supply Office (scripts/31). A branch asks for a
 * restock or reports damaged / defective items to send back; the Main office reviews them, and can
 * also add to or count a branch's stock directly. Stock changes happen in the database functions,
 * which also record the inventory movement.
 */

const SETUP = "Branch stock requests need the latest scripts/31_supply_office_branches.sql. Ask the admin to run it in Supabase."
const setupError = (message: string) => (/branch_stock_requests|review_branch_request|main_adjust_branch_stock|function .* does not exist/i.test(message) ? SETUP : message)

function refresh() {
  revalidatePath("/cashier/inventory")
  revalidatePath("/supply-office/branch-inventory")
}

async function sendRequestImpl(args: {
  kind: "restock" | "return"; productId: string; variantId?: string | null; quantity: number
  reason?: "damaged" | "defective" | "other" | null; note?: string
}) {
  const { supabase, storeId } = await assertDashboard("cashier", "inventory")
  if (!storeId) throw new Error("This branch has no store.")
  if (!Number.isInteger(args.quantity) || args.quantity < 1) throw new Error("Enter how many units (1 or more).")
  if (args.kind === "return" && !args.reason) throw new Error("Choose why the items go back: damaged, defective or other.")
  const { error } = await supabase.from("branch_stock_requests").insert({
    branch_store_id: storeId, kind: args.kind, product_id: args.productId, variant_id: args.variantId || null,
    quantity: args.quantity, reason: args.kind === "return" ? args.reason : null, note: args.note?.trim().slice(0, 500) || null,
  })
  if (error) throw new Error(setupError(error.message))
  refresh()
}

async function withdrawRequestImpl(id: string) {
  const { supabase } = await assertDashboard("cashier", "inventory")
  const { error } = await supabase.from("branch_stock_requests").delete().eq("id", id).eq("status", "pending")
  if (error) throw new Error(setupError(error.message))
  refresh()
}

async function reviewRequestImpl(args: { id: string; decision: "fulfil" | "approve" | "decline"; quantity?: number; note?: string }) {
  const { supabase } = await assertDashboard("supply_office", "inventory")
  const { error } = await supabase.rpc("review_branch_request", {
    p_id: args.id, p_decision: args.decision, p_quantity: args.quantity ?? null, p_note: args.note?.trim() || null,
  })
  if (error) throw new Error(setupError(error.message))
  refresh()
}

/** The Main office's Update stock on a branch product / size (same form as its own inventory). */
async function adjustBranchStockImpl(formData: FormData): Promise<{ before: number; after: number; label: string }> {
  const { supabase } = await assertDashboard("supply_office", "inventory")
  const before = Number(formData.get("current"))
  const { data, error } = await supabase.rpc("main_adjust_branch_stock", {
    p_store: String(formData.get("branch_store_id") ?? ""),
    p_product: String(formData.get("product_id") ?? ""),
    p_variant: (formData.get("variant_id") as string | null) || null,
    p_mode: String(formData.get("mode") ?? ""),
    p_quantity: Number(formData.get("quantity")),
    p_note: ((formData.get("note") as string) ?? "").trim() || null,
  })
  if (error) throw new Error(setupError(error.message))
  refresh()
  return { before, after: Number(data), label: "" }
}

export async function sendBranchRequest(...args: Parameters<typeof sendRequestImpl>) {
  return attempt(() => sendRequestImpl(...args))
}
export async function withdrawBranchRequest(...args: Parameters<typeof withdrawRequestImpl>) {
  return attempt(() => withdrawRequestImpl(...args))
}
export async function reviewBranchRequest(...args: Parameters<typeof reviewRequestImpl>) {
  return attempt(() => reviewRequestImpl(...args))
}
export async function adjustBranchStock(...args: Parameters<typeof adjustBranchStockImpl>) {
  return attempt(() => adjustBranchStockImpl(...args))
}
