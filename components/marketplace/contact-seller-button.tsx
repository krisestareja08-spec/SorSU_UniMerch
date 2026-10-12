"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MessageCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { chatSetupError } from "@/lib/messages"

/** Opens the buyer's chat with this store (created on first use), like "Message Seller" on a product. */
export function ContactSellerButton({ storeId }: { storeId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/auth/login"); return }
    const { data, error: err } = await supabase.rpc("start_store_conversation", { p_store: storeId })
    if (err || !data) {
      setError(chatSetupError(err?.message ?? "Couldn't open the chat. Try again."))
      setBusy(false)
      return
    }
    router.push(`/marketplace/messages?c=${data}`)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-1.5 text-sm font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
        Contact Seller
      </button>
      {error && <p className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-destructive/30 bg-card p-2 text-xs text-destructive shadow-lg" role="alert">{error}</p>}
    </div>
  )
}
