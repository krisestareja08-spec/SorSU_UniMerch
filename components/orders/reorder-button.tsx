"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useCart, type CartItem } from "@/lib/cart-context"
import { cn } from "@/lib/utils"

type ReorderItem = { productId: string | null; variant: string | null; quantity: number }

/** Puts a past order's items back in the cart at today's price, skipping anything no longer sold. */
export function ReorderButton({ items, storeName, className }: { items: ReorderItem[]; storeName: string; className?: string }) {
  const router = useRouter()
  const { addItem, setSelected, items: cartItems } = useCart()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function reorder() {
    setBusy(true)
    setNote(null)
    const ids = [...new Set(items.map((i) => i.productId).filter((id): id is string => !!id))]
    const { data } = ids.length
      ? await createClient().from("products").select("id, seller_id, name, price, image_url, badge, stock").in("id", ids).eq("status", "approved")
      : { data: [] }
    const byId = new Map((data ?? []).map((p) => [p.id, p]))

    let skipped = 0
    const added: string[] = []
    for (const item of items) {
      const p = item.productId ? byId.get(item.productId) : undefined
      if (!p || p.badge === "Sold Out" || (p.badge !== "Pre-Order" && p.stock < 1)) { skipped++; continue }
      const quantity = p.badge === "Pre-Order" ? item.quantity : Math.min(item.quantity, p.stock)
      addItem({
        id: p.id, sellerId: p.seller_id, name: p.name, seller: storeName, price: Number(p.price),
        image: p.image_url ?? "/placeholder.jpg", badge: p.badge as CartItem["badge"], quantity, variant: item.variant ?? undefined,
      })
      added.push(p.id)
    }
    setBusy(false)

    if (added.length === 0) {
      setNote("These items are no longer available.")
      return
    }
    // Check out just the reordered items
    setSelected(cartItems.map((i) => i.id).filter((id) => !added.includes(id)), false)
    router.push(skipped ? `/marketplace/cart?reorder_skipped=${skipped}` : "/marketplace/cart")
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button type="button" variant="outline" size="sm" onClick={reorder} disabled={busy} className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
        Reorder
      </Button>
      {note && <p className="text-xs text-destructive">{note}</p>}
    </div>
  )
}
