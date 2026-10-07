"use server"

import { attempt } from "@/lib/action-result"

import { createClient } from "@/lib/supabase/server"
import { validateFullName } from "@/lib/profile-rules"
import { PAYMENT_METHOD_MODE, parsePaymentModes, parseVariantPrices, unitPrice } from "@/lib/product-pricing"

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

async function submitOrderImpl(args: {
  items: OrderItem[]
  paymentMethod: string
  receiptUrl?: string
  total: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  if (args.items.length === 0) throw new Error("Cart is empty")

  // Only plain user accounts buy. Dashboard accounts (Verification Admin, BAO, Supply Office,
  // Cashier, Seller) manage and sell; they cannot place orders.
  const { count: dashboards } = await supabase.from("dashboard_members").select("dashboard_id", { count: "exact", head: true }).eq("user_id", user.id)
  if ((dashboards ?? 0) > 0) throw new Error("Dashboard accounts can't place orders. Use a regular user account to buy.")

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
  type ProductRow = {
    id: string; seller_id: string; name: string; price: number; royalty_amount: number | null; royalty_percentage?: number | null
    is_royalty_product: boolean; image_url: string | null; stock: number; badge: string
    variations?: unknown; variant_prices?: unknown; payment_modes?: unknown
  }
  const loadProducts = async (columns: string) =>
    (await supabase.from("products").select(columns).in("id", productIds).eq("status", "approved")) as unknown as { data: ProductRow[] | null; error: { message: string } | null }
  const baseColumns = "id, seller_id, name, price, royalty_amount, royalty_percentage, is_royalty_product, image_url, stock, badge, variations"
  // variant_prices / payment_modes arrive with scripts/27
  let { data: products, error: productsError } = await loadProducts(`${baseColumns}, variant_prices, payment_modes`)
  if (productsError && /variant_prices|payment_modes/.test(productsError.message)) {
    ;({ data: products, error: productsError } = await loadProducts(baseColumns))
  }

  if (productsError || !products || products.length !== new Set(productIds).size) {
    throw new Error("One or more products are no longer available.")
  }

  // One shop per checkout: the buyer pays one seller one amount (cart and checkout enforce this too).
  if (new Set(products.map((product) => product.seller_id)).size > 1) {
    throw new Error("Check out one shop at a time. Each shop is paid separately.")
  }

  // Each product allows walk-in payment, online payment or both; the chosen method must suit every item.
  const mode = PAYMENT_METHOD_MODE[args.paymentMethod]
  if (!mode) throw new Error("Choose a payment method.")
  const notAllowed = products.find((product) => !parsePaymentModes(product.payment_modes).includes(mode))
  if (notAllowed) {
    throw new Error(`${notAllowed.name} can only be paid ${mode === "online" ? "at the store (walk-in)" : "online"}.`)
  }

  // Pre-orders are paid upfront: GCash with an uploaded receipt, never cash on pickup.
  if (products.some((product) => product.badge === "Pre-Order")) {
    if (args.paymentMethod !== "gcash") throw new Error("Pre-orders must be paid upfront via GCash.")
    if (!args.receiptUrl) throw new Error("Upload your payment receipt to place a pre-order.")
  }

  const productById = new Map(products.map((product) => [product.id, product]))
  // Stock is per product, so add up every size of the same product in this order
  const wanted = new Map<string, number>()
  for (const item of args.items) wanted.set(item.id, (wanted.get(item.id) ?? 0) + item.quantity)
  const orderItems = args.items.map((item) => {
    const product = productById.get(item.id)!
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error(`Choose a quantity for ${product.name}.`)
    if (product.stock < (wanted.get(item.id) ?? 0) && product.badge !== "Pre-Order") {
      throw new Error(`${product.name} does not have enough stock.`)
    }
    const variations = Array.isArray(product.variations) ? (product.variations as string[]) : []
    if (variations.length > 0 && (!item.variant || !variations.includes(item.variant))) {
      throw new Error(`Choose a size for ${product.name}.`)
    }
    // The buyer pays the listed price of the chosen size (sizes without their own price use the base
    // price). For official-logo products a royalty (like a tax) is taken from the seller's earnings and
    // goes to BAO — recorded per unit for BAO's royalty reports, from the price actually paid.
    const variantPrices = parseVariantPrices(product.variant_prices)
    const linePrice = unitPrice(Number(product.price), variantPrices, item.variant)
    const royalty = !product.is_royalty_product ? 0
      : item.variant && variantPrices[item.variant] != null && product.royalty_percentage != null
        ? Math.round(linePrice * (Number(product.royalty_percentage) / 100) * 100) / 100
        : Number(product.royalty_amount ?? 0)
    return {
      product_id: product.id,
      seller_id: product.seller_id as string,
      quantity: item.quantity,
      unit_price: linePrice,
      original_price: linePrice,
      royalty_amount: royalty,
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

// ── Exported actions: return ActionResult (lib/action-result.ts) instead of throwing ──
export async function submitOrder(...args: Parameters<typeof submitOrderImpl>) {
  return attempt(() => submitOrderImpl(...args))
}
