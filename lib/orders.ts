import { createClient } from "@/lib/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

export type BuyerOrderItem = {
  id: string
  productId: string | null
  name: string
  image: string | null
  variant: string | null
  quantity: number
  unitPrice: number
  originalPrice: number
  preOrder: boolean
}

export type BuyerOrder = {
  id: string
  status: string
  createdAt: string
  total: number
  paymentMethod: string
  referenceNumber: string | null
  receiptUrl: string | null
  store: { id: string; name: string; logoUrl: string | null } | null
  pickupLocation: string | null
  pickupNotes: string | null
  storeHours: string | null
  /** Claim-by time for pre-orders; null when the order has no deadline. */
  pickupDeadline: string | null
  items: BuyerOrderItem[]
  history: { status: string; created_at: string }[]
}

type OrderRow = {
  id: string; status: string; created_at: string; total: number; payment_method: string
  reference_number?: string | null; receipt_url: string | null
  seller_id?: string | null; pickup_location?: string | null; pickup_notes?: string | null
  order_items: {
    id: string; product_id: string | null; seller_id: string; product_name: string; product_image_url: string | null
    variant: string | null; quantity: number; unit_price: number; original_price?: number | null
    products: { badge: string | null; price: number | null } | { badge: string | null; price: number | null }[] | null
  }[]
}

const ITEM_COLUMNS = "id, product_id, seller_id, product_name, product_image_url, variant, quantity, unit_price"
const BASE = `id, status, created_at, total, payment_method, reference_number, receipt_url`

/** The signed-in buyer's orders (RLS limits rows to their own), newest first. */
export async function getBuyerOrders(supabase: Supabase, opts: { ids?: string[]; limit?: number } = {}): Promise<BuyerOrder[]> {
  const run = (extended: boolean) => {
    let q = supabase
      .from("orders")
      .select(
        extended
          ? `${BASE}, seller_id, pickup_location, pickup_notes, order_items(${ITEM_COLUMNS}, original_price, products(badge, price))`
          : `${BASE}, order_items(${ITEM_COLUMNS}, products(badge, price))`,
      )
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 50)
    if (opts.ids?.length) q = q.in("id", opts.ids)
    return q
  }
  let { data, error } = await run(true)
  if (error) ({ data } = await run(false)) // before scripts/13_orders_pickup.sql
  const rows = (data ?? []) as unknown as OrderRow[]
  if (rows.length === 0) return []

  // Store (seller) of each order
  const storeIds = [...new Set(rows.map((o) => o.seller_id ?? o.order_items[0]?.seller_id).filter(Boolean) as string[])]
  let stores: unknown[] | null = []
  if (storeIds.length) {
    const full = await supabase.from("seller_profiles").select("id, org_name, logo_url, pickup_location, pickup_notes").in("id", storeIds)
    stores = full.error ? (await supabase.from("seller_profiles").select("id, org_name").in("id", storeIds)).data : full.data
  }
  const storeById = new Map(((stores ?? []) as { id: string; org_name: string; logo_url?: string | null; pickup_location?: string | null; pickup_notes?: string | null }[]).map((s) => [s.id, s]))

  // store_hours / pickup_deadline arrive with scripts/22_preorder_pickup.sql; errors just leave them empty.
  const { data: hourRows } = storeIds.length ? await supabase.from("seller_profiles").select("id, store_hours").in("id", storeIds) : { data: null }
  const hoursByStore = new Map(((hourRows ?? []) as { id: string; store_hours: string | null }[]).map((r) => [r.id, r.store_hours]))
  const { data: deadlineRows } = await supabase.from("orders").select("id, pickup_deadline").in("id", rows.map((o) => o.id))
  const deadlineByOrder = new Map(((deadlineRows ?? []) as { id: string; pickup_deadline: string | null }[]).map((r) => [r.id, r.pickup_deadline]))

  const { data: historyRows } = await supabase
    .from("order_status_history")
    .select("order_id, status, created_at")
    .in("order_id", rows.map((o) => o.id))
    .order("created_at")
  const historyByOrder = new Map<string, { status: string; created_at: string }[]>()
  for (const h of (historyRows ?? []) as { order_id: string; status: string; created_at: string }[]) {
    historyByOrder.set(h.order_id, [...(historyByOrder.get(h.order_id) ?? []), h])
  }

  return rows.map((o) => {
    const storeId = o.seller_id ?? o.order_items[0]?.seller_id ?? null
    const store = storeId ? storeById.get(storeId) : undefined
    return {
      id: o.id,
      status: o.status,
      createdAt: o.created_at,
      total: Number(o.total),
      paymentMethod: o.payment_method,
      referenceNumber: o.reference_number ?? null,
      receiptUrl: o.receipt_url,
      store: storeId ? { id: storeId, name: store?.org_name ?? "Campus Seller", logoUrl: store?.logo_url ?? null } : null,
      // Snapshot taken at checkout; falls back to the store's current pickup location.
      pickupLocation: o.pickup_location ?? store?.pickup_location ?? null,
      pickupNotes: o.pickup_notes ?? store?.pickup_notes ?? null,
      storeHours: storeId ? hoursByStore.get(storeId) ?? null : null,
      pickupDeadline: deadlineByOrder.get(o.id) ?? null,
      items: o.order_items.map((i) => {
        const product = Array.isArray(i.products) ? i.products[0] : i.products
        return {
          id: i.id,
          productId: i.product_id,
          name: i.product_name,
          image: i.product_image_url,
          variant: i.variant,
          quantity: i.quantity,
          unitPrice: Number(i.unit_price),
          originalPrice: Number(i.original_price ?? Math.max(Number(i.unit_price), Number(product?.price ?? i.unit_price))),
          preOrder: product?.badge === "Pre-Order",
        }
      }),
      history: historyByOrder.get(o.id) ?? [],
    }
  })
}
