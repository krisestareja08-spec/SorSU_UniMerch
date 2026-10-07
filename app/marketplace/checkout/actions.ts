"use server"

import { createClient } from "@/lib/supabase/server"
import { validateFullName } from "@/lib/profile-rules"

type OrderItem = {
  id: string
  sellerId?: string
  name: string
  seller: string
  price: number
  image: string
  quantity: number
  variant?: string
}

export async function submitOrder(args: {
  items: OrderItem[]
  paymentMethod: string
  receiptUrl?: string
  total: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  if (args.items.length === 0) throw new Error("Cart is empty")

  // BAO oversees the marketplace; its members cannot buy.
  const { data: isBao } = await supabase.rpc("module_access", { p_module: "bao" })
  if (isBao === true) throw new Error("BAO accounts can view the marketplace but cannot place orders.")

  // Buyers need a real, complete profile and an account in good standing to order.
  const { data: buyer } = await supabase
    .from("profiles")
    .select("full_name, contact, account_status")
    .eq("id", user.id)
    .maybeSingle()
  if (buyer?.account_status === "suspended" || buyer?.account_status === "banned") {
    throw new Error("Your account is restricted and can't place orders. Contact the Verification Admin.")
  }
  const nameError = validateFullName(buyer?.full_name)
  if (nameError) throw new Error(`Update your profile first: ${nameError}`)
  if (!buyer?.contact) throw new Error("Add your contact number in your profile before ordering.")

  const productIds = args.items.map((item) => item.id)
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, seller_id, name, price, royalty_amount, is_royalty_product, image_url, stock, badge")
    .in("id", productIds)
    .eq("status", "approved")

  if (productsError || !products || products.length !== new Set(productIds).size) {
    throw new Error("One or more products are no longer available.")
  }

  // One shop per checkout: the buyer pays one seller one amount (cart and checkout enforce this too).
  if (new Set(products.map((product) => product.seller_id)).size > 1) {
    throw new Error("Check out one shop at a time. Each shop is paid separately.")
  }

  // Pre-orders are paid upfront: GCash with an uploaded receipt, never cash on pickup.
  if (products.some((product) => product.badge === "Pre-Order")) {
    if (args.paymentMethod !== "gcash") throw new Error("Pre-orders must be paid upfront via GCash.")
    if (!args.receiptUrl) throw new Error("Upload your payment receipt to place a pre-order.")
  }

  const productById = new Map(products.map((product) => [product.id, product]))
  const orderItems = args.items.map((item) => {
    const product = productById.get(item.id)!
    if (product.stock < item.quantity && product.badge !== "Pre-Order") {
      throw new Error(`${product.name} does not have enough stock.`)
    }
    // The buyer pays the listed price. For official-logo products a royalty (like a tax) is taken
    // from the seller's earnings and goes to BAO — recorded per unit for BAO's royalty reports.
    const unitPrice = Number(product.price)
    return {
      product_id: product.id,
      seller_id: product.seller_id as string,
      quantity: item.quantity,
      unit_price: unitPrice,
      original_price: Number(product.price),
      royalty_amount: product.is_royalty_product ? Number(product.royalty_amount ?? 0) : 0,
      variant: item.variant ?? null,
      product_name: product.name,
      product_image_url: product.image_url,
      pre_order: product.badge === "Pre-Order",
    }
  })

  // One order per store: each store confirms, prepares and hands over its own items.
  const byStore = new Map<string, typeof orderItems>()
  for (const item of orderItems) byStore.set(item.seller_id, [...(byStore.get(item.seller_id) ?? []), item])

  type StoreRow = { id: string; pickup_location: string | null; pickup_notes: string | null; claim_window_days?: number | null }
  const loadStores = async (columns: string) =>
    (await supabase.from("seller_profiles").select(columns).in("id", [...byStore.keys()])) as unknown as { data: StoreRow[] | null; error: unknown }
  // claim_window_days arrives with scripts/22_preorder_pickup.sql
  let { data: stores, error: storesError } = await loadStores("id, pickup_location, pickup_notes, claim_window_days")
  if (storesError) ({ data: stores } = await loadStores("id, pickup_location, pickup_notes"))
  const storeById = new Map((stores ?? []).map((st) => [st.id, st]))

  const orderIds: string[] = []
  for (const [storeId, storeItems] of byStore) {
    const total = storeItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
    const store = storeById.get(storeId)
    // Pre-orders must be claimed within the store's claim window, counted from the order date.
    const claimDays = Math.min(60, Math.max(1, Number(store?.claim_window_days ?? 7)))
    const pickupDeadline = storeItems.some((item) => item.pre_order)
      ? new Date(Date.now() + claimDays * 86_400_000).toISOString()
      : null
    const base = {
      buyer_id: user.id,
      status: "pending",
      total,
      payment_method: args.paymentMethod,
      receipt_url: args.receiptUrl ?? null,
    }
    const pickup = { seller_id: storeId, pickup_location: store?.pickup_location ?? null, pickup_notes: store?.pickup_notes ?? null }
    // Older databases lack scripts/22 (pickup_deadline) and/or scripts/13 (pickup columns): retry with fewer columns.
    const attempts = [{ ...base, ...pickup, pickup_deadline: pickupDeadline }, { ...base, ...pickup }, base]
    let order: { id: string } | null = null
    let orderError: { message: string } | null = null
    for (const row of attempts) {
      ;({ data: order, error: orderError } = await supabase.from("orders").insert(row).select("id").single())
      if (!orderError?.message.includes("column")) break
    }
    if (orderError || !order) {
      const msg = orderError?.message ?? "Failed to create order"
      if (msg.includes("schema cache") || msg.includes("does not exist"))
        throw new Error("Database not set up yet. Run scripts/1_tables.sql in Supabase SQL Editor first.")
      throw new Error(msg)
    }

    let rows: Record<string, unknown>[] = storeItems.map(({ pre_order: _p, ...item }) => ({ ...item, order_id: order!.id }))
    let { error: itemsError } = await supabase.from("order_items").insert(rows)
    if (itemsError && /original_price|royalty_amount/.test(itemsError.message)) {
      // Older database without these columns (scripts 13 / 15 not run yet)
      rows = rows.map(({ original_price: _o, royalty_amount: _r, ...rest }) => rest)
      ;({ error: itemsError } = await supabase.from("order_items").insert(rows))
    }
    if (itemsError) throw new Error(itemsError.message)
    orderIds.push(order!.id)
  }

  return { orderIds }
}
