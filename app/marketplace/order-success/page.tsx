import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CheckCircle2, Package, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getBuyerOrders } from "@/lib/orders"
import { OrderStatusBadge, PickupLocationCard } from "@/components/orders/order-parts"
import { formatOrderTime, peso } from "@/lib/order-status"

const PAYMENT_LABELS: Record<string, string> = { gcash: "GCash (receipt uploaded)", cash: "Cash (walk-in)", bank: "Bank transfer" }

/** Receipt shown right after checkout — one section per store, each with its pickup location. */
export default async function OrderSuccessPage({ searchParams }: { searchParams: Promise<{ orders?: string }> }) {
  const { orders: raw } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const ids = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20)
  const orders = ids.length ? await getBuyerOrders(supabase, { ids }) : await getBuyerOrders(supabase, { limit: 1 })
  const grandTotal = orders.reduce((sum, o) => sum + o.total, 0)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
        <div className="relative flex flex-col items-center bg-linear-to-br from-primary to-primary/80 px-8 py-10">
          <Image src="/sorsu-seal.png" alt="SorSU seal" width={48} height={48} className="rounded-full ring-2 ring-gold/40" />
          <div className="mt-5 flex size-16 items-center justify-center rounded-full bg-emerald-500/20 ring-4 ring-emerald-500/30">
            <CheckCircle2 className="size-9 text-emerald-400" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-bold text-primary-foreground">Order placed!</h1>
          <p className="mt-2 text-center text-sm text-primary-foreground/75">
            {orders.length > 1
              ? `Your cart was split into ${orders.length} orders — one per store. Each store confirms and hands over its own items.`
              : "Your order was sent to the seller. You'll see updates in My Orders."}
          </p>
        </div>
        <div className="h-1 bg-linear-to-r from-gold via-gold/60 to-gold/10" />

        <div className="space-y-6 p-6">
          {orders.length === 0 && <p className="text-center text-sm text-muted-foreground">We couldn&apos;t find this order. Check My Orders.</p>}

          {orders.map((order) => (
            <section key={order.id} className="space-y-3 rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{order.store?.name ?? "Campus Seller"}</p>
                  <p className="text-xs text-muted-foreground">Order #{order.id.slice(0, 8).toUpperCase()} · {formatOrderTime(order.createdAt)}</p>
                </div>
                <OrderStatusBadge status={order.status} preOrder={order.items.some((i) => i.preOrder)} />
              </div>
              <ul className="space-y-1 text-sm">
                {order.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{i.name}{i.variant ? ` (${i.variant})` : ""} × {i.quantity}</span>
                    <span className="font-medium">{peso(i.unitPrice * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-dashed border-border pt-2 text-sm">
                <span className="text-muted-foreground">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
                <span className="font-bold text-gold">{peso(order.total)}</span>
              </div>
              <PickupLocationCard location={order.pickupLocation} notes={order.pickupNotes} compact />
              <Link href={`/marketplace/orders/${order.id}`} className="inline-block text-xs font-medium text-primary hover:underline">Track this order →</Link>
            </section>
          ))}

          {orders.length > 1 && (
            <div className="flex justify-between border-t border-border pt-3 font-bold">
              <span>Total</span><span className="text-xl text-gold">{peso(grandTotal)}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/marketplace/orders"><Package className="size-4" />View order status</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="flex-1 gap-2">
              <Link href="/marketplace"><ShoppingBag className="size-4" />Continue shopping</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
