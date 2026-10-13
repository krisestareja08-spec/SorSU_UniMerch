import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { collegeLabel, programLabel } from "@/lib/campus-catalog"
import { sizeQty, type FormColumn, type PreorderFormDef } from "@/lib/preorder-form-shape"

/**
 * Pre-order completion forms (scripts/29) — the online version of the shop's paper "Pre-Order"
 * sheets. The shop makes each form: a title and Size / Qty cells, each covering one or more products
 * (e.g. "School Uniform": [Polo, Blouse] [Pants, Skirt]). Every pre-order with one of those products
 * becomes a row once it's paid (Purchased) and is marked Claimed when it's completed. An order with
 * products in different forms appears in each form with just that form's products.
 */

export type { FormColumn, PreorderFormDef } from "@/lib/preorder-form-shape"

/** One buyer's purchased / claimed pre-order, with all of its lines */
export type PreorderPurchase = {
  orderId: string
  buyerName: string
  course: string | null
  contact: string | null
  total: number
  amountPaid: number
  orderedAt: string
  purchasedAt: string | null
  claimedAt: string | null
  claimed: boolean
  lines: { productId: string | null; productName: string; variant: string | null; quantity: number; lineTotal: number }[]
}

/** A form's row: one buyer, the sizes / quantities per product, and the share of the payment */
export type PreorderFormRow = {
  key: string
  orderId: string
  buyerName: string
  course: string | null
  contact: string | null
  /** product id → e.g. "M-2, L-1" */
  cells: Record<string, string>
  /** product id → units */
  quantities: Record<string, number>
  quantity: number
  amountPaid: number
  partial: boolean
  purchasedAt: string | null
  claimedAt: string | null
  claimed: boolean
}

type Line = {
  order_id: string; product_id: string | null; product_name: string; variant: string | null; quantity: number; unit_price: number
  orders: Order | Order[] | null
}
type Order = { id: string; buyer_id: string; status: string; total: number; amount_paid: number | null; created_at: string }

const SETUP_ERROR = "Pre-order forms need the latest scripts/29_preorder_id_penalties.sql. Ask the admin to run it in Supabase."

/** The shop's forms, newest first. */
export async function loadForms(storeId: string): Promise<{ forms: PreorderFormDef[]; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("preorder_forms").select("id, title, columns, created_at, updated_at")
    .eq("store_id", storeId).order("created_at", { ascending: false })
  if (error) return { forms: [], error: /preorder_forms/.test(error.message) ? SETUP_ERROR : error.message }
  return {
    forms: (data ?? []).map((f) => ({
      id: f.id as string, title: f.title as string, columns: normalizeColumns(f.columns),
      createdAt: f.created_at as string, updatedAt: f.updated_at as string,
    })),
    error: null,
  }
}

export function normalizeColumns(raw: unknown): FormColumn[] {
  if (!Array.isArray(raw)) return []
  return raw.map((c) => ({
    products: (Array.isArray(c?.products) ? c.products : [])
      .filter((p: unknown): p is { id: string; name: string } => !!p && typeof (p as { id?: unknown }).id === "string")
      .map((p: { id: string; name?: string }) => ({ id: p.id, name: String(p.name ?? "Product") })),
  })).filter((c) => c.products.length > 0)
}

/** Every paid (purchased) or completed (claimed) pre-order of the store. */
export async function loadPurchases(storeId: string): Promise<{ purchases: PreorderPurchase[]; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("order_items")
    .select("order_id, product_id, product_name, variant, quantity, unit_price, orders!inner(id, buyer_id, status, total, amount_paid, created_at)")
    .eq("seller_id", storeId)
    .eq("orders.is_preorder", true)
    .in("orders.status", ["paid", "partially_paid", "ready_for_pickup", "completed"])
    .order("order_id")
    .limit(5000)
  if (error) return { purchases: [], error: /is_preorder/.test(error.message) ? SETUP_ERROR : error.message }

  const lines = (data ?? []) as unknown as Line[]
  const orderOf = (l: Line) => (Array.isArray(l.orders) ? l.orders[0] : l.orders)!
  const orderIds = [...new Set(lines.map((l) => l.order_id))]
  const buyerIds = [...new Set(lines.map((l) => orderOf(l).buyer_id))]

  // Status dates (store staff can read their orders' history) and buyer details (other people's
  // profiles are private under RLS, so read with the server key — these pages are staff-only)
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const service = url && key ? createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null
  const [{ data: history }, { data: profiles }] = await Promise.all([
    orderIds.length
      ? supabase.from("order_status_history").select("order_id, status, created_at").in("order_id", orderIds).order("created_at")
      : Promise.resolve({ data: [] as { order_id: string; status: string; created_at: string }[] }),
    buyerIds.length && service
      ? service.from("profiles").select("id, full_name, contact, course, department").in("id", buyerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; contact: string | null; course: string | null; department: string | null }[] }),
  ])

  const purchasedAt = new Map<string, string>()
  const claimedAt = new Map<string, string>()
  const everPaid = new Set<string>()
  for (const h of (history ?? []) as { order_id: string; status: string; created_at: string }[]) {
    if (["paid", "partially_paid"].includes(h.status)) {
      everPaid.add(h.order_id)
      if (!purchasedAt.has(h.order_id)) purchasedAt.set(h.order_id, h.created_at)
    }
    if (h.status === "completed") claimedAt.set(h.order_id, h.created_at)
  }
  const people = new Map((profiles ?? []).map((p) => [p.id as string, p]))

  const byOrder = new Map<string, PreorderPurchase>()
  for (const l of lines) {
    const o = orderOf(l)
    const claimed = o.status === "completed"
    const amountPaid = claimed || o.status === "paid" ? Number(o.total) : Number(o.amount_paid ?? 0)
    // A walk-in pre-order marked ready before any payment isn't purchased yet
    if (!claimed && amountPaid <= 0 && !everPaid.has(o.id)) continue
    const p = people.get(o.buyer_id)
    const rec = byOrder.get(o.id) ?? {
      orderId: o.id,
      buyerName: p?.full_name?.trim() || "Buyer",
      course: programLabel(p?.course?.trim(), { short: true }) || collegeLabel(p?.department?.trim(), { short: true }) || null,
      contact: p?.contact ?? null,
      total: Number(o.total),
      amountPaid,
      orderedAt: o.created_at,
      // A claimed order was paid at pick-up at the latest
      purchasedAt: purchasedAt.get(o.id) ?? claimedAt.get(o.id) ?? null,
      claimedAt: claimed ? claimedAt.get(o.id) ?? null : null,
      claimed,
      lines: [] as PreorderPurchase["lines"],
    }
    rec.lines.push({ productId: l.product_id, productName: l.product_name, variant: l.variant, quantity: l.quantity, lineTotal: Number(l.unit_price) * l.quantity })
    byOrder.set(o.id, rec)
  }
  const purchases = [...byOrder.values()].sort((a, b) => (a.purchasedAt ?? a.orderedAt).localeCompare(b.purchasedAt ?? b.orderedAt))
  return { purchases, error: null }
}

/** The rows of one form: each purchase that includes any of the form's products. */
export function formRows(form: PreorderFormDef, purchases: PreorderPurchase[]): PreorderFormRow[] {
  const ids = new Set(form.columns.flatMap((c) => c.products.map((p) => p.id)))
  const rows: PreorderFormRow[] = []
  for (const pu of purchases) {
    const mine = pu.lines.filter((l) => l.productId && ids.has(l.productId))
    if (mine.length === 0) continue
    const parts = new Map<string, string[]>()
    const quantities: Record<string, number> = {}
    for (const l of mine) {
      parts.set(l.productId!, [...(parts.get(l.productId!) ?? []), sizeQty(l.variant, l.quantity)])
      quantities[l.productId!] = (quantities[l.productId!] ?? 0) + l.quantity
    }
    const share = mine.reduce((n, l) => n + l.lineTotal, 0)
    // The order's payment, split across forms by what each form's products cost
    const amountPaid = pu.total > 0 ? Math.round(Math.min(share, (pu.amountPaid * share) / pu.total) * 100) / 100 : 0
    rows.push({
      key: `${form.id}:${pu.orderId}`,
      orderId: pu.orderId, buyerName: pu.buyerName, course: pu.course, contact: pu.contact,
      cells: Object.fromEntries([...parts].map(([id, p]) => [id, p.join(", ")])),
      quantities,
      quantity: mine.reduce((n, l) => n + l.quantity, 0),
      amountPaid, partial: amountPaid < share,
      purchasedAt: pu.purchasedAt, claimedAt: pu.claimedAt, claimed: pu.claimed,
    })
  }
  return rows
}
