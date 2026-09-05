"use client"

import { useState } from "react"
import { ShoppingCart, Check } from "lucide-react"
import { useCart } from "@/lib/cart-context"
import type { CartItem } from "@/lib/cart-context"
import { cn } from "@/lib/utils"

export function AddToCartButton({ product }: { product: Omit<CartItem, "quantity"> & { quantity?: number } }) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const isSoldOut = product.badge === "Sold Out"

  function handleAdd() {
    if (isSoldOut) return
    addItem({ ...product, quantity: product.quantity ?? 1 })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <button
      onClick={handleAdd}
      disabled={isSoldOut}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
        added
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : isSoldOut
          ? "cursor-not-allowed bg-muted text-muted-foreground"
          : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
      )}
    >
      {added ? <><Check className="size-4" />Added to Cart!</> : isSoldOut ? "Sold Out" : <><ShoppingCart className="size-4" />Add to Cart</>}
    </button>
  )
}
