"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart, Check, Zap } from "lucide-react"
import { useCart } from "@/lib/cart-context"
import type { CartItem } from "@/lib/cart-context"
import { cn } from "@/lib/utils"

export function ProductVariantActions({
  product,
  variations,
}: {
  product: Omit<CartItem, "quantity" | "variant">
  variations: string[]
}) {
  const router = useRouter()
  const { addItem } = useCart()
  const [variant, setVariant] = useState(variations[0] ?? "")
  const [added, setAdded] = useState(false)
  const isSoldOut = product.badge === "Sold Out"
  const needsVariant = variations.length > 0 && !variant

  function handleAdd() {
    if (isSoldOut || needsVariant) return
    addItem({ ...product, quantity: 1, variant: variant || undefined })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  function handleBuyNow() {
    if (isSoldOut || needsVariant) return
    addItem({ ...product, quantity: 1, variant: variant || undefined })
    router.push("/marketplace/checkout")
  }

  return (
    <div className="flex flex-col gap-3">
      {variations.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Select Variant</p>
          <div className="flex flex-wrap gap-2">
            {variations.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  variant === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={isSoldOut || needsVariant}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
            added
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : isSoldOut || needsVariant
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : "border border-primary/20 bg-primary/8 text-primary hover:bg-primary/15 active:scale-[0.98]",
          )}
        >
          {added ? <><Check className="size-4" />Added!</> : isSoldOut ? "Sold Out" : <><ShoppingCart className="size-4" />Add to Cart</>}
        </button>
        <button
          onClick={handleBuyNow}
          disabled={isSoldOut || needsVariant}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]",
            isSoldOut || needsVariant ? "cursor-not-allowed bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          <Zap className="size-4" /> Buy Now
        </button>
      </div>
      {needsVariant && <p className="text-xs text-destructive">Please select a variant before continuing.</p>}
    </div>
  )
}
