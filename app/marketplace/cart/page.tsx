"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { Minus, Plus, Trash2, ShoppingBag, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCart } from "@/lib/cart-context"

const BADGE_STYLES: Record<string, string> = {
  "Available": "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
  "Pre-Order": "bg-gold/15 text-amber-700 border border-gold/30 dark:text-gold",
  "Interest Check": "bg-primary/10 text-primary border border-primary/20",
  "Sold Out": "bg-muted text-muted-foreground border border-border",
}

export default function CartPage() {
  const { items, removeItem, updateQty, total, clearCart } = useCart()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  // Auto-select all items when the list changes
  const allIds = new Set(items.map((i) => i.id))
  const effectiveSelected = selected.size === 0 ? allIds : new Set([...selected].filter((id) => allIds.has(id)))

  function toggleSelect(id: string) {
    setSelected((s) => { const n = new Set(s.size === 0 ? allIds : s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected(effectiveSelected.size === items.length ? new Set() : new Set(allIds))
  }

  const selectedItems = items.filter((i) => effectiveSelected.has(i.id))
  const subtotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const allSelected = effectiveSelected.size === items.length && items.length > 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
          <ShoppingBag className="size-6 text-primary" />
          My Cart
        </h1>
        <div className="mt-2 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-4 rounded accent-primary" />
              <span className="text-sm font-medium">Select All ({items.length})</span>
            </label>
            {items.length > 0 && (
              <button onClick={() => { clearCart(); setSelected(new Set()) }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                Clear Cart
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <ShoppingBag className="mx-auto size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Your cart is empty.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/marketplace">Browse Marketplace</Link>
              </Button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-xl border border-primary/10 bg-card p-3 shadow-sm transition-all hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 sm:gap-4 sm:p-4">
                <div className="flex items-center pt-1">
                  <input type="checkbox" checked={effectiveSelected.has(item.id)} onChange={() => toggleSelect(item.id)} className="size-4 rounded accent-primary" />
                </div>
                <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-24">
                  <Image src={item.image || "/placeholder.jpg"} alt={item.name} fill className="object-cover" />
                </div>
                <div className="flex flex-1 flex-col gap-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium leading-tight text-foreground">{item.name}</p>
                    <button onClick={() => removeItem(item.id)} className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-destructive" aria-label="Remove item">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.seller}</p>
                  {item.variant && <p className="text-xs text-muted-foreground">{item.variant}</p>}
                  <span className={cn("mt-0.5 w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_STYLES[item.badge] ?? BADGE_STYLES["Available"])}>
                    {item.badge}
                  </span>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-base font-bold text-gold">₱{(item.price * item.quantity).toLocaleString()}</span>
                    <div className="flex items-center gap-1 rounded-full border border-border bg-background px-1">
                      <button onClick={() => updateQty(item.id, -1)} className="flex size-7 items-center justify-center rounded-full text-primary transition-colors hover:bg-gold/15">
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="flex size-7 items-center justify-center rounded-full bg-gold text-primary transition-colors hover:bg-gold/80">
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden lg:block lg:w-72 xl:w-80">
          <div className="sticky top-24 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-serif text-base font-semibold text-foreground">Order Summary</h2>
            <div className="mt-3 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({selectedItems.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span>₱{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span className="text-emerald-600 dark:text-emerald-400">Free / Walk-in</span>
              </div>
              <div className="mt-3 border-t border-dashed border-border pt-3">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-lg text-gold">₱{subtotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <Button asChild size="lg" className="mt-5 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90" disabled={effectiveSelected.size === 0}>
              <Link href="/marketplace/checkout">
                Proceed to Checkout
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-16 inset-x-0 z-30 border-t border-border bg-primary px-4 py-3 shadow-lg lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs text-primary-foreground/70">Total ({selectedItems.reduce((s, i) => s + i.quantity, 0)} items)</p>
            <p className="text-lg font-bold text-gold">₱{subtotal.toLocaleString()}</p>
          </div>
          <Button asChild className="rounded-full bg-gold px-6 font-semibold text-primary hover:bg-gold/80" disabled={effectiveSelected.size === 0}>
            <Link href="/marketplace/checkout">Checkout ({effectiveSelected.size})</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

