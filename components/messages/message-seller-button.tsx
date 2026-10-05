"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { chatSetupError } from "@/lib/messages"
import { cn } from "@/lib/utils"

/** Opens this buyer's conversation about the product, creating it on first use. */
export function MessageSellerButton({ productId, className }: { productId: string; className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/auth/login"); return }
    const { data, error: err } = await supabase.rpc("start_conversation", { p_product: productId })
    if (err || !data) {
      setError(chatSetupError(err?.message ?? "Couldn't open the chat. Try again."))
      setBusy(false)
      return
    }
    router.push(`/marketplace/messages?c=${data}`)
  }

  return (
    <div className={cn("space-y-1", className)}>
      <Button type="button" variant="outline" onClick={open} disabled={busy} className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
        Message Seller
      </Button>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  )
}
