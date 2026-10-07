"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Loader2, Minus, Plus, ShoppingCart, X, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useCart, type CartItem } from "@/lib/cart-context"
import { BUY_NOW_CHECKOUT, setBuyNowItem } from "@/lib/buy-now"
import { parseVariantPrices, unitPrice, type VariantPrices } from "@/lib/product-pricing"
import { cn } from "@/lib/utils"

export type SheetProduct = {
  id: string
  name: string
  seller: string
  sellerId?: string
  image: string
  badge: CartItem["badge"]
  /** Base price (the lowest when sizes are priced differently) */
  price: number
  /** Leave the next three out to load them when the sheet opens (e.g. from a product card) */
  stock?: number
  variations?: string[]
  variantPrices?: VariantPrices
}

type Options = { stock: number; variations: string[]; variantPrices: VariantPrices }

/** The product's sizes, size prices and stock, loaded on demand (variant_prices arrives with scripts/27). */
async function loadOptions(id: string): Promise<Options | null> {
  const supabase = createClient()
  type Row = { stock: number | null; variations: unknown; variant_prices?: unknown }
  const load = async (columns: string) =>
    (await supabase.from("products").select(columns).eq("id", id).maybeSingle()) as unknown as { data: Row | null; error: unknown }
  let { data, error } = await load("stock, variations, variant_prices")
  if (error) ({ data } = await load("stock, variations"))
  if (!data) return null
  return {
    stock: Number(data.stock ?? 0),
    variations: Array.isArray(data.variations) ? data.variations.filter((v): v is string => typeof v === "string") : [],
    variantPrices: parseVariantPrices(data.variant_prices),
  }
}

/**
 * Shopee-style "Add to Cart" / "Buy Now" sheet: pick a size (the price follows it), set the
 * quantity, then confirm. A bottom sheet on phones, a dialog on larger screens.
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
  const given = product.variations !== undefined
  const [options, setOptions] = useState<Options | null>(
    given ? { stock: product.stock ?? 0, variations: product.variations ?? [], variantPrices: product.variantPrices ?? {} } : null,
  )
  const [failed, setFailed] = useState(false)
  const [variant, setVariant] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (given) return
    let cancelled = false
    loadOptions(product.id).then((o) => {
      if (cancelled) return
      if (o) setOptions(o)
      else setFailed(true)
    })
    return () => { cancelled = true }
  }, [given, product.id])

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

  const preOrder = product.badge === "Pre-Order"
  const stock = options?.stock ?? 0
  // Pre-orders aren't limited by stock on hand
  const maxQty = preOrder ? 99 : Math.max(0, stock)
  const soldOut = product.badge === "Sold Out" || (!preOrder && options !== null && stock < 1)
  const needsVariant = !!options && options.variations.length > 0 && !variant
  const price = unitPrice(product.price, options?.variantPrices ?? {}, variant)
  const qty = Math.min(Math.max(1, quantity), Math.max(1, maxQty))

  function confirm() {
    if (!options || soldOut || needsVariant) return
    const item: CartItem = {
      id: product.id, sellerId: product.sellerId, name: product.name, seller: product.seller,
      price, image: product.image, badge: product.badge, quantity: qty, variant: variant ?? undefined,
    }
    if (mode === "buy") {
      // Check out just this product; the cart (and what's ticked in it) is left alone
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

        {/* Product, live price, stock */}
        <div className="flex gap-3 pr-8">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
            <Image src={product.image || "/placeholder.jpg"} alt={product.name} fill className="object-cover" sizes="80px" />
          </div>
          <div className="flex min-w-0 flex-col justify-end">
            <p className="line-clamp-2 text-sm font-medium text-foreground">{product.name}</p>
            <p className="mt-1 text-xl font-bold text-gold">₱{price.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {!options ? "Loading…" : preOrder ? "Pre-order" : soldOut ? "Out of stock" : `${stock} in stock`}
              {variant && <> · {variant}</>}
            </p>
          </div>
        </div>

        {failed && <p className="mt-4 text-sm text-destructive">This product is no longer available.</p>}
        {!options && !failed && <Loader2 className="mx-auto my-6 size-6 animate-spin text-primary" />}

        {options && (
          <>
            {/* Sizes / variants */}
            {options.variations.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Size / Variant</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size or variant">
                  {options.variations.map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={variant === v} onClick={() => setVariant(v)}
                      className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        variant === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:border-primary/40")}>
                      {v}
                      {options.variantPrices[v] != null && <span className="ml-1 text-muted-foreground">₱{options.variantPrices[v].toLocaleString()}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <p className="text-sm font-medium text-foreground">Quantity</p>
              <div className="flex items-center rounded-full border border-border">
                <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQuantity(qty - 1)}
                  className="flex size-9 items-center justify-center rounded-l-full text-primary hover:bg-muted disabled:opacity-40">
                  <Minus className="size-4" />
                </button>
                <input type="number" inputMode="numeric" min={1} max={maxQty || 1} value={qty} aria-label="Quantity"
                  onChange={(e) => setQuantity(Number.parseInt(e.target.value, 10) || 1)}
                  className="h-9 w-12 border-x border-border bg-transparent text-center text-sm font-semibold [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none" />
                <button type="button" aria-label="Increase quantity" disabled={qty >= maxQty} onClick={() => setQuantity(qty + 1)}
                  className="flex size-9 items-center justify-center rounded-r-full text-primary hover:bg-muted disabled:opacity-40">
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            <button type="button" onClick={confirm} disabled={soldOut || needsVariant}
              className={cn("mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
                mode === "buy" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-gold text-primary hover:bg-gold/85")}>
              {mode === "buy" ? <Zap className="size-4" /> : <ShoppingCart className="size-4" />}
              {soldOut ? "Out of stock" : needsVariant ? "Select a size" : mode === "buy" ? `Buy Now · ₱${(price * qty).toLocaleString()}` : `Add to Cart · ₱${(price * qty).toLocaleString()}`}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
