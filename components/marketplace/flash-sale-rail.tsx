"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

type SaleItem = {
  id: string
  name: string
  originalPrice: number
  salePrice: number
  stock: number
  totalStock: number
  seller: string
  image: string
  tag: "Campus Sale" | "Org Promo" | "Flash Deal" | "Pre-Order"
}

const SALE_ITEMS: SaleItem[] = [
  { id: "1", name: "CICT Hoodie", originalPrice: 750, salePrice: 580, stock: 4, totalStock: 20, seller: "CICT Org", image: "/placeholder.jpg", tag: "Flash Deal" },
  { id: "2", name: "SSU Tumbler (Maroon)", originalPrice: 350, salePrice: 280, stock: 9, totalStock: 30, seller: "Supreme Student Council", image: "/placeholder.jpg", tag: "Campus Sale" },
  { id: "3", name: "Nursing ID Lace", originalPrice: 80, salePrice: 60, stock: 15, totalStock: 50, seller: "Nursing Org", image: "/placeholder.jpg", tag: "Org Promo" },
  { id: "4", name: "CBA Department Shirt", originalPrice: 400, salePrice: 320, stock: 6, totalStock: 25, seller: "CBA Council", image: "/placeholder.jpg", tag: "Campus Sale" },
  { id: "5", name: "Foundation Day Ticket", originalPrice: 150, salePrice: 120, stock: 20, totalStock: 100, seller: "SorSU Events", image: "/placeholder.jpg", tag: "Flash Deal" },
  { id: "6", name: "Education Dept Lace", originalPrice: 85, salePrice: 65, stock: 12, totalStock: 40, seller: "Education Org", image: "/placeholder.jpg", tag: "Org Promo" },
]

const TAG_COLORS: Record<SaleItem["tag"], string> = {
  "Campus Sale": "bg-primary text-primary-foreground",
  "Org Promo":   "bg-gold text-primary",
  "Flash Deal":  "bg-destructive/90 text-white",
  "Pre-Order":   "bg-muted text-muted-foreground border border-border",
}

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(targetMs)
  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  const h = Math.floor(remaining / 3_600_000)
  const m = Math.floor((remaining % 3_600_000) / 60_000)
  const s = Math.floor((remaining % 60_000) / 1000)
  return { h, m, s }
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-0.5 text-[9px] text-muted-foreground">{label}</span>
    </div>
  )
}

export function FlashSaleRail() {
  // 5 hours 23 minutes from now
  const { h, m, s } = useCountdown(5 * 3_600_000 + 23 * 60_000)

  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="font-serif text-base font-semibold text-foreground sm:text-lg">Flash Sale</h2>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 shadow-sm">
            <Clock className="size-3 text-gold" />
            <div className="flex items-center gap-1">
              <TimeUnit value={h} label="hr" />
              <span className="mb-3 text-sm font-bold text-primary">:</span>
              <TimeUnit value={m} label="min" />
              <span className="mb-3 text-sm font-bold text-primary">:</span>
              <TimeUnit value={s} label="sec" />
            </div>
          </div>
        </div>
        <Link href="/marketplace/flash-sale" className="text-xs font-medium text-gold hover:underline">
          See all
        </Link>
      </div>
      {/* Gold section divider */}
      <div className="mb-4 mt-1.5 h-px bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />

      {/* Horizontal scroll rail */}
      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SALE_ITEMS.map((item) => {
          const stockPct = Math.round((item.stock / item.totalStock) * 100)
          const discount = Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100)
          return (
            <Link
              key={item.id}
              href={`/marketplace/product/${item.id}`}
              className="group relative flex w-36 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/10 active:scale-95"
            >
              {/* Discount badge */}
              <span className="absolute left-2 top-2 z-10 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                -{discount}%
              </span>

              {/* Image */}
              <div className="relative h-32 w-full bg-muted">
                <Image src={item.image} alt={item.name} fill className="object-cover" />
              </div>

              <div className="flex flex-col gap-1 p-2.5">
                {/* Tag */}
                <span className={cn("w-fit rounded-full px-2 py-0.5 text-[9px] font-semibold", TAG_COLORS[item.tag])}>
                  {item.tag}
                </span>

                <p className="line-clamp-2 text-xs font-medium leading-tight text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.seller}</p>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-gold">₱{item.salePrice}</span>
                  <span className="text-[10px] text-muted-foreground line-through">₱{item.originalPrice}</span>
                </div>

                {/* Stock bar */}
                <div className="mt-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        stockPct < 20 ? "bg-destructive" : "bg-gold",
                      )}
                      style={{ width: `${stockPct}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[9px] text-muted-foreground">
                    {stockPct < 20 ? `Only ${item.stock} left!` : `${item.stock} available`}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
