"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Loader2, Minus, Plus, ShoppingCart, X, Zap } from "lucide-react"
import { useCart, type CartItem } from "@/lib/cart-context"
import { BUY_NOW_CHECKOUT, setBuyNowItem } from "@/lib/buy-now"
import { VariantPicker, describeSelection, usePurchaseOptions, type PurchaseOptions, type Selection } from "@/components/marketplace/variant-picker"
import { cn } from "@/lib/utils"

export type SheetProduct = {
  id: string
  name: string
  seller: string
  sellerId?: string
  image: string
  badge: CartItem["badge"]
  /** Lowest price (products.price) and highest (products.price_max) */
  price: number
  priceMax?: number | null
  /** Leave out to load the sizes when the sheet opens (e.g. from a product card) */
  options?: PurchaseOptions
}

/** Shared "add this exact variant" line for the cart or Buy Now. */
export function cartLine(product: SheetProduct, sel: Selection, price: number, quantity: number): CartItem {
  return {
    id: product.id, sellerId: product.sellerId, name: product.name, seller: product.seller,
    price, image: sel.variant?.imageUrl || product.image, badge: product.badge, quantity,
    variant: sel.variant?.name ?? sel.legacySize ?? undefined,
    variantId: sel.variant?.id, sku: sel.variant?.sku ?? undefined,
  }
}

/** − quantity + (typed or tapped), limited to the selected variant's stock. */
export function QuantityStepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center rounded-full border border-border">
      <button type="button" aria-label="Decrease quantity" disabled={value <= 1} onClick={() => onChange(value - 1)}
        className="flex size-9 items-center justify-center rounded-l-full text-primary hover:bg-muted disabled:opacity-40">
        <Minus className="size-4" />
      </button>
      <input type="number" inputMode="numeric" min={1} max={max || 1} value={value} aria-label="Quantity"
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 1)}
        className="h-9 w-12 border-x border-border bg-transparent text-center text-sm font-semibold [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none" />
      <button type="button" aria-label="Increase quantity" disabled={value >= max} onClick={() => onChange(value + 1)}
        className="flex size-9 items-center justify-center rounded-r-full text-primary hover:bg-muted disabled:opacity-40">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

/**
 * Shopee-style "Add to Cart" / "Buy Now" sheet: shows the price range until a size is picked, then
 * that size's exact price, stock, SKU and image; set the quantity and confirm. Adds the exact
 * variant. A bottom sheet on phones, a dialog on larger screens.
 */
export function ProductOptionsSheet({
  product,
  mode,
  onClose,
  onAdded,
}: {
  product: SheetProduct
  mode: "cart" | "buy"
  onClose: () => void
  onAdded?: (quantity: number) => void
}) {
  const router = useRouter()
  const { addItem } = useCart()
  const { options, failed } = usePurchaseOptions(product.id, product.options)
  const [sel, setSel] = useState<Selection>({ variant: null, legacySize: null })
  const [quantity, setQuantity] = useState(1)

  // Escape closes; the page behind doesn't scroll while the sheet is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const d = describeSelection(product, options, sel)
  const qty = Math.min(Math.max(1, quantity), Math.max(1, d.maxQty))
  const blocked = !options || d.soldOut || d.needsChoice

  function confirm() {
    if (blocked) return
    const item = cartLine(product, sel, d.price, qty)
    if (mode === "buy") {
      // Check out just this variant; the cart (and what's ticked in it) is left alone
      setBuyNowItem(item)
      router.push(BUY_NOW_CHECKOUT)
      return
    }
    addItem(item)
    onAdded?.(qty)
    onClose()
  }

  // Portal: product cards are links with a hover transform, which would trap a fixed overlay inside them.
  // stopPropagation: React events still bubble to the card's link, which would navigate away.
  return createPortal(
    <div onClick={(e) => e.stopPropagation()} className="fixed inset-0 z-70 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={mode === "buy" ? "Buy now" : "Add to cart"}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-md rounded-t-2xl border border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-muted">
          <X className="size-5" />
        </button>

        {/* Selected variant: image, exact price (or range), stock, SKU */}
        <div className="flex gap-3 pr-8">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
            <Image src={d.image || "/placeholder.jpg"} alt={product.name} fill className="object-cover" sizes="80px" />
          </div>
          <div className="flex min-w-0 flex-col justify-end">
            <p className="line-clamp-2 text-sm font-medium text-foreground">{product.name}</p>
            <p className="mt-1 text-xl font-bold text-gold">{d.priceLabel}</p>
            <p className="text-xs text-muted-foreground">{d.stockLabel}{d.sku && <> · SKU {d.sku}</>}</p>
          </div>
        </div>

        {failed && <p className="mt-4 text-sm text-destructive">This product is no longer available.</p>}
        {!options && !failed && <Loader2 className="mx-auto my-6 size-6 animate-spin text-primary" />}

        {options && (
          <>
            {(d.hasVariants || options.legacySizes.length > 0) && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  Size {sel.variant || sel.legacySize ? <span className="text-foreground">· {sel.variant?.name ?? sel.legacySize}</span> : <span className="text-amber-700 dark:text-amber-300">· choose one</span>}
                </p>
                <VariantPicker options={options} selection={sel} preOrder={d.preOrder} onSelect={(s) => { setSel(s); setQuantity(1) }} />
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <p className="text-sm font-medium text-foreground">Quantity</p>
              <QuantityStepper value={qty} max={d.maxQty} onChange={setQuantity} />
            </div>

            <button type="button" onClick={confirm} disabled={blocked}
              className={cn("mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
                mode === "buy" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-gold text-primary hover:bg-gold/85")}>
              {mode === "buy" ? <Zap className="size-4" /> : <ShoppingCart className="size-4" />}
              {d.soldOut ? "Out of stock" : d.needsChoice ? "Select a size"
                : `${mode === "buy" ? "Buy Now" : "Add to Cart"} · ₱${(d.price * qty).toLocaleString()}`}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
