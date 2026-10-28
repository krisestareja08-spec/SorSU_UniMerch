import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { collegeLabel, programLabel } from "@/lib/campus-catalog"
import { sizeQty, type FormColumn, type FormStock, type PreorderFormDef, type PreorderFormRow } from "@/lib/preorder-form-shape"

/**
 * Pre-order forms (scripts/29) — the online version of the shop's paper "Pre-Order" sheets, and the
 * live waitlist. The shop makes each form: a title and Size / Qty cells, each covering one or more
 * products (e.g. "School Uniform": [Polo, Blouse] [Pants, Skirt]). A buyer is listed once their
 * pre-order is paid in full or half, in queue order (when they ordered). Marked ready → "Ready for
 * pick up"; picked up (completed) → History. An order with products in different forms appears in
 * each form with just that form's products.
 */

export type { FormColumn, FormStock, PreorderFormDef, PreorderFormRow } from "@/lib/preorder-form-shape"

/** One buyer's paid pre-order, with all of its lines */
export type PreorderPurchase = {
  orderId: string
  buyerName: string
  course: string | null
  contact: string | null
  status: string
  total: number
  amountPaid: number
  plan: string | null
  orderedAt: string
  pickupDate: string | null
  claimedAt: string | null
  lines: { productId: string | null; variantId: string | null; productName: string; variant: string | null; quantity: number; lineTotal: number }[]
}

type Line = {
  order_id: string; product_id: string | null; variant_id: string | null; product_name: string; variant: string | null; quantity: number; unit_price: number
  orders: Order | Order[] | null
}
type Order = {
  id: string; buyer_id: string; status: string; total: number; amount_paid: number | null; created_at: string
  payment_plan: string | null; pickup_date: string | null
}

const SETUP_ERROR = "Pre-order forms need the latest scripts/29_preorder_id_penalties.sql. Ask the admin to run it in Supabase."
/** Paid half or in full, waiting / ready, and picked up */
const LISTED = ["partially_paid", "paid", "ready_for_pickup", "completed"]

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

/** Every paid pre-order of the store (waiting, ready for pick up, or picked up). */
export async function loadPurchases(storeId: string): Promise<{ purchases: PreorderPurchase[]; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("order_items")
    .select("order_id, product_id, variant_id, product_name, variant, quantity, unit_price, orders!inner(id, buyer_id, status, total, amount_paid, created_at, payment_plan, pickup_date)")
    .eq("seller_id", storeId)
    .eq("orders.is_preorder", true)
    .in("orders.status", LISTED)
    .order("order_id")
    .limit(5000)
  if (error) return { purchases: [], error: /is_preorder|payment_plan|variant_id/.test(error.message) ? SETUP_ERROR : error.message }

  const lines = (data ?? []) as unknown as Line[]
  const orderOf = (l: Line) => (Array.isArray(l.orders) ? l.orders[0] : l.orders)!
  const orderIds = [...new Set(lines.map((l) => l.order_id))]
  const buyerIds = [...new Set(lines.map((l) => orderOf(l).buyer_id))]

  // Pick-up dates (store staff can read their orders' history) and buyer details (other people's
  // profiles are private under RLS, so read with the server key — these pages are staff-only)
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const service = url && key ? createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null
  const [{ data: history }, { data: profiles }] = await Promise.all([
    orderIds.length
      ? supabase.from("order_status_history").select("order_id, status, created_at").in("order_id", orderIds).eq("status", "completed")
      : Promise.resolve({ data: [] as { order_id: string; status: string; created_at: string }[] }),
    buyerIds.length && service
      ? service.from("profiles").select("id, full_name, contact, course, department").in("id", buyerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; contact: string | null; course: string | null; department: string | null }[] }),
  ])
  const claimedAt = new Map(((history ?? []) as { order_id: string; created_at: string }[]).map((h) => [h.order_id, h.created_at]))
  const people = new Map((profiles ?? []).map((p) => [p.id as string, p]))

  const byOrder = new Map<string, PreorderPurchase>()
  for (const l of lines) {
    const o = orderOf(l)
    const p = people.get(o.buyer_id)
    const completed = o.status === "completed"
    const rec = byOrder.get(o.id) ?? {
      orderId: o.id,
      buyerName: p?.full_name?.trim() || "Buyer",
      course: programLabel(p?.course?.trim(), { short: true }) || collegeLabel(p?.department?.trim(), { short: true }) || null,
      contact: p?.contact ?? null,
      status: o.status,
      total: Number(o.total),
      amountPaid: completed || o.status === "paid" ? Number(o.total) : Number(o.amount_paid ?? 0),
      plan: o.payment_plan,
      orderedAt: o.created_at,
      pickupDate: o.pickup_date,
      claimedAt: completed ? claimedAt.get(o.id) ?? null : null,
      lines: [] as PreorderPurchase["lines"],
    }
    rec.lines.push({ productId: l.product_id, variantId: l.variant_id, productName: l.product_name, variant: l.variant, quantity: l.quantity, lineTotal: Number(l.unit_price) * l.quantity })
    byOrder.set(o.id, rec)
  }
  return { purchases: [...byOrder.values()].sort((a, b) => a.orderedAt.localeCompare(b.orderedAt)), error: null }
}

/** Stock of the form's products and their sizes, for "in stock N · waiting M". */
export async function loadFormStock(productIds: string[]): Promise<FormStock> {
  if (productIds.length === 0) return {}
  const supabase = await createClient()
  const [{ data: products }, { data: variants }] = await Promise.all([
    supabase.from("products").select("id, name, stock").in("id", productIds),
    supabase.from("product_variants").select("id, product_id, name, stock, position").in("product_id", productIds).order("position"),
  ])
  const out: FormStock = {}
  for (const p of products ?? []) out[p.id as string] = { name: p.name as string, stock: Number(p.stock), sizes: [] }
  for (const v of variants ?? []) out[v.product_id as string]?.sizes.push({ id: v.id as string, name: v.name as string, stock: Number(v.stock) })
  return out
}

/** The rows of one form: each paid pre-order that includes any of the form's products, queue-numbered. */
export function formRows(form: PreorderFormDef, purchases: PreorderPurchase[]): PreorderFormRow[] {
  const ids = new Set(form.columns.flatMap((c) => c.products.map((p) => p.id)))
  const rows: PreorderFormRow[] = []
  let queue = 0
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
    const stage = pu.status === "completed" ? "claimed" : pu.status === "ready_for_pickup" ? "ready" : "waitlist"
    rows.push({
      key: `${form.id}:${pu.orderId}`,
      orderId: pu.orderId, buyerName: pu.buyerName, course: pu.course, contact: pu.contact,
      cells: Object.fromEntries([...parts].map(([id, p]) => [id, p.join(", ")])),
      quantities,
      sizes: mine.map((l) => ({ productId: l.productId!, variantId: l.variantId, variant: l.variant, quantity: l.quantity })),
      quantity: mine.reduce((n, l) => n + l.quantity, 0),
      amountPaid, share, partial: amountPaid < share, plan: pu.plan,
      stage, status: pu.status,
      // Queue: order of pre-ordering among those still waiting or ready (stays the same when filtered)
      queueNo: stage === "claimed" ? null : ++queue,
      orderedAt: pu.orderedAt, pickupDate: pu.pickupDate, claimedAt: pu.claimedAt,
    })
  }
  return rows
}
