"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart, type CartItem } from "@/lib/cart-context"
import { cn } from "@/lib/utils"

export type BuyableProduct = {
  id: string; name: string; price: number; image_url: string | null; badge: string
  stock: number; variations: string[]; available: boolean
}

/** Buyer-only: pick a variant and go straight to checkout with just this product (needs CartProvider). */
export function ChatBuyButton({ product, sellerId, storeName, compact = false }: { product: BuyableProduct; sellerId: string; storeName: string; compact?: boolean }) {
  const router = useRouter()
  const { items, addItem, setSelected } = useCart()
  const [variant, setVariant] = useState(product.variations[0] ?? "")
  const soldOut = !product.available || product.badge === "Sold Out" || (product.badge !== "Pre-Order" && product.stock < 1)

  function checkout() {
    if (soldOut) return
    addItem({
      id: product.id, sellerId, name: product.name, seller: storeName, price: Number(product.price),
      image: product.image_url ?? "/placeholder.jpg", badge: product.badge as CartItem["badge"], quantity: 1, variant: variant || undefined,
    })
    // Check out only this product; other cart items stay in the cart, unticked
    setSelected(items.map((i) => i.id).filter((id) => id !== product.id), false)
    router.push("/marketplace/checkout")
  }

  return (
    <div className="space-y-2">
      {product.variations.length > 0 && !soldOut && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Variant">
          {product.variations.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={variant === v} onClick={() => setVariant(v)}
              className={cn("rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                variant === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40")}>
              {v}
            </button>
          ))}
        </div>
      )}
      <Button type="button" size={compact ? "sm" : "default"} onClick={checkout} disabled={soldOut} className="w-full gap-1.5">
        {soldOut ? (product.available ? "Sold Out" : "No longer available") : <><Zap className="size-3.5" />Proceed to Checkout</>}
      </Button>
    </div>
  )
}
