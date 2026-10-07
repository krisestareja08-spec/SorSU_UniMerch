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

/** Restock or correct a product's stock; every change is recorded as an inventory movement. */
async function adjustStockImpl(formData: FormData) {
  const mod = storeModule(formData.get("module"))
  const productId = formData.get("product_id") as string
  const change = Number.parseInt(formData.get("change") as string, 10)
  const reason = formData.get("reason") === "adjustment" ? "adjustment" : "restock"
  const note = ((formData.get("note") as string) ?? "").trim().slice(0, 300) || null
  if (!productId || !Number.isFinite(change) || change === 0) throw new Error("Enter a non-zero quantity.")
  if (reason === "restock" && change < 0) throw new Error("A restock must add stock. Use Adjustment to remove units.")

  const { supabase, userId, storeId } = await assertDashboard(mod, "inventory")
  const { data: product } = await supabase.from("products").select("name, stock, seller_id").eq("id", productId).maybeSingle()
  if (!product || product.seller_id !== storeId) throw new Error("Product not found in your store.")
  const newStock = Math.max(0, Number(product.stock) + change)

  const { error } = await supabase.from("products").update({ stock: newStock, updated_at: new Date().toISOString() }).eq("id", productId)
  if (error) throw new Error(error.message)

  await supabase.from("inventory_movements").insert({
    store_id: storeId, product_id: productId, product_name: product.name,
    change: newStock - Number(product.stock), reason, note, created_by: userId,
  }).then(() => {}, () => {}) // table arrives with scripts/15_bao_bi.sql

  revalidatePath(`${MODULES[mod].basePath}/inventory`)
}

// ── Exported actions: return ActionResult (lib/action-result.ts) instead of throwing ──
export async function submitSalesReport(...args: Parameters<typeof submitSalesReportImpl>) {
  return attempt(() => submitSalesReportImpl(...args))
}
export async function adjustStock(...args: Parameters<typeof adjustStockImpl>) {
  return attempt(() => adjustStockImpl(...args))
}
