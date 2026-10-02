"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Heart, ShoppingCart, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

const INITIAL_WISHLIST = [
  { id: "p2",  name: "SSU Maroon Hoodie",       seller: "Supreme Student Council", price: 680, image: "/placeholder.jpg", badge: "Pre-Order" as const },
  { id: "p6",  name: "Education Faculty Polo",  seller: "Education Faculty Assoc", price: 550, image: "/placeholder.jpg", badge: "Interest Check" as const },
  { id: "p9",  name: "SSU Tote Bag",            seller: "Supreme Student Council", price: 220, image: "/placeholder.jpg", badge: "Available" as const },
]

const BADGE_STYLES = {
  "Available":      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
  "Pre-Order":      "bg-gold/15 text-amber-700 border border-gold/30 dark:text-gold",
  "Interest Check": "bg-primary/10 text-primary border border-primary/20",
  "Sold Out":       "bg-muted text-muted-foreground border border-border",
}

export default function WishlistPage() {
  const [items, setItems] = useState(INITIAL_WISHLIST)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
          <Heart className="size-6 text-primary" /> Wishlist
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Items you saved for later.</p>
        <div className="mt-3 h-px bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Heart className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Your wishlist is empty.</p>
          <Link href="/marketplace" className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-primary/10 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/10">
              {/* Remove button */}
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                aria-label={`Remove ${item.name} from wishlist`}
                className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground shadow transition-colors hover:text-destructive"
              >
                <Heart className="size-3.5 fill-current" />
              </button>

              <div className="relative aspect-square overflow-hidden bg-muted">
                <Image src={item.image} alt={item.name} fill className="object-cover transition-transform group-hover:scale-105" />
              </div>

              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <p className="line-clamp-2 text-sm font-medium leading-tight">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.seller}</p>

                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="text-base font-bold text-gold">₱{item.price.toLocaleString()}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_STYLES[item.badge])}>
                    {item.badge}
                  </span>
                </div>

                <div className="mt-2 flex gap-1.5">
                  <Link href={`/marketplace/product/${item.id}`}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-primary/20 bg-primary/8 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15">
                    <ShoppingCart className="size-3" /> Add to Cart
                  </Link>
                  <Link href={`/marketplace/product/${item.id}`}
                    className="flex items-center justify-center gap-1 rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-gold/20 dark:text-gold">
                    <Zap className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
