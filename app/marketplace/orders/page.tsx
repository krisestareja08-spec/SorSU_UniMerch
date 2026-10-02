import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronRight, MapPin, Package } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getBuyerOrders } from "@/lib/orders"
import { OrderStatusBadge } from "@/components/orders/order-parts"
import { formatOrderTime, peso } from "@/lib/order-status"

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const orders = await getBuyerOrders(supabase)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">My Orders</h1>
      <div className="mt-1.5 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />

      {orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Package className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">You haven&apos;t placed any orders yet.</p>
          <Link href="/marketplace" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Browse the marketplace</Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {orders.map((order) => {
            const first = order.items[0]
            const count = order.items.reduce((n, i) => n + i.quantity, 0)
            return (
              <li key={order.id}>
                <Link href={`/marketplace/orders/${order.id}`} className="block rounded-2xl border border-primary/10 bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md">
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
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
