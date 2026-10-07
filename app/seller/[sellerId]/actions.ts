"use server"

import { attempt } from "@/lib/action-result"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

async function toggleFollowSellerImpl(sellerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Sign in to follow a seller.")

  const { data: existing } = await supabase
    .from("seller_follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("seller_id", sellerId)
    .maybeSingle()

  if (existing) {
    await supabase.from("seller_follows").delete().eq("id", existing.id)
  } else {
    await supabase.from("seller_follows").insert({ follower_id: user.id, seller_id: sellerId })
  }

  revalidatePath(`/seller/${sellerId}`)
}

// ── Exported actions: return ActionResult (lib/action-result.ts) instead of throwing ──
export async function toggleFollowSeller(...args: Parameters<typeof toggleFollowSellerImpl>) {
  return attempt(() => toggleFollowSellerImpl(...args))
}
