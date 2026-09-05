"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateOrderStatus(formData: FormData) {
  const orderId = formData.get("order_id") as string
  const status = formData.get("status") as "pending" | "processing" | "completed" | "cancelled"
  const allowed = ["pending", "paid", "partially_paid", "ready_for_pickup", "completed", "cancelled"]
  if (!orderId || !allowed.includes(status)) throw new Error("Invalid order update")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)

  if (error) throw new Error(error.message)
  revalidatePath("/seller/orders")
  revalidatePath("/marketplace/orders")
}
