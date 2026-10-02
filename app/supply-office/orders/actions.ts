"use server"

import { assertDashboard } from "@/lib/dashboards"
import { revalidatePath } from "next/cache"

export async function updateOrderStatus(formData: FormData) {
  const orderId = formData.get("order_id") as string
  const status = formData.get("status") as "pending" | "processing" | "completed" | "cancelled"
  const allowed = ["pending", "paid", "partially_paid", "ready_for_pickup", "completed", "cancelled"]
  if (!orderId || !allowed.includes(status)) throw new Error("Invalid order update")

  // Database rules only let members with the Orders permission of a store in this order update it.
  const { supabase } = await assertDashboard("supply_office", "orders")

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)

  if (error) throw new Error(error.message)
  revalidatePath("/supply-office/orders")
  revalidatePath("/marketplace/orders")
}
