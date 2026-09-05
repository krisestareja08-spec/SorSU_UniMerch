"use server"

import { createClient } from "@/lib/supabase/server"

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

  const productIds = args.items.map((item) => item.id)
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, seller_id, name, price, image_url, stock, badge")
    .in("id", productIds)
    .eq("status", "approved")

  if (productsError || !products || products.length !== args.items.length) {
    throw new Error("One or more products are no longer available.")
  }

  const productById = new Map(products.map((product) => [product.id, product]))
  const orderItems = args.items.map((item) => {
    const product = productById.get(item.id)!
    if (product.stock < item.quantity && product.badge !== "Pre-Order") {
      throw new Error(`${product.name} does not have enough stock.`)
    }
    return {
      product_id: product.id,
      seller_id: product.seller_id,
      quantity: item.quantity,
      unit_price: product.price,
      variant: item.variant ?? null,
      product_name: product.name,
      product_image_url: product.image_url,
    }
  })
  const total = orderItems.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0)

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      buyer_id: user.id,
      status: "pending",
      total,
      payment_method: args.paymentMethod,
      receipt_url: args.receiptUrl ?? null,
    })
    .select("id")
    .single()

  if (orderError || !order) {
    const msg = orderError?.message ?? "Failed to create order"
    if (msg.includes("schema cache") || msg.includes("does not exist"))
      throw new Error("Database not set up yet. Run scripts/1_tables.sql in Supabase SQL Editor first.")
    throw new Error(msg)
  }

  const rows = orderItems.map((item) => ({ ...item, order_id: order.id }))

  const { error: itemsError } = await supabase.from("order_items").insert(rows)
  if (itemsError) throw new Error(itemsError.message)

  return { orderId: order.id }
}
