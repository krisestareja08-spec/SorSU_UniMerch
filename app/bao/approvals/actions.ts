"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function approveProduct(productId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("products")
    .update({ status: "approved", bao_comment: null, updated_at: new Date().toISOString() })
    .eq("id", productId)
  if (error) throw new Error(error.message)
  revalidatePath("/bao/approvals")
}

export async function rejectProduct(formData: FormData) {
  const productId = formData.get("product_id") as string
  const comment = formData.get("comment") as string
  const supabase = await createClient()
  const { error } = await supabase
    .from("products")
    .update({ status: "rejected", bao_comment: comment || "Submission did not meet requirements.", updated_at: new Date().toISOString() })
    .eq("id", productId)
  if (error) throw new Error(error.message)
  revalidatePath("/bao/approvals")
}

export async function sendBaoMessage(formData: FormData) {
  const productId = formData.get("product_id") as string
  const message = formData.get("message") as string
  if (!message?.trim()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  await supabase.from("product_messages").insert({ product_id: productId, sender_id: user.id, message: message.trim() })
  revalidatePath("/bao/approvals")
}
