import { createClient } from "@/lib/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Sales + royalty analytics shared by the BAO BI dashboard and store sales reports.
 *
 * Royalty model: buyers pay the listed price; for official-logo products a royalty (like a tax)
 * is taken from the seller's earnings and goes to BAO. Royalty counts as EARNED once the sale is
 * paid (paid / ready for pickup / completed) and as PENDING while the order awaits payment.
 * Products made in collaboration with the Main Supply Office: the Supply Office owes their royalty,
 * so in the selling store's own figures they carry no royalty (BAO's figures still count it).
 */

export const EARNED_STATUSES = ["paid", "ready_for_pickup", "completed"]

export type SaleLine = {
  orderId: string
  createdAt: string
  status: string
  storeId: string
  productId: string | null
  productName: string
  quantity: number
  unitPrice: number
  /** Royalty per unit — in a store's own view, only what that store owes */
  royaltyPerUnit: number
  /** Royalty rate of the sale (%), when recorded */
  royaltyPercentage: number | null
  /** Royalty paid by the Main Supply Office (collaboration product) */
  collab: boolean
}

type Row = {
  order_id: string; product_id: string | null; product_name: string; quantity: number
  unit_price: number; royalty_amount?: number | null; seller_id: string
  royalty_percentage?: number | null; royalty_store_id?: string | null
  orders: { created_at: string; status: string } | { created_at: string; status: string }[] | null
}

/** Every sold line (cancelled orders excluded), optionally for one store and/or a date range. */
export async function loadSales(
  supabase: Supabase,
  opts: { storeId?: string | null; from?: Date | null; to?: Date | null } = {},
): Promise<SaleLine[]> {
  const page = 1000
  const maxPages = 20
  // 2: royalty amount + rate + owner (scripts/32), 1: amount only (scripts/15), 0: neither
  let level = 2
  const royaltyCols = ["", ", royalty_amount", ", royalty_amount, royalty_percentage, royalty_store_id"]

  // A stable order (the row id) keeps pages from skipping or repeating rows
  const fetchPage = (index: number, withCount: boolean) => {
    const cols = `order_id, product_id, product_name, quantity, unit_price, seller_id${royaltyCols[level]}, orders!inner(created_at, status)`
    let q = supabase.from("order_items").select(cols, withCount ? { count: "exact" } : undefined)
      .neq("orders.status", "cancelled").order("id").range(index * page, index * page + page - 1)
    if (opts.storeId) q = q.eq("seller_id", opts.storeId)
    if (opts.from) q = q.gte("orders.created_at", opts.from.toISOString())
    if (opts.to) q = q.lte("orders.created_at", opts.to.toISOString())
    return q
  }

  // First page (also tells us how many rows there are); older databases lack some royalty columns
  let first = await fetchPage(0, true)
  while (first.error && level > 0 && /royalty_(amount|percentage|store_id)/.test(first.error.message)) {
    level-- // database before scripts/32 (or scripts/15)
    first = await fetchPage(0, true)
  }
  if (first.error) return []

  // The remaining pages are fetched together instead of one after another
  const total = first.count ?? (first.data?.length ?? 0)
  const pageCount = Math.min(maxPages, Math.ceil(total / page))
  const rest = await Promise.all(Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => fetchPage(i + 1, false)))

  const lines: SaleLine[] = []
  for (const result of [first, ...rest]) {
    for (const r of (result.data ?? []) as unknown as Row[]) {
      const o = Array.isArray(r.orders) ? r.orders[0] : r.orders
      if (!o) continue
      const collab = !!r.royalty_store_id && r.royalty_store_id !== r.seller_id
      lines.push({
        orderId: r.order_id, createdAt: o.created_at, status: o.status, storeId: r.seller_id,
        productId: r.product_id, productName: r.product_name, quantity: r.quantity,
        unitPrice: Number(r.unit_price),
        royaltyPerUnit: collab && opts.storeId ? 0 : Number(r.royalty_amount ?? 0),
        royaltyPercentage: r.royalty_percentage != null ? Number(r.royalty_percentage) : null,
        collab,
      })
    }
  }
  return lines
}

export type SalesTotals = {
  orders: number
  itemsSold: number
  gross: number
  royaltyEarned: number
  royaltyPending: number
  net: number
}

export function totals(lines: SaleLine[]): SalesTotals {
  const orders = new Set<string>()
  let itemsSold = 0, gross = 0, royaltyEarned = 0, royaltyPending = 0
  for (const l of lines) {
    orders.add(l.orderId)
    itemsSold += l.quantity
    gross += l.unitPrice * l.quantity
    const royalty = l.royaltyPerUnit * l.quantity
    if (EARNED_STATUSES.includes(l.status)) royaltyEarned += royalty
    else royaltyPending += royalty
  }
  const royaltyAll = royaltyEarned + royaltyPending
  return { orders: orders.size, itemsSold, gross, royaltyEarned, royaltyPending, net: gross - royaltyAll }
}

/** Last `months` calendar months (oldest first) with sales and royalty per month. */
export function byMonth(lines: SaleLine[], months = 6) {
  const now = new Date()
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-PH", { month: "short", year: "2-digit" }), gross: 0, royalty: 0, orders: new Set<string>(), items: 0 }
  })
  const index = new Map(buckets.map((b, i) => [b.key, i]))
  for (const l of lines) {
    const d = new Date(l.createdAt)
    const i = index.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (i === undefined) continue
    buckets[i].gross += l.unitPrice * l.quantity
    if (EARNED_STATUSES.includes(l.status)) buckets[i].royalty += l.royaltyPerUnit * l.quantity
    buckets[i].orders.add(l.orderId)
    buckets[i].items += l.quantity
  }
  return buckets.map((b) => ({ label: b.label, gross: b.gross, royalty: b.royalty, orders: b.orders.size, items: b.items }))
}

/** Aggregate by a key (store or product), sorted by gross sales. */
export function groupBy(lines: SaleLine[], key: (l: SaleLine) => string) {
  type Group = { key: string; gross: number; royaltyEarned: number; royaltyPending: number; items: number; orders: Set<string>; rates: Set<number>; collab: boolean }
  const map = new Map<string, Group>()
  for (const l of lines) {
    const k = key(l)
    const g = map.get(k) ?? { key: k, gross: 0, royaltyEarned: 0, royaltyPending: 0, items: 0, orders: new Set<string>(), rates: new Set<number>(), collab: false }
    g.gross += l.unitPrice * l.quantity
    g.items += l.quantity
    g.orders.add(l.orderId)
    if (l.royaltyPercentage != null) g.rates.add(l.royaltyPercentage)
    if (l.collab) g.collab = true
    if (EARNED_STATUSES.includes(l.status)) g.royaltyEarned += l.royaltyPerUnit * l.quantity
    else g.royaltyPending += l.royaltyPerUnit * l.quantity
    map.set(k, g)
  }
  return [...map.values()]
    .map((g) => ({ ...g, orders: g.orders.size, rates: [...g.rates].sort((a, b) => a - b) }))
    .sort((a, b) => b.gross - a.gross)
}

export async function storeNames(supabase: Supabase, ids: string[]) {
  const unique = [...new Set(ids)].filter(Boolean)
  if (!unique.length) return new Map<string, string>()
  const { data } = await supabase.from("seller_profiles").select("id, org_name").in("id", unique)
  return new Map((data ?? []).map((s) => [s.id as string, s.org_name as string]))
}

/** "3%" or "3% / 5%" (sales recorded at different rates); "—" when no rate is recorded. */
export function ratesLabel(rates: number[]) {
  return rates.length ? rates.map((r) => `${r}%`).join(" / ") : "—"
}

export function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "YYYY-MM-DD" → Date at local midnight (start) or end of day. */
export function parseDay(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`)
  return Number.isNaN(d.getTime()) ? null : d
}
