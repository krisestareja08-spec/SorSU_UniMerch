"use server"

import { revalidatePath } from "next/cache"
import { attempt } from "@/lib/action-result"
import { assertDashboard } from "@/lib/dashboards"
import { MODULES, type ModuleKey } from "@/lib/modules"

const STORE_MODULES: ModuleKey[] = ["seller", "cashier", "supply_office"]

/**
 * Creates or updates a pre-order form: a title and Size / Qty cells, each listing the
 * store's products it covers. Product names are saved with the ids so a deleted product still shows.
 */
async function saveFormImpl(args: { module: ModuleKey; id?: string; title: string; columns: { productIds: string[] }[] }) {
  if (!STORE_MODULES.includes(args.module)) throw new Error("Invalid dashboard")
  const { supabase, storeId } = await assertDashboard(args.module, "orders")
  if (!storeId) throw new Error("This dashboard has no store.")

  const title = args.title.trim().replace(/\s+/g, " ")
  if (!title) throw new Error("Give the form a title, e.g. School Uniform.")
  if (title.length > 120) throw new Error("Keep the title under 120 characters.")

  const wanted = [...new Set(args.columns.flatMap((c) => c.productIds))]
  const { data: products, error: productsError } = wanted.length
    ? await supabase.from("products").select("id, name").eq("seller_id", storeId).in("id", wanted)
    : { data: [] as { id: string; name: string }[], error: null }
  if (productsError) throw new Error(productsError.message)
  const nameById = new Map((products ?? []).map((p) => [p.id as string, p.name as string]))

  const columns = args.columns
    .map((c) => ({ products: [...new Set(c.productIds)].filter((id) => nameById.has(id)).map((id) => ({ id, name: nameById.get(id)! })) }))
    .filter((c) => c.products.length > 0)
  if (columns.length === 0) throw new Error("Add at least one Size / Qty cell with a product.")

  const row = { title, columns, updated_at: new Date().toISOString() }
  const { data, error } = args.id
    ? await supabase.from("preorder_forms").update(row).eq("id", args.id).eq("store_id", storeId).select("id").single()
    : await supabase.from("preorder_forms").insert({ ...row, store_id: storeId }).select("id").single()
  if (error || !data) {
    throw new Error(/preorder_forms/.test(error?.message ?? "") ? "Pre-order forms need the latest scripts/29_preorder_id_penalties.sql. Ask the admin to run it in Supabase." : error?.message ?? "The form couldn't be saved.")
  }
  revalidatePath(`${MODULES[args.module].basePath}/preorders`)
  return { id: data.id as string }
}

async function deleteFormImpl(args: { module: ModuleKey; id: string }) {
  if (!STORE_MODULES.includes(args.module)) throw new Error("Invalid dashboard")
  const { supabase, storeId } = await assertDashboard(args.module, "orders")
  const { error } = await supabase.from("preorder_forms").delete().eq("id", args.id).eq("store_id", storeId ?? "")
  if (error) throw new Error(error.message)
  revalidatePath(`${MODULES[args.module].basePath}/preorders`)
}

/**
 * Batch "ready for pick up": the selected waitlisted pre-orders (paid half or full, this store's)
 * become Ready for Pick Up. The database notifies each buyer to choose a pick-up day and gives
 * them the shop's claim window. Stock isn't reserved: the first to pick up gets it.
 */
async function markReadyImpl(args: { module: ModuleKey; orderIds: string[] }) {
  if (!STORE_MODULES.includes(args.module)) throw new Error("Invalid dashboard")
  const ids = [...new Set(args.orderIds)].slice(0, 500)
  if (ids.length === 0) throw new Error("Select at least one buyer.")
  const { supabase, storeId } = await assertDashboard(args.module, "orders")
  const { data, error } = await supabase.from("orders")
    .update({ status: "ready_for_pickup" })
    .in("id", ids).eq("seller_id", storeId ?? "").eq("is_preorder", true).in("status", ["paid", "partially_paid"])
    .select("id")
  if (error) throw new Error(error.message)
  revalidatePath(`${MODULES[args.module].basePath}/preorders`, "layout")
  revalidatePath(`${MODULES[args.module].basePath}/orders`)
  return { updated: (data ?? []).length, skipped: ids.length - (data ?? []).length }
}

export async function markPreordersReady(...args: Parameters<typeof markReadyImpl>) {
  return attempt(() => markReadyImpl(...args))
}

export async function savePreorderForm(...args: Parameters<typeof saveFormImpl>) {
  return attempt(() => saveFormImpl(...args))
}
export async function deletePreorderForm(...args: Parameters<typeof deleteFormImpl>) {
  return attempt(() => deleteFormImpl(...args))
}
