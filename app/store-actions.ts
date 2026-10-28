"use server"

import { attempt } from "@/lib/action-result"

import { revalidatePath } from "next/cache"
import { assertDashboard } from "@/lib/dashboards"
import { groupBy, loadSales, parseDay, totals } from "@/lib/analytics"
import { MODULES, type ModuleKey } from "@/lib/modules"

const STORE_MODULES: ModuleKey[] = ["seller", "cashier", "supply_office"]

function storeModule(raw: FormDataEntryValue | null): ModuleKey {
  const m = String(raw) as ModuleKey
  if (!STORE_MODULES.includes(m)) throw new Error("Invalid dashboard")
  return m
}

/**
 * A store submits its sales report for a period to BAO. Figures are recomputed on the server from
 * the recorded orders (never trusted from the form), so BAO sees exactly what the data says.
 */
async function submitSalesReportImpl(formData: FormData) {
  const mod = storeModule(formData.get("module"))
  const from = parseDay(formData.get("from") as string)
  const to = parseDay(formData.get("to") as string, true)
  const notes = ((formData.get("notes") as string) ?? "").trim().slice(0, 1000) || null
  if (!from || !to || from > to) throw new Error("Choose a valid period.")

  const { supabase, userId, storeId } = await assertDashboard(mod, "reports")
  if (!storeId) throw new Error("This dashboard has no store.")

  const lines = await loadSales(supabase, { storeId, from, to })
  const t = totals(lines)
  const breakdown = groupBy(lines, (l) => l.productName).map((g) => ({
    product: g.key, items: g.items, gross: Math.round(g.gross * 100) / 100, royalty: Math.round((g.royaltyEarned + g.royaltyPending) * 100) / 100,
    // Royalty rate(s) the items sold at, and whether the Main Supply Office pays the royalty
    rates: g.rates, collab: g.collab,
  }))

  const { error } = await supabase.from("sales_reports").insert({
    store_id: storeId,
    module: mod,
    period_start: formData.get("from"),
    period_end: formData.get("to"),
    orders_count: t.orders,
    items_sold: t.itemsSold,
    gross_sales: t.gross,
    royalty_due: t.royaltyEarned + t.royaltyPending,
    net_sales: t.net,
    breakdown,
    notes,
    submitted_by: userId,
  })
  if (error) throw new Error(error.message.includes("sales_reports") ? "Reports aren't enabled yet — run scripts/15_bao_bi.sql." : error.message)

  revalidatePath(`${MODULES[mod].basePath}/reports`)
  revalidatePath("/bao/reports")
}

/**
 * Update a product's (or one size's) stock in plain terms; every change is recorded as an inventory movement:
 *  • add    — units received: adds to the current stock (recorded as a restock)
 *  • remove — units lost, damaged or taken out: subtracts (recorded as an adjustment)
 *  • set    — the actual counted total: replaces the current stock (recorded as an adjustment)
 */
async function adjustStockImpl(formData: FormData): Promise<{ before: number; after: number; label: string }> {
  const mod = storeModule(formData.get("module"))
  const productId = formData.get("product_id") as string
  // A size of the product (scripts/28): its own stock; the product total follows automatically
  const variantId = (formData.get("variant_id") as string | null) || null
  const mode = String(formData.get("mode") ?? "")
  const quantity = Number(formData.get("quantity"))
  const note = ((formData.get("note") as string) ?? "").trim().slice(0, 300) || null
  if (!productId) throw new Error("Choose a product.")
  if (!["add", "remove", "set"].includes(mode)) throw new Error("Choose what you want to do: add, remove or set the count.")
  if (!Number.isInteger(quantity)) throw new Error("Enter a whole number of units.")

  // Supply Office branches are stocked by the Main Supply Office (scripts/31)
  if (mod === "cashier") throw new Error("Stock is added by the Main Supply Office — send a restock request from Inventory.")
  const { supabase, userId, storeId } = await assertDashboard(mod, "inventory")
  const { data: product } = await supabase.from("products").select("name, stock, seller_id").eq("id", productId).maybeSingle()
  if (!product || product.seller_id !== storeId) throw new Error("Product not found in your store.")
  let before = Number(product.stock)
  let label = product.name
  if (variantId) {
    const { data: variant } = await supabase.from("product_variants").select("name, stock").eq("id", variantId).eq("product_id", productId).maybeSingle()
    if (!variant) throw new Error("That size was not found.")
    before = Number(variant.stock)
    label = `${product.name} (${variant.name})`
  }

  let newStock: number
  if (mode === "add") {
    if (quantity < 1) throw new Error("Enter how many units you're adding (1 or more).")
    newStock = before + quantity
  } else if (mode === "remove") {
    if (quantity < 1) throw new Error("Enter how many units you're removing (1 or more).")
    if (quantity > before) throw new Error(`Only ${before} in stock — you can't remove ${quantity}.`)
    newStock = before - quantity
  } else {
    if (quantity < 0) throw new Error("The counted total can't be negative.")
    newStock = quantity
  }
  if (newStock === before) throw new Error(`Stock is already ${before} — nothing to change.`)
  const reason = mode === "add" ? "restock" : "adjustment"
  const recordedNote = note ?? (mode === "set" ? "Stock count" : null)

  const { error } = variantId
    ? await supabase.from("product_variants").update({ stock: newStock, updated_at: new Date().toISOString() }).eq("id", variantId)
    : await supabase.from("products").update({ stock: newStock, updated_at: new Date().toISOString() }).eq("id", productId)
  if (error) throw new Error(error.message)

  await supabase.from("inventory_movements").insert({
    store_id: storeId, product_id: productId, product_name: label,
    ...(variantId ? { variant_id: variantId } : {}),
    change: newStock - before, reason, note: recordedNote, created_by: userId,
  }).then(() => {}, () => {}) // table arrives with scripts/15_bao_bi.sql

  revalidatePath(`${MODULES[mod].basePath}/inventory`)
  return { before, after: newStock, label }
}

// ── Exported actions: return ActionResult (lib/action-result.ts) instead of throwing ──
export async function submitSalesReport(...args: Parameters<typeof submitSalesReportImpl>) {
  return attempt(() => submitSalesReportImpl(...args))
}
export async function adjustStock(...args: Parameters<typeof adjustStockImpl>) {
  return attempt(() => adjustStockImpl(...args))
}
