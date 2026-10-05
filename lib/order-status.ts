import { CheckCircle2, Clock, CreditCard, MapPin, Package, XCircle, type LucideIcon } from "lucide-react"

/** Order lifecycle for campus pickup orders. Shared by buyer pages, receipts and store dashboards. */
export type OrderStatus = "pending" | "partially_paid" | "paid" | "ready_for_pickup" | "completed" | "cancelled"

type StatusDef = { label: string; badge: string; description: string; icon: LucideIcon }

const ORDER_STATUS: Record<OrderStatus, StatusDef> = {
  pending: {
    label: "Pending",
    badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
    description: "Order placed. The seller is verifying your payment.",
    icon: Clock,
  },
  partially_paid: {
    label: "Partially Paid",
    badge: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
    description: "Part of the payment was received. Settle the balance with the seller.",
    icon: CreditCard,
  },
  paid: {
    label: "Preparing",
    badge: "bg-primary/10 text-primary border-primary/20",
    description: "Payment confirmed. The seller is preparing your items.",
    icon: Package,
  },
  ready_for_pickup: {
    label: "For Pickup",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    description: "Your items are ready. Claim them at the pickup location with your I.D.",
    icon: MapPin,
  },
  completed: {
    label: "Completed",
    badge: "bg-muted text-muted-foreground border-border",
    description: "Items claimed. Thank you for your order!",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    description: "This order was cancelled.",
    icon: XCircle,
  },
}

/** The normal path an order moves through (cancelled can happen at any point). */
export const ORDER_FLOW: OrderStatus[] = ["pending", "paid", "ready_for_pickup", "completed"]

export function statusDef(status: string): StatusDef {
  return ORDER_STATUS[status as OrderStatus] ?? ORDER_STATUS.pending
}

export type TimelineEntry = { status: string; at: string | null }

/**
 * Timeline steps: every recorded change (with its time), then the remaining steps of the normal
 * flow still ahead (no time yet). Cancelled orders stop at the cancellation.
 */
export function buildTimeline(current: string, history: { status: string; created_at: string }[], createdAt: string) {
  const recorded: TimelineEntry[] = history.length
    ? history.map((h) => ({ status: h.status, at: h.created_at }))
    : [{ status: "pending", at: createdAt }, ...(current !== "pending" ? [{ status: current, at: null }] : [])]

  // Collapse consecutive duplicates
  const steps = recorded.filter((s, i) => i === 0 || s.status !== recorded[i - 1].status)
  if (current === "cancelled") return { done: steps, upcoming: [] as OrderStatus[] }

  const reachedIndex = Math.max(ORDER_FLOW.indexOf(current as OrderStatus), current === "partially_paid" ? 0 : -1)
  const upcoming = ORDER_FLOW.slice(reachedIndex + 1).filter((s) => !steps.some((d) => d.status === s))
  return { done: steps, upcoming }
}

export function formatOrderTime(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

export function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
