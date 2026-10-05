import Image from "next/image"
import Link from "next/link"
import { CheckCircle2, Circle, Clock3, MapPin, Package, Store } from "lucide-react"
import { buildTimeline, formatOrderTime, ORDER_FLOW, peso, statusDef, type OrderStatus } from "@/lib/order-status"
import type { BuyerOrder, BuyerOrderItem } from "@/lib/orders"
import { storefrontHref } from "@/lib/storefront-theme"
import { cn } from "@/lib/utils"

/** Status badge (e.g. Pending, Preparing, For Pickup) plus a Pre-Order badge when relevant. */
export function OrderStatusBadge({ status, preOrder = false, className }: { status: string; preOrder?: boolean; className?: string }) {
  const def = statusDef(status)
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", def.badge)}>
        <def.icon className="size-3.5" aria-hidden />{def.label}
      </span>
      {preOrder && (
        <span className="rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-gold">Pre-Order</span>
      )}
    </span>
  )
}

/** Header: store name + current status. */
export function OrderHeader({ order }: { order: BuyerOrder }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
          {order.store?.logoUrl ? <Image src={order.store.logoUrl} alt="" fill className="object-cover" sizes="40px" /> : <Store className="size-5 text-primary" />}
        </div>
        <div className="min-w-0">
          {order.store ? (
            <Link href={storefrontHref(order.store.id)} className="block truncate font-semibold text-foreground hover:text-primary hover:underline">{order.store.name}</Link>
          ) : <p className="font-semibold">Campus Seller</p>}
          <p className="text-xs text-muted-foreground">Order #{order.id.slice(0, 8).toUpperCase()} · {formatOrderTime(order.createdAt)}</p>
        </div>
      </div>
      <OrderStatusBadge status={order.status} preOrder={order.items.some((i) => i.preOrder)} />
    </div>
  )
}

/**
 * Horizontal progress: Pending → Preparing → For Pickup → Completed.
 * A cancelled order shows the steps it reached, then a red Cancelled step.
 */
export function OrderStepper({ order }: { order: BuyerOrder }) {
  const cancelled = order.status === "cancelled"
  const reachedAt = (s: string) => order.history.find((h) => h.status === s)?.created_at ?? null
  // How far along the normal flow the order got (partially paid still counts as the first step)
  const lastReached = cancelled
    ? Math.max(0, ...order.history.map((h) => ORDER_FLOW.indexOf(h.status as OrderStatus)))
    : Math.max(0, ORDER_FLOW.indexOf(order.status as OrderStatus))
  const steps: { status: string; state: "done" | "current" | "upcoming" | "cancelled"; at: string | null }[] = cancelled
    ? [
        ...ORDER_FLOW.slice(0, lastReached + 1).map((s) => ({ status: s, state: "done" as const, at: reachedAt(s) })),
        { status: "cancelled", state: "cancelled", at: reachedAt("cancelled") },
      ]
    : ORDER_FLOW.map((s, i) => ({
        status: i === 0 && order.status === "partially_paid" ? "partially_paid" : s,
        state: i < lastReached || order.status === "completed" ? "done" : i === lastReached ? "current" : "upcoming",
        at: i === 0 ? reachedAt(s) ?? order.createdAt : reachedAt(s),
      }))

  return (
    <ol className="flex w-full items-start" aria-label="Order progress">
      {steps.map((step, i) => {
        const def = statusDef(step.status)
        return (
          <li key={step.status} className="relative flex flex-1 flex-col items-center text-center" aria-current={step.state === "current" ? "step" : undefined}>
            {i > 0 && (
              <span aria-hidden className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2",
                step.state === "upcoming" ? "bg-border" : step.state === "cancelled" ? "bg-destructive/40" : "bg-primary/60")} />
            )}
            <span className={cn(
              "relative z-10 flex size-8 items-center justify-center rounded-full border-2 bg-card",
              step.state === "done" && "border-primary bg-primary/10 text-primary",
              step.state === "current" && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
              step.state === "upcoming" && "border-border text-muted-foreground/60",
              step.state === "cancelled" && "border-destructive bg-destructive text-destructive-foreground",
            )}>
              {step.state === "done" ? <CheckCircle2 className="size-4" /> : step.state === "upcoming" ? <Circle className="size-3" /> : <def.icon className="size-4" />}
            </span>
            <span className={cn("mt-1.5 px-0.5 text-[11px] font-semibold leading-tight sm:text-xs",
              step.state === "upcoming" ? "text-muted-foreground" : step.state === "cancelled" ? "text-destructive" : "text-foreground")}>
              {def.label}
            </span>
            {step.at && step.state !== "upcoming" && (
              <span className="mt-0.5 hidden text-[10px] text-muted-foreground sm:block">{formatOrderTime(step.at)}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Vertical timeline: completed steps with timestamps, then the steps still ahead. */
export function OrderTimeline({ order }: { order: BuyerOrder }) {
  const { done, upcoming } = buildTimeline(order.status, order.history, order.createdAt)
  const steps = [
    ...done.map((d, i) => ({ status: d.status, at: d.at, state: i === done.length - 1 ? "current" : "done" as const })),
    ...upcoming.map((s) => ({ status: s, at: null, state: "upcoming" as const })),
  ]

  return (
    <ol className="relative space-y-5">
      {steps.map((step, i) => {
        const def = statusDef(step.status)
        const last = i === steps.length - 1
        const cancelled = step.status === "cancelled"
        return (
          <li key={`${step.status}-${i}`} className="relative flex gap-3">
            {!last && (
              <span aria-hidden className={cn("absolute left-4 top-9 -bottom-5 w-0.5 -translate-x-1/2",
                step.state === "upcoming" ? "border-l-2 border-dashed border-border bg-transparent" : "bg-primary/40")} />
            )}
            <span className={cn(
              "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2",
              step.state === "current" && (cancelled ? "border-destructive bg-destructive text-destructive-foreground" : "border-primary bg-primary text-primary-foreground"),
              step.state === "done" && "border-primary/40 bg-primary/10 text-primary",
              step.state === "upcoming" && "border-border bg-card text-muted-foreground/60",
            )}>
              {step.state === "upcoming" ? <Circle className="size-3" /> : <def.icon className="size-4" />}
            </span>
            <div className="min-w-0 pb-1">
              <p className={cn("text-sm font-semibold", step.state === "upcoming" ? "text-muted-foreground" : "text-foreground")}>{def.label}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="size-3" />{step.at ? formatOrderTime(step.at) : step.state === "upcoming" ? "Not yet" : "—"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Product summary: thumbnail, name, variant, quantity and price breakdown. */
export function OrderProductCard({ item }: { item: BuyerOrderItem }) {
  const discounted = item.originalPrice > item.unitPrice
  return (
    <div className="flex gap-3">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.image ? <Image src={item.image} alt={item.name} fill className="object-cover" sizes="80px" /> : <Package className="m-auto mt-6 size-8 text-muted-foreground/40" />}
      </div>
      <div className="min-w-0 flex-1">
        {item.productId ? (
          <Link href={`/marketplace/product/${item.productId}`} className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary">{item.name}</Link>
        ) : <p className="line-clamp-2 text-sm font-medium">{item.name}</p>}
        <p className="text-xs text-muted-foreground">{item.variant ? `Variant: ${item.variant}` : "No variant"} · Qty {item.quantity}</p>
        {item.preOrder && <p className="text-[11px] font-semibold text-amber-700 dark:text-gold">Pre-Order item</p>}
        <dl className="mt-1.5 space-y-0.5 text-xs">
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Original price</dt>
            <dd className={cn(discounted && "text-muted-foreground line-through")}>{peso(item.originalPrice)}</dd></div>
          {discounted && (
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Discounted price</dt><dd className="font-medium text-emerald-700 dark:text-emerald-400">{peso(item.unitPrice)}</dd></div>
          )}
          <div className="flex justify-between gap-2 border-t border-dashed border-border pt-0.5"><dt className="font-medium">Total ({item.quantity} × {peso(item.unitPrice)})</dt>
            <dd className="font-bold text-gold">{peso(item.unitPrice * item.quantity)}</dd></div>
        </dl>
      </div>
    </div>
  )
}

/** Where to claim the order, as set by the seller. */
export function PickupLocationCard({ location, notes, storeHours = null, deadline = null, compact = false }: { location: string | null; notes: string | null; storeHours?: string | null; deadline?: string | null; compact?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/8 text-sm", compact ? "p-3" : "p-4")}>
      <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
      <div className="min-w-0">
        <p className="font-semibold text-foreground">Pickup location</p>
        {location ? (
          <p className="mt-0.5 whitespace-pre-line text-foreground">{location}</p>
        ) : (
          <p className="mt-0.5 text-muted-foreground">The seller hasn&apos;t set a pickup location yet — they will contact you.</p>
        )}
        {notes && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{notes}</p>}
        {storeHours && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground"><span className="font-medium text-foreground">Store hours:</span> {storeHours}</p>}
        {deadline && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-gold">
            <Clock3 className="size-3.5" />Claim by {formatOrderTime(deadline)}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">Bring your I.D. and this order number when claiming your items.</p>
      </div>
    </div>
  )
}
