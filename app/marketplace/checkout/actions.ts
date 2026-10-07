"use server"

import { attempt } from "@/lib/action-result"

import { createClient } from "@/lib/supabase/server"
import { validateFullName } from "@/lib/profile-rules"
import { PAYMENT_METHOD_MODE, parsePaymentModes } from "@/lib/product-pricing"
import { loadVariants } from "@/lib/variants"

type OrderItem = {
  id: string
  sellerId?: string
  name: string
  seller: string
  price: number
  image: string
  quantity: number
  variant?: string
  /** The exact variant chosen (scripts/28) */
  variantId?: string
}

async function submitOrderImpl(args: {
  items: OrderItem[]
  paymentMethod: string
  receiptUrl?: string
  total: number
  /** Pre-orders: the buyer's pick-up date (YYYY-MM-DD) and their uploaded I.D. (preorder-ids bucket) */
  pickupDate?: string
  idPath?: string
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
    variations?: unknown; payment_modes?: unknown
  }
  const loadProducts = async (columns: string) =>
    (await supabase.from("products").select(columns).in("id", productIds).eq("status", "approved")) as unknown as { data: ProductRow[] | null; error: { message: string } | null }
  const baseColumns = "id, seller_id, name, price, royalty_amount, royalty_percentage, is_royalty_product, image_url, stock, badge, variations"
  // payment_modes arrives with scripts/27
  let { data: products, error: productsError } = await loadProducts(`${baseColumns}, payment_modes`)
  if (productsError && /payment_modes/.test(productsError.message)) {
    ;({ data: products, error: productsError } = await loadProducts(baseColumns))
  }

  if (productsError || !products || products.length !== new Set(productIds).size) {
    throw new Error("One or more products are no longer available.")
  }

  // One shop per checkout: the buyer pays one seller one amount (cart and checkout enforce this too).
  if (new Set(products.map((product) => product.seller_id)).size > 1) {
    throw new Error("Check out one shop at a time. Each shop is paid separately.")
  }

  // An unpaid penalty with a shop (unclaimed pre-order) blocks ordering from that shop — scripts/29
  const shopIds = [...new Set(products.map((product) => product.seller_id))]
  const { data: penalties, error: penaltyError } = await supabase.from("buyer_penalties").select("store_id, amount")
    .eq("buyer_id", user.id).in("status", ["unpaid", "pending_review"]).in("store_id", shopIds)
  if (!penaltyError && (penalties ?? []).length > 0) {
    const owed = (penalties ?? []).reduce((n, p) => n + Number(p.amount), 0)
    throw new Error(`You have an unpaid ₱${owed.toLocaleString()} penalty with this shop. Pay it from your account page to order again.`)
  }

  // Pre-orders: checked out on their own, no upfront payment (paid at the counter on pick-up),
  // the buyer's I.D. for the shop to check, and a pick-up date within the shop's 3–7 day window.
  const isPreOrder = products.some((product) => product.badge === "Pre-Order")
  let preOrder: { pickupDate: string; idPath: string } | null = null
  if (isPreOrder) {
    if (products.some((product) => product.badge !== "Pre-Order")) throw new Error("Check out pre-order items on their own.")
    const store = shopIds[0]
    const { data: shop } = await supabase.from("seller_profiles").select("claim_window_days").eq("id", store).maybeSingle()
    const windowDays = Math.min(7, Math.max(3, Number(shop?.claim_window_days ?? 7)))
    // Dates in Philippine time
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
    const date = (args.pickupDate ?? "").trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < day(1) || date > day(windowDays)) {
      throw new Error(`Choose a pick-up date from tomorrow up to ${windowDays} days from today.`)
    }
    const idPath = (args.idPath ?? "").trim()
    if (!idPath.startsWith(`${store}/${user.id}/`)) throw new Error("Upload a photo of your I.D. so the shop can check it.")
    preOrder = { pickupDate: date, idPath }
  } else {
    // Each product allows walk-in payment, online payment or both; the chosen method must suit every item.
    const mode = PAYMENT_METHOD_MODE[args.paymentMethod]
    if (!mode) throw new Error("Choose a payment method.")
    const notAllowed = products.find((product) => !parsePaymentModes(product.payment_modes).includes(mode))
    if (notAllowed) {
      throw new Error(`${notAllowed.name} can only be paid ${mode === "online" ? "at the store (walk-in)" : "online"}.`)
    }
  }

  const productById = new Map(products.map((product) => [product.id, product]))
  // Each size is its own variant with its own price and stock (scripts/28; null before that script)
  const variantsByProduct = await loadVariants(supabase, productIds)
  // Stock is checked per variant (or per product when it has none): add up repeated lines first
  const wanted = new Map<string, number>()
  const resolved = args.items.map((item) => {
    const product = productById.get(item.id)!
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error(`Choose a quantity for ${product.name}.`)
    const variants = variantsByProduct?.get(product.id) ?? []
    // Older carts may only carry the size name
    const variant = variants.length
      ? variants.find((v) => v.id === item.variantId) ?? variants.find((v) => !item.variantId && v.name === item.variant)
      : undefined
    if (variants.length && !variant) throw new Error(`Choose a size for ${product.name}. The size you picked may no longer be available.`)
    const legacySizes = !variants.length && Array.isArray(product.variations) ? (product.variations as string[]) : []
    if (legacySizes.length && (!item.variant || !legacySizes.includes(item.variant))) throw new Error(`Choose a size for ${product.name}.`)
    const key = variant?.id ?? product.id
    wanted.set(key, (wanted.get(key) ?? 0) + item.quantity)
    return { item, product, variant }
  })
  const orderItems = resolved.map(({ item, product, variant }) => {
    const available = variant ? variant.stock : product.stock
    if (product.badge !== "Pre-Order" && available < (wanted.get(variant?.id ?? product.id) ?? 0)) {
      throw new Error(`${product.name}${variant ? ` (${variant.name})` : ""} does not have enough stock.`)
    }
    // The buyer pays the price of the exact variant chosen. For official-logo products a royalty (like a
    // tax) is taken from the seller's earnings and goes to BAO — recorded per unit, from the price paid.
    const linePrice = variant ? variant.price : Number(product.price)
    const royalty = !product.is_royalty_product ? 0
      : product.royalty_percentage != null
        ? Math.round(linePrice * (Number(product.royalty_percentage) / 100) * 100) / 100
        : Number(product.royalty_amount ?? 0)
    return {
      product_id: product.id,
      seller_id: product.seller_id as string,
      quantity: item.quantity,
      unit_price: linePrice,
      original_price: linePrice,
      royalty_amount: royalty,
      variant: variant?.name ?? item.variant ?? null,
      ...(variant ? { variant_id: variant.id } : {}),
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
    const base = {
      buyer_id: user.id,
      status: "pending",
      total,
      // Pre-orders are paid in cash at the counter on pick-up
      payment_method: preOrder ? "cash" : args.paymentMethod,
      receipt_url: preOrder ? null : args.receiptUrl ?? null,
    }
    const pickup = { seller_id: storeId, pickup_location: store?.pickup_location ?? null, pickup_notes: store?.pickup_notes ?? null }
    // Pre-order: picked up by the end of the chosen date (Philippine time); the shop checks the I.D. first
    const attempts = preOrder
      ? [{ ...base, ...pickup, pickup_date: preOrder.pickupDate, pickup_deadline: `${preOrder.pickupDate}T23:59:59+08:00`, buyer_id_path: preOrder.idPath, id_status: "pending" }]
      // Older databases lack scripts/13 (pickup columns): retry with fewer columns.
      : [{ ...base, ...pickup }, base]
    let order: { id: string } | null = null
    let orderError: { message: string } | null = null
    for (const row of attempts) {
      ;({ data: order, error: orderError } = await supabase.from("orders").insert(row).select("id").single())
      if (!orderError?.message.includes("column")) break
    }
    if (orderError || !order) {
      if (preOrder && orderError?.message.includes("column")) {
        throw new Error("Pre-orders need scripts/29_preorder_id_penalties.sql. Ask the admin to run it in Supabase.")
      }
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
