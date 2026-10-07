"use server"

import { attempt } from "@/lib/action-result"

import { assertDashboard } from "@/lib/dashboards"
import { revalidatePath } from "next/cache"

async function approveProductImpl(productId: string) {
  const { supabase } = await assertDashboard("bao", "approvals")
  const { error } = await supabase
    .from("products")
    .update({ status: "approved", bao_comment: null, updated_at: new Date().toISOString() })
    .eq("id", productId)
  if (error) throw new Error(error.message)
  revalidatePath("/bao/approvals")
}

async function rejectProductImpl(formData: FormData) {
  const productId = formData.get("product_id") as string
  const comment = formData.get("comment") as string
  const { supabase } = await assertDashboard("bao", "approvals")
  const { error } = await supabase
    .from("products")
    .update({ status: "rejected", bao_comment: comment || "Submission did not meet requirements.", updated_at: new Date().toISOString() })
    .eq("id", productId)
  if (error) throw new Error(error.message)
  revalidatePath("/bao/approvals")
}

async function sendBaoMessageImpl(formData: FormData) {
  const productId = formData.get("product_id") as string
  const message = formData.get("message") as string
  if (!message?.trim()) return
  const { supabase } = await assertDashboard("bao", "approvals")
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  await supabase.from("product_messages").insert({ product_id: productId, sender_id: user.id, message: message.trim() })
  revalidatePath("/bao/approvals")
}

// ── Exported actions: return ActionResult (lib/action-result.ts) instead of throwing ──
export async function approveProduct(...args: Parameters<typeof approveProductImpl>) {
  return attempt(() => approveProductImpl(...args))
}
export async function rejectProduct(...args: Parameters<typeof rejectProductImpl>) {
  return attempt(() => rejectProductImpl(...args))
}
export async function sendBaoMessage(...args: Parameters<typeof sendBaoMessageImpl>) {
  return attempt(() => sendBaoMessageImpl(...args))
}
