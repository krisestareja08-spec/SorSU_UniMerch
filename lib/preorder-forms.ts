import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { collegeLabel, programLabel } from "@/lib/campus-catalog"

/**
 * Pre-order completion forms (Supply Office and its branches): one form per pre-ordered product,
 * listing every buyer whose pre-order has been purchased (paid) and/or claimed (picked up) —
 * the online version of the office's paper "Pre-Order" sheets.
 *
 * A pre-order is an order with a pick-up date (orders.pickup_date, scripts/29). Statuses:
 *   paid / partially_paid / ready_for_pickup → Purchased     completed → Claimed (and purchased)
 * Dates come from the order's status history (scripts/13).
 */

export type PreorderRecord = {
  key: string
  orderId: string
  productId: string | null
  productName: string
  buyerName: string
  course: string | null
  contact: string | null
  /** e.g. "M × 2, L × 1" */
  variation: string
  quantity: number
  amountPaid: number
  partial: boolean
  orderedAt: string
  purchasedAt: string | null
  claimedAt: string | null
  claimed: boolean
}

export type PreorderForm = {
  productId: string | null
  productName: string
  image: string | null
  records: number
  units: number
  claimed: number
  amount: number
  lastActivity: string
}

const PURCHASED = ["paid", "partially_paid", "ready_for_pickup", "completed"]

type Line = {
  order_id: string; product_id: string | null; product_name: string; variant: string | null; quantity: number; unit_price: number
  orders: Order | Order[] | null
}
type Order = { id: string; buyer_id: string; status: string; total: number; amount_paid: number | null; created_at: string; pickup_date: string | null }

/** Every purchased/claimed pre-order line of this store, grouped into one record per order and product. */
export async function loadPreorderRecords(storeId: string): Promise<{ records: PreorderRecord[]; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("order_items")
    .select("order_id, product_id, product_name, variant, quantity, unit_price, orders!inner(id, buyer_id, status, total, amount_paid, created_at, pickup_date)")
    .eq("seller_id", storeId)
    .not("orders.pickup_date", "is", null)
    .in("orders.status", PURCHASED)
    .order("order_id")
    .limit(5000)
  if (error) {
    return { records: [], error: /pickup_date/.test(error.message) ? "Pre-orders need scripts/29_preorder_id_penalties.sql. Ask the admin to run it in Supabase." : error.message }
  }

  const lines = (data ?? []) as unknown as Line[]
  const orderOf = (l: Line) => (Array.isArray(l.orders) ? l.orders[0] : l.orders)!
  const orderIds = [...new Set(lines.map((l) => l.order_id))]
  const buyerIds = [...new Set(lines.map((l) => orderOf(l).buyer_id))]

  // Status dates (store staff can read their orders' history) and buyer details (other people's
  // profiles are private under RLS, so read with the server key — this page is staff-only)
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
  for (const h of (history ?? []) as { order_id: string; status: string; created_at: string }[]) {
    if (["paid", "partially_paid"].includes(h.status) && !purchasedAt.has(h.order_id)) purchasedAt.set(h.order_id, h.created_at)
    if (h.status === "completed") claimedAt.set(h.order_id, h.created_at)
  }
  const people = new Map((profiles ?? []).map((p) => [p.id as string, p]))

  const byKey = new Map<string, PreorderRecord & { parts: string[] }>()
  for (const l of lines) {
    const o = orderOf(l)
    const k = `${o.id}:${l.product_id ?? l.product_name}`
    const lineTotal = Number(l.unit_price) * l.quantity
    const p = people.get(o.buyer_id)
    const rec = byKey.get(k) ?? {
      key: k, orderId: o.id, productId: l.product_id, productName: l.product_name,
      buyerName: p?.full_name?.trim() || "Buyer", course: programLabel(p?.course?.trim(), { short: true }) || collegeLabel(p?.department?.trim(), { short: true }) || null, contact: p?.contact ?? null,
      variation: "", parts: [] as string[], quantity: 0, amountPaid: 0, partial: o.status === "partially_paid",
      orderedAt: o.created_at,
      // A claimed order was paid at pick-up at the latest
      purchasedAt: purchasedAt.get(o.id) ?? claimedAt.get(o.id) ?? null,
      claimedAt: o.status === "completed" ? claimedAt.get(o.id) ?? null : null,
      claimed: o.status === "completed",
    }
    rec.parts.push(`${l.variant ? `${l.variant} ` : ""}× ${l.quantity}`)
    rec.quantity += l.quantity
    // Partly paid: what was paid on the order, up to this product's share
    rec.amountPaid += o.status === "partially_paid" ? Math.min(lineTotal, Number(o.amount_paid ?? 0)) : lineTotal
    byKey.set(k, rec)
  }

  const records = [...byKey.values()]
    .map(({ parts, ...r }) => ({ ...r, variation: parts.join(", "), amountPaid: Math.round(r.amountPaid * 100) / 100 }))
    .sort((a, b) => (a.purchasedAt ?? a.orderedAt).localeCompare(b.purchasedAt ?? b.orderedAt))
  return { records, error: null }
}

/** One form per product, newest activity first. */
export async function summarizeForms(records: PreorderRecord[], storeId: string): Promise<PreorderForm[]> {
  const map = new Map<string, PreorderForm>()
  for (const r of records) {
    const k = r.productId ?? r.productName
    const f = map.get(k) ?? { productId: r.productId, productName: r.productName, image: null, records: 0, units: 0, claimed: 0, amount: 0, lastActivity: r.orderedAt }
    f.records += 1
    f.units += r.quantity
    if (r.claimed) f.claimed += 1
    f.amount += r.amountPaid
    const latest = r.claimedAt ?? r.purchasedAt ?? r.orderedAt
    if (latest > f.lastActivity) f.lastActivity = latest
    map.set(k, f)
  }
  const ids = [...map.values()].map((f) => f.productId).filter((id): id is string => !!id)
  if (ids.length) {
    const supabase = await createClient()
    const { data } = await supabase.from("products").select("id, image_url").eq("seller_id", storeId).in("id", ids)
    for (const p of data ?? []) {
      const f = map.get(p.id as string)
      if (f) f.image = (p.image_url as string | null) ?? null
    }
  }
  return [...map.values()].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
}
