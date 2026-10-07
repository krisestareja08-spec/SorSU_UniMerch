"use client"

import Image from "next/image"
import { useState } from "react"
import { Check, Package, ShoppingCart, Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCart } from "@/lib/cart-context"
import { BUY_NOW_CHECKOUT, setBuyNowItem } from "@/lib/buy-now"
import { VariantPicker, describeSelection, type PurchaseOptions, type Selection } from "@/components/marketplace/variant-picker"
import { QuantityStepper, cartLine, type SheetProduct } from "@/components/marketplace/product-options-sheet"
import { cn } from "@/lib/utils"

/**
 * Product page body: image, price, stock, SKU, size picker, quantity and Add to Cart / Buy Now.
 * Before a size is picked it shows the price range and asks for a size; once picked, everything
 * switches to that exact variant (its price, stock, SKU and image) and the buttons turn on.
 */
export function ProductPurchasePanel({
  product,
  options,
  header,
  details,
  footer,
}: {
  product: SheetProduct
  options: PurchaseOptions
  header: React.ReactNode
  details: React.ReactNode
  footer?: React.ReactNode
}) {
  const router = useRouter()
  const { addItem } = useCart()
  const [sel, setSel] = useState<Selection>({ variant: null, legacySize: null })
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState<number | null>(null)

  const d = describeSelection(product, options, sel)
  const qty = Math.min(Math.max(1, quantity), Math.max(1, d.maxQty))
  const blocked = d.soldOut || d.needsChoice
  const hasChoices = d.hasVariants || options.legacySizes.length > 0

  function add() {
    if (blocked) return
    addItem(cartLine(product, sel, d.price, qty))
    setAdded(qty)
    setTimeout(() => setAdded(null), 1800)
  }
  function buy() {
    if (blocked) return
    // Check out just this variant; the cart (and what's ticked in it) is left alone
    setBuyNowItem(cartLine(product, sel, d.price, qty))
    router.push(BUY_NOW_CHECKOUT)
  }

  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {/* Image follows the chosen variant when it has its own photo */}
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
        {d.image ? (
          <Image key={d.image} src={d.image} alt={sel.variant ? `${product.name} — ${sel.variant.name}` : product.name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 50vw" />
        ) : (
          <div className="flex h-full items-center justify-center"><Package className="size-16 text-muted-foreground/30" /></div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {header}

        <div>
          <p className="text-3xl font-bold text-gold" aria-live="polite">{d.priceLabel}</p>
          {d.needsChoice && <p className="mt-0.5 text-xs text-muted-foreground">Select a size to see its exact price and stock.</p>}
        </div>

        {details}

        {hasChoices && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
              Size {sel.variant || sel.legacySize ? <span className="text-foreground">· {sel.variant?.name ?? sel.legacySize}</span> : <span className="text-amber-700 dark:text-amber-300">· choose one</span>}
            </p>
            <VariantPicker options={options} selection={sel} preOrder={d.preOrder} onSelect={(s) => { setSel(s); setQuantity(1) }} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-live="polite">
          <span className={cn(d.soldOut ? "text-destructive" : d.needsChoice ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400")}>{d.stockLabel}</span>
          {d.sku && <span className="text-xs text-muted-foreground">SKU: <span className="font-medium text-foreground">{d.sku}</span></span>}
        </div>

        {!d.soldOut && (
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-foreground">Quantity</p>
            <QuantityStepper value={qty} max={d.maxQty} onChange={setQuantity} />
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={add} disabled={blocked}
            className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
              added ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "border border-primary/20 bg-primary/8 text-primary hover:bg-primary/15")}>
            {added ? <><Check className="size-4" />Added {added} to cart</> : d.soldOut ? "Sold Out" : d.needsChoice ? "Select a size" : <><ShoppingCart className="size-4" />Add to Cart</>}
          </button>
          <button type="button" onClick={buy} disabled={blocked}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
            <Zap className="size-4" />Buy Now
          </button>
        </div>

        {footer}
      </div>
    </div>
  )
}
