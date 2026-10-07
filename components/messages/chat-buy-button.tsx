"use client"

import { useState } from "react"
import { Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CartItem } from "@/lib/cart-context"
import { ProductOptionsSheet } from "@/components/marketplace/product-options-sheet"

export type BuyableProduct = {
  id: string; name: string; price: number; image_url: string | null; badge: string
  stock: number; variations: string[]; available: boolean
}

/** Buyer-only: opens the size + quantity sheet and goes straight to checkout with just this product. */
export function ChatBuyButton({ product, sellerId, storeName, compact = false }: { product: BuyableProduct; sellerId: string; storeName: string; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const soldOut = !product.available || product.badge === "Sold Out" || (product.badge !== "Pre-Order" && product.stock < 1)

  return (
    <>
      <Button type="button" size={compact ? "sm" : "default"} onClick={() => setOpen(true)} disabled={soldOut} className="w-full gap-1.5">
        {soldOut ? (product.available ? "Sold Out" : "No longer available") : <><Zap className="size-3.5" />Proceed to Checkout</>}
      </Button>
      {open && (
        // Sizes, size prices and stock are loaded fresh when the sheet opens
        <ProductOptionsSheet
          product={{
            id: product.id, sellerId, name: product.name, seller: storeName, price: Number(product.price),
            image: product.image_url ?? "/placeholder.jpg", badge: product.badge as CartItem["badge"],
          }}
          mode="buy"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
