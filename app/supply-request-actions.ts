"use server"

import { revalidatePath } from "next/cache"
import { attempt } from "@/lib/action-result"
import { assertDashboard } from "@/lib/dashboards"
import { MODULES, type ModuleKey } from "@/lib/modules"

/**
 * Supply requests (scripts/31): organizations and Supply Office branches order from the Main Supply
 * Office. Every step runs in a database function that checks who may do it and notifies the other
 * side; these actions only check the dashboard and call them.
 */

const REQUESTERS: ModuleKey[] = ["seller", "cashier"]
const SETUP = "Supply requests need the latest scripts/31_supply_office_branches.sql and scripts/32_performance.sql. Ask the admin to run them in Supabase."
const clean = (message: string) => (/supply_request|function .* does not exist|schema cache/i.test(message) ? SETUP : message)

function refresh(id?: string) {
  for (const m of REQUESTERS) {
    revalidatePath(`${MODULES[m].basePath}/supply-requests`)
    if (id) revalidatePath(`${MODULES[m].basePath}/supply-requests/${id}`)
  }
  revalidatePath("/supply-office/special-orders")
  if (id) revalidatePath(`/supply-office/special-orders/${id}`)
}

export type SupplyPayload = {
  title: string; description?: string; link_url?: string; needed_by?: string; fulfilment: "pickup" | "delivery"; delivery_address?: string
  attachments: { url?: string; path?: string; name: string; kind: "image" | "document" }[]
  items: {
    kind: "catalog" | "modified" | "custom" | "collab_stock"; product_id?: string; variant_id?: string | null; design_group?: string
    name?: string; size?: string; quantity: number; notes?: string; uses_logo?: boolean; list_on_marketplace?: boolean
  }[]
}

async function submitImpl(args: { module: ModuleKey; payload: SupplyPayload; requestId?: string }) {
  if (!REQUESTERS.includes(args.module)) throw new Error("Only organizations and Supply Office branches send supply requests.")
  const { supabase, storeId } = await assertDashboard(args.module, "supply")
  if (!storeId) throw new Error("This dashboard has no store.")
  const { data, error } = await supabase.rpc("submit_supply_request", { p_store: storeId, p_payload: args.payload, p_request: args.requestId ?? null })
  if (error) throw new Error(clean(error.message))
  refresh(data as string)
  return { id: data as string }
}

async function cancelImpl(args: { module: ModuleKey; id: string }) {
  if (!REQUESTERS.includes(args.module)) throw new Error("Invalid dashboard")
  const { supabase } = await assertDashboard(args.module, "supply")
  const { error } = await supabase.rpc("cancel_supply_request", { p_id: args.id })
  if (error) throw new Error(clean(error.message))
  refresh(args.id)
}

async function payImpl(args: { module: ModuleKey; id: string; method: "cash" | "gcash" | "bank"; receiptUrl?: string; reference?: string }) {
  if (!REQUESTERS.includes(args.module)) throw new Error("Invalid dashboard")
  const { supabase } = await assertDashboard(args.module, "supply")
  const { error } = await supabase.rpc("pay_supply_request", {
    p_id: args.id, p_method: args.method, p_receipt_url: args.receiptUrl ?? null, p_reference: args.reference ?? null,
  })
  if (error) throw new Error(clean(error.message))
  refresh(args.id)
}

async function reviewImpl(args: { id: string; decision: "approve" | "changes" | "decline"; note?: string; prices?: { id: string; unit_price: number }[]; deliveryFee?: number }) {
  const { supabase } = await assertDashboard("supply_office", "supply")
  const { error } = await supabase.rpc("review_supply_request", {
    p_id: args.id, p_decision: args.decision, p_note: args.note ?? null, p_prices: args.prices ?? [], p_delivery_fee: args.deliveryFee ?? 0,
  })
  if (error) throw new Error(clean(error.message))
  refresh(args.id)
}

async function advanceImpl(args: { id: string; step: "paid" | "reject_payment" | "preparing" | "ready" | "out_for_delivery" | "completed"; date?: string; note?: string }) {
  const { supabase } = await assertDashboard("supply_office", "supply")
  const { error } = await supabase.rpc("advance_supply_request", {
    p_id: args.id, p_step: args.step, p_date: args.date || null, p_note: args.note ?? null,
  })
  if (error) throw new Error(clean(error.message))
  refresh(args.id)
  // Completing adds collab stock and product drafts on the requester's side
  if (args.step === "completed") for (const m of REQUESTERS) { revalidatePath(`${MODULES[m].basePath}/products`); revalidatePath(`${MODULES[m].basePath}/inventory`) }
}

export async function submitSupplyRequest(...args: Parameters<typeof submitImpl>) { return attempt(() => submitImpl(...args)) }
export async function cancelSupplyRequest(...args: Parameters<typeof cancelImpl>) { return attempt(() => cancelImpl(...args)) }
export async function paySupplyRequest(...args: Parameters<typeof payImpl>) { return attempt(() => payImpl(...args)) }
export async function reviewSupplyRequest(...args: Parameters<typeof reviewImpl>) { return attempt(() => reviewImpl(...args)) }
export async function advanceSupplyRequest(...args: Parameters<typeof advanceImpl>) { return attempt(() => advanceImpl(...args)) }
