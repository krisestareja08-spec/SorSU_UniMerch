import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronRight, MapPin, Package } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getBuyerOrders } from "@/lib/orders"
import { OrderStatusBadge } from "@/components/orders/order-parts"
import { ReorderButton } from "@/components/orders/reorder-button"
import { formatOrderTime, peso } from "@/lib/order-status"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "active", label: "Active", statuses: ["pending", "partially_paid", "paid", "ready_for_pickup"], empty: "No orders in progress." },
  { id: "completed", label: "Completed", statuses: ["completed"], empty: "No completed purchases yet." },
  { id: "cancelled", label: "Cancelled", statuses: ["cancelled"], empty: "No cancelled orders." },
] as const

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  // Completed is the buyer's full purchase history, so load well past the usual page size
  const allOrders = await getBuyerOrders(supabase, { limit: 500 })

  const tab = TABS.find((t) => t.id === tabParam) ?? TABS[0]
  const countFor = (t: (typeof TABS)[number]) => allOrders.filter((o) => (t.statuses as readonly string[]).includes(o.status)).length
  const orders = allOrders.filter((o) => (tab.statuses as readonly string[]).includes(o.status))
  const isPast = tab.id !== "active"

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">My Orders</h1>
      <div className="mt-1.5 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />

      <nav className="mt-4 flex gap-1 rounded-xl border border-border bg-muted/40 p-1" aria-label="Order status">
        {TABS.map((t) => (
          <Link key={t.id} href={t.id === "active" ? "/marketplace/orders" : `/marketplace/orders?tab=${t.id}`}
            aria-current={t.id === tab.id ? "page" : undefined}
            className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-colors",
              t.id === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
            <span className={cn("rounded-full px-1.5 text-[10px] font-bold", t.id === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{countFor(t)}</span>
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Package className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">{allOrders.length === 0 ? "You haven't placed any orders yet." : tab.empty}</p>
          <Link href="/marketplace" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Browse the marketplace</Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {orders.map((order) => {
            const first = order.items[0]
            const count = order.items.reduce((n, i) => n + i.quantity, 0)
            return (
              <li key={order.id} className="overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-sm transition hover:border-primary/30 hover:shadow-md">
                <Link href={`/marketplace/orders/${order.id}`} className="block p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{order.store?.name ?? "Campus Seller"}</p>
                    <OrderStatusBadge status={order.status} preOrder={order.items.some((i) => i.preOrder)} />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {first?.image ? <Image src={first.image} alt="" fill className="object-cover" sizes="56px" /> : <Package className="m-auto mt-4 size-6 text-muted-foreground/40" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{first?.name}{order.items.length > 1 ? ` + ${order.items.length - 1} more` : ""}</p>
                      <p className="text-xs text-muted-foreground">{count} item{count === 1 ? "" : "s"} · {formatOrderTime(order.createdAt)}</p>
                      {order.pickupLocation && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" />{order.pickupLocation}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gold">{peso(order.total)}</p>
                      <ChevronRight className="ml-auto size-4 text-muted-foreground/50" />
                    </div>
                  </div>
                </Link>
                {isPast && (
                  <div className="flex justify-end border-t border-border px-4 py-2.5">
                    <ReorderButton items={order.items} storeName={order.store?.name ?? "Campus Seller"} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
