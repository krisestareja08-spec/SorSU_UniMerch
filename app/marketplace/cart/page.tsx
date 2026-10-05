"use client"

import Link from "next/link"
import Image from "next/image"
import { use, useEffect, useRef, useState } from "react"
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

const SWIPE_DELETE_PX = 90

/** Drag a row left to delete it; vertical scrolling is left to the browser. */
function SwipeToDelete({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const swiping = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return
    origin.current = { x: e.clientX, y: e.clientY }
    swiping.current = false
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!origin.current) return
    const mx = e.clientX - origin.current.x
    const my = e.clientY - origin.current.y
    if (!swiping.current) {
      if (Math.abs(mx) < 8 || Math.abs(mx) < Math.abs(my)) return
      swiping.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
    }
    setDx(Math.min(0, mx))
  }
  function onPointerEnd() {
    const wasSwiping = swiping.current
    origin.current = null
    swiping.current = false
    setDragging(false)
    if (!wasSwiping) return
    if (dx <= -SWIPE_DELETE_PX) {
      setDx(-window.innerWidth)
      timer.current = setTimeout(onDelete, 180)
    } else {
      setDx(0)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div aria-hidden className={cn("absolute inset-0 flex items-center justify-end bg-destructive px-6 text-white transition-opacity", dx < 0 ? "opacity-100" : "opacity-0")}>
        <Trash2 className="size-5" />
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{ transform: `translateX(${dx}px)`, touchAction: "pan-y" }}
        className={cn("relative", !dragging && "transition-transform duration-200")}
      >
        {children}
      </div>
    </div>
  )
}

export default function CartPage({ searchParams }: { searchParams: Promise<{ reorder_skipped?: string }> }) {
  const { items, loaded, removeItem, removeItems, updateQty, clearCart, setSelected } = useCart()

  const selectedItems = items.filter((i) => i.selected !== false)
  const selectedCount = selectedItems.length
  const allSelected = items.length > 0 && selectedCount === items.length
  const subtotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const selectedQty = selectedItems.reduce((s, i) => s + i.quantity, 0)

  // Set by the Reorder button when some past items are no longer sold
  const reorderSkipped = Number(use(searchParams).reorder_skipped) || 0

  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected
  }, [selectedCount, allSelected])

  function toggleAll() {
    setSelected(items.map((i) => i.id), !allSelected)
  }
  function deleteAll() {
    if (window.confirm("Remove every item from your cart?")) clearCart()
  }

  const checkoutDisabled = selectedCount === 0

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
              <input ref={selectAllRef} type="checkbox" checked={allSelected} disabled={items.length === 0} onChange={toggleAll} className="size-4 rounded accent-primary" />
              <span className="text-sm font-medium">Select All ({items.length})</span>
            </label>
            {items.length > 0 && (
              <button onClick={deleteAll} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive">
                <Trash2 className="size-3.5" />
                Delete All
              </button>
            )}
          </div>
          {reorderSkipped > 0 && (
            <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              {reorderSkipped} item{reorderSkipped === 1 ? " from your past order is" : "s from your past order are"} no longer available and {reorderSkipped === 1 ? "was" : "were"} left out.
            </p>
          )}
          {items.length > 0 && <p className="px-1 text-[11px] text-muted-foreground sm:hidden">Swipe an item left to remove it.</p>}

          {!loaded ? (
            [1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <ShoppingBag className="mx-auto size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Your cart is empty.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/marketplace">Browse Marketplace</Link>
              </Button>
            </div>
          ) : (
            items.map((item) => (
              <SwipeToDelete key={item.id} onDelete={() => removeItems([item.id])}>
                <div className="flex gap-3 rounded-xl border border-primary/10 bg-card p-3 shadow-sm transition-all hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 sm:gap-4 sm:p-4">
                  <div className="flex items-center pt-1">
                    <input type="checkbox" checked={item.selected !== false} onChange={(e) => setSelected([item.id], e.target.checked)} className="size-4 rounded accent-primary" aria-label={`Select ${item.name}`} />
                  </div>
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-24">
                    <Image src={item.image || "/placeholder.jpg"} alt={item.name} fill className="object-cover" draggable={false} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
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
              </SwipeToDelete>
            ))
          )}
        </div>

        <div className="hidden lg:block lg:w-72 xl:w-80">
          <div className="sticky top-24 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-serif text-base font-semibold text-foreground">Order Summary</h2>
            <div className="mt-3 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({selectedQty} items)</span>
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
            {checkoutDisabled ? (
              <Button size="lg" className="mt-5 w-full gap-2" disabled>Proceed to Checkout<ChevronRight className="size-4" /></Button>
            ) : (
              <Button asChild size="lg" className="mt-5 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/marketplace/checkout">
                  Proceed to Checkout
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-16 inset-x-0 z-30 border-t border-border bg-primary px-4 py-3 shadow-lg lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs text-primary-foreground/70">Total ({selectedQty} items)</p>
            <p className="text-lg font-bold text-gold">₱{subtotal.toLocaleString()}</p>
          </div>
          {checkoutDisabled ? (
            <Button className="rounded-full px-6 font-semibold" disabled>Checkout (0)</Button>
          ) : (
            <Button asChild className="rounded-full bg-gold px-6 font-semibold text-primary hover:bg-gold/80">
              <Link href="/marketplace/checkout">Checkout ({selectedCount})</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}