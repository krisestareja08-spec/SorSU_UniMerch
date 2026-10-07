"use client"

import { useState } from "react"
import { ShoppingCart, Check, Zap } from "lucide-react"
import type { CartItem } from "@/lib/cart-context"
import type { VariantPrices } from "@/lib/product-pricing"
import { ProductOptionsSheet } from "@/components/marketplace/product-options-sheet"
import { cn } from "@/lib/utils"

/** Product page: Add to Cart / Buy Now open the size + quantity sheet. */
export function ProductVariantActions({
  product,
  variations,
  variantPrices = {},
  stock,
}: {
  product: Omit<CartItem, "quantity" | "variant">
  variations: string[]
  variantPrices?: VariantPrices
  stock: number
}) {
  const [sheet, setSheet] = useState<"cart" | "buy" | null>(null)
  const [added, setAdded] = useState<number | null>(null)
  const isSoldOut = product.badge === "Sold Out" || (product.badge !== "Pre-Order" && stock < 1)

  function showAdded(qty: number) {
    setAdded(qty)
    setTimeout(() => setAdded(null), 1800)
  }

  return (
    <div className="flex flex-col gap-3">
      {variations.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Sizes / Variants</p>
          <div className="flex flex-wrap gap-1.5">
            {variations.map((v) => (
              <span key={v} className="rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
                {v}{variantPrices[v] != null && <> · ₱{variantPrices[v].toLocaleString()}</>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setSheet("cart")}
          disabled={isSoldOut}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
            added
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : isSoldOut
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : "border border-primary/20 bg-primary/8 text-primary hover:bg-primary/15 active:scale-[0.98]",
          )}
        >
          {added ? <><Check className="size-4" />Added {added} to cart</> : isSoldOut ? "Sold Out" : <><ShoppingCart className="size-4" />Add to Cart</>}
        </button>
        <button
          onClick={() => setSheet("buy")}
          disabled={isSoldOut}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]",
            isSoldOut ? "cursor-not-allowed bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          <Zap className="size-4" /> Buy Now
        </button>
      </div>

      {sheet && (
        <ProductOptionsSheet
          product={{ ...product, stock, variations, variantPrices }}
          mode={sheet}
          onClose={() => setSheet(null)}
          onAdded={showAdded}
        />
      )}
    </div>
  )
}
