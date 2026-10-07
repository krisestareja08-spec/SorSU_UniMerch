"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { CartItem } from "@/lib/cart-context"
import { loadVariants, type Variant } from "@/lib/variants"
import { cn } from "@/lib/utils"

/**
 * What the buyer can choose for one product. With variants (scripts/28) each size has its own
 * price, stock, SKU and image; without, it's the product's single price and stock (legacy sizes
 * are names only).
 */
export type PurchaseOptions = {
  variants: Variant[]
  /** Size names from before variants existed (single price/stock) */
  legacySizes: string[]
  stock: number
}

/** Loads a product's variants, falling back to its legacy sizes and stock. */
export async function loadPurchaseOptions(productId: string): Promise<PurchaseOptions | null> {
  const supabase = createClient()
  const { data } = await supabase.from("products").select("stock, variations").eq("id", productId).maybeSingle()
  if (!data) return null
  const map = await loadVariants(supabase, [productId])
  const legacy = Array.isArray(data.variations) ? data.variations.filter((v: unknown): v is string => typeof v === "string") : []
  return { variants: map?.get(productId) ?? [], legacySizes: map?.get(productId)?.length ? [] : legacy, stock: Number(data.stock ?? 0) }
}

export function usePurchaseOptions(productId: string, given?: PurchaseOptions) {
  const [options, setOptions] = useState<PurchaseOptions | null>(given ?? null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (given) return
    let cancelled = false
    loadPurchaseOptions(productId).then((o) => {
      if (cancelled) return
      if (o) setOptions(o)
      else setFailed(true)
    })
    return () => { cancelled = true }
  }, [given, productId])
  return { options, failed }
}

/** The buyer's current choice: a variant (by id) or a legacy size name. */
export type Selection = { variant: Variant | null; legacySize: string | null }

/** Everything the page shows for the current choice — price, stock, SKU, image, availability. */
export function describeSelection(
  base: { price: number; priceMax?: number | null; image: string; badge: CartItem["badge"] },
  options: PurchaseOptions | null,
  sel: Selection,
) {
  const preOrder = base.badge === "Pre-Order"
  const hasVariants = !!options?.variants.length
  const needsChoice = !!options && (hasVariants ? !sel.variant : options.legacySizes.length > 0 && !sel.legacySize)
  const prices = hasVariants ? options!.variants.map((v) => v.price) : [base.price, Number(base.priceMax ?? base.price)]
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const price = sel.variant ? sel.variant.price : min
  const stock = sel.variant ? sel.variant.stock : options?.stock ?? 0
  const maxQty = preOrder ? 99 : Math.max(0, stock)
  const soldOut = base.badge === "Sold Out" || (!preOrder && !!options && (sel.variant ? sel.variant.stock < 1 : hasVariants ? options.variants.every((v) => v.stock < 1) : stock < 1))
  return {
    hasVariants, needsChoice, preOrder, soldOut, maxQty, price,
    /** Before a size is chosen: the range; after: the exact price */
    priceLabel: sel.variant || min === max ? `₱${price.toLocaleString()}` : `₱${min.toLocaleString()} – ₱${max.toLocaleString()}`,
    stockLabel: !options ? "Loading…" : preOrder ? "Pre-order" : needsChoice ? `${hasVariants ? options.variants.reduce((n, v) => n + v.stock, 0) : stock} in stock across sizes` : soldOut ? "Out of stock" : `${stock} in stock`,
    sku: sel.variant?.sku ?? null,
    image: sel.variant?.imageUrl || base.image,
  }
}

/** Size buttons; sold-out sizes are shown but can't be picked (pre-orders aren't limited by stock). */
export function VariantPicker({
  options,
  selection,
  onSelect,
  preOrder,
}: {
  options: PurchaseOptions
  selection: Selection
  onSelect: (sel: Selection) => void
  preOrder: boolean
}) {
  const chip = (key: string, label: string, active: boolean, disabled: boolean, onClick: () => void) => (
    <button key={key} type="button" role="radio" aria-checked={active} disabled={disabled} onClick={onClick}
      className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:border-primary/40",
        disabled && "cursor-not-allowed border-dashed text-muted-foreground line-through opacity-60 hover:border-border")}>
      {label}
    </button>
  )
  if (options.variants.length) {
    return (
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
        {options.variants.map((v) => chip(v.id, v.name, selection.variant?.id === v.id, !preOrder && v.stock < 1,
          () => onSelect({ variant: v, legacySize: null })))}
      </div>
    )
  }
  if (options.legacySizes.length) {
    return (
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
        {options.legacySizes.map((s) => chip(s, s, selection.legacySize === s, false, () => onSelect({ variant: null, legacySize: s })))}
      </div>
    )
  }
  return null
}
