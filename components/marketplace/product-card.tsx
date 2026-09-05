"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ShoppingCart, Zap, Settings, Eye, CheckCircle2, XCircle, EyeOff, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/roles"
import { useCart } from "@/lib/cart-context"

export type ProductBadge = "Available" | "Pre-Order" | "Interest Check" | "Sold Out"

export type Product = {
  id: string
  name: string
  price: number
  originalPrice?: number
  seller: string
  sellerId?: string
  image: string
  badge: ProductBadge
  rating?: number
  sold?: number
  usesUniversityLogo?: boolean
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

function SellerActions({ id }: { id: string }) {
  const router = useRouter()
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        router.push(`/seller/products?edit=${id}`)
      }}
      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/20 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/8 active:scale-95"
    >
      <Settings className="size-3" /> Manage Listing
    </button>
  )
}

function BaoActions({ id }: { id: string }) {
  const [status, setStatus] = useState<"idle" | "approved" | "declined" | "hidden">("idle")
  return (
    <div className="mt-2 space-y-1" onClick={(e) => e.preventDefault()}>
      {status === "idle" ? (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setStatus("approved") }}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-100 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-200 active:scale-95 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            <CheckCircle2 className="size-3" /> Approve
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setStatus("declined") }}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-destructive/10 py-1 text-[10px] font-bold text-destructive hover:bg-destructive/20 active:scale-95"
          >
            <XCircle className="size-3" /> Decline
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setStatus("hidden") }}
            className="flex items-center justify-center rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted active:scale-95"
          >
            <EyeOff className="size-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-2 py-1">
          <span className={cn("text-[10px] font-bold capitalize",
            status === "approved" ? "text-emerald-700" : status === "declined" ? "text-destructive" : "text-muted-foreground")}>
            {status}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setStatus("idle") }}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>
      )}
    </div>
  )
}

function SupplyActions({ id, stock }: { id: string; stock?: number }) {
  const router = useRouter()
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        router.push(`/supply-office/inventory?item=${id}`)
      }}
      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/20 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/8 active:scale-95"
    >
      <RefreshCw className="size-3" /> Update Stock
      {stock != null && <span className="ml-1 text-muted-foreground">({stock})</span>}
    </button>
  )
}

function CashierActions({ id }: { id: string }) {
  const router = useRouter()
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        router.push(`/cashier/payments?product=${id}`)
      }}
      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gold/30 bg-gold/8 py-1.5 text-xs font-semibold text-amber-700 transition-all hover:bg-gold/15 active:scale-95 dark:text-gold"
    >
      <Eye className="size-3" /> Payment Status
    </button>
  )
}

function ReadOnlyActions() {
  return (
    <div className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/30 py-1.5 text-xs text-muted-foreground">
      <Eye className="size-3" /> View Only
    </div>
  )
}

export function ProductCard({ product, viewerRole = "buyer" }: { product: Product; viewerRole?: UserRole }) {
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0

  return (
    <Link
      href={`/marketplace/product/${product.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-primary/10 bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98]"
    >
      {discount > 0 && (
        <span className="absolute left-2 top-2 z-10 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
          -{discount}%
        </span>
      )}
      {product.usesUniversityLogo && (viewerRole === "bao" || viewerRole === "admin") && (
        <span className="absolute right-2 top-2 z-10 rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-bold text-primary">
          3% Royalty
        </span>
      )}

      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <Image src={product.image} alt={product.name} fill
          className="object-cover transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 hidden items-center justify-center bg-primary/30 opacity-0 transition-opacity group-hover:opacity-100 lg:flex">
          <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow">
            Quick View
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-xs font-medium leading-tight text-foreground sm:text-sm">{product.name}</p>
        <p className="text-[11px] text-muted-foreground">{product.seller}</p>

        <div className="mt-auto flex items-baseline gap-1.5 pt-1">
          <span className="text-sm font-bold text-gold sm:text-base">₱{product.price.toLocaleString()}</span>
          {product.originalPrice && (
            <span className="text-[11px] text-muted-foreground line-through">₱{product.originalPrice.toLocaleString()}</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_STYLES[product.badge])}>
            {product.badge}
          </span>
          {product.sold != null && (
            <span className="text-[10px] text-muted-foreground">{product.sold} sold</span>
          )}
        </div>

        {/* Role-specific CTAs — all are buttons/divs, never nested <a> */}
        {viewerRole === "buyer"                              && <BuyerActions product={product} />}
        {viewerRole === "seller"                             && <SellerActions id={product.id} />}
        {(viewerRole === "bao" || viewerRole === "admin")    && <BaoActions id={product.id} />}
        {viewerRole === "supply_office"                      && <SupplyActions id={product.id} stock={product.stock} />}
        {viewerRole === "registrar"                          && <ReadOnlyActions />}
      </div>
    </Link>
  )
}
