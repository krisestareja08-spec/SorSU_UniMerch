"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ShoppingCart, Zap, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCart } from "@/lib/cart-context"
import { RatingSummary } from "@/components/reviews/stars"

export type ProductBadge = "Available" | "Pre-Order" | "Interest Check" | "Sold Out"

export type Product = {
  id: string
  name: string
  price: number
  seller: string
  sellerId?: string
  image: string
  badge: ProductBadge
  rating?: number
  ratingCount?: number
  sold?: number
  stock?: number
}

const BADGE_STYLES: Record<ProductBadge, string> = {
  "Available":      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
  "Pre-Order":      "bg-gold/15 text-amber-700 border border-gold/30 dark:text-gold",
  "Interest Check": "bg-primary/10 text-primary border border-primary/20",
  "Sold Out":       "bg-muted text-muted-foreground border border-border",
}

function BuyerActions({ product }: { product: Product }) {
  const router = useRouter()
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  return (
    <div className="mt-2 flex gap-1.5" onClick={(e) => e.preventDefault()}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          addItem({ id: product.id, sellerId: product.sellerId, name: product.name, seller: product.seller, price: product.price, image: product.image, badge: product.badge, quantity: 1 })
          setAdded(true)
          setTimeout(() => setAdded(false), 1500)
        }}
        className={cn(
          "flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-all active:scale-95",
          added
            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
            : "border border-primary/20 bg-primary/8 text-primary hover:bg-primary/15",
        )}
      >
        {added ? <CheckCircle2 className="size-3" /> : <ShoppingCart className="size-3" />}
        {added ? "Added!" : "Add to Cart"}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          // Add to cart then navigate directly to checkout
          addItem({ id: product.id, sellerId: product.sellerId, name: product.name, seller: product.seller, price: product.price, image: product.image, badge: product.badge, quantity: 1 })
          router.push("/marketplace/checkout")
        }}
        className="flex items-center justify-center gap-1 rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-all hover:bg-gold/20 active:scale-95 dark:text-gold"
      >
        <Zap className="size-3" /> Buy
      </button>
    </div>
  )
}

/** `readOnly`: seller preview — no link to the buyer product page, no cart/buy buttons. */
export function ProductCard({ product, readOnly = false }: { product: Product; readOnly?: boolean }) {
  const content = (
    <>
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <Image src={product.image} alt={product.name} fill
          className="object-cover transition-transform duration-300 group-hover:scale-105" />
        {!readOnly && (
          <div className="absolute inset-0 hidden items-center justify-center bg-primary/30 opacity-0 transition-opacity group-hover:opacity-100 lg:flex">
            <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow">
              Quick View
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-xs font-medium leading-tight text-foreground sm:text-sm">{product.name}</p>
        <p className="text-[11px] text-muted-foreground">{product.seller}</p>
        <RatingSummary avg={product.rating ?? 0} count={product.ratingCount ?? 0} />

        <div className="mt-auto pt-1">
          <span className="text-sm font-bold text-gold sm:text-base">₱{product.price.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_STYLES[product.badge])}>
            {product.badge}
          </span>
          {!!product.sold && (
            <span className="text-[10px] text-muted-foreground">{product.sold} sold</span>
          )}
        </div>

        {/* Buttons/divs only, never nested <a> */}
        {!readOnly && <BuyerActions product={product} />}
      </div>
    </>
  )

  const cardClass = "group relative flex flex-col overflow-hidden rounded-xl border border-primary/10 bg-card shadow-sm"
  if (readOnly) return <div className={cardClass}>{content}</div>
  return (
    <Link
      href={`/marketplace/product/${product.id}`}
      className={cn(cardClass, "transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98]")}
    >
      {content}
    </Link>
  )
}
