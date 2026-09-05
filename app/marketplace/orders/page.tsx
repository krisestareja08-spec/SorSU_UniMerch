"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type Order = { id: string; created_at: string; total: number; status: string; payment_method: string; items: string }

const STATUS_STYLES: Record<string, string> = {
  pending:          "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300",
  paid:             "bg-primary/10 text-primary border border-primary/20",
  ready_for_pickup: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
  completed:        "bg-muted text-muted-foreground border border-border",
  cancelled:        "bg-destructive/10 text-destructive border border-destructive/20",
}
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", paid: "Payment Verified",
  ready_for_pickup: "Ready for Pickup", completed: "Completed", cancelled: "Cancelled",
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from("orders")
        .select("id, created_at, total, status, payment_method, order_items(product_name, quantity)")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false })
      setOrders((data ?? []).map((o: any) => ({
        id: o.id,
        created_at: new Date(o.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        total: Number(o.total), status: o.status, payment_method: o.payment_method,
        items: (o.order_items ?? []).map((i: any) => `${i.product_name} × ${i.quantity}`).join(", ") || "—",
      })))
      setLoading(false)
    })
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
          <Package className="size-6 text-primary" />My Orders
        </h1>
        <div className="mt-2 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
      </div>
      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Package className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
          <Link href="/marketplace" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Browse Marketplace</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-card p-4 shadow-sm">
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">#{order.id.slice(0, 8)}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_STYLES[order.status] ?? STATUS_STYLES.pending)}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>
                <p className="line-clamp-1 text-xs text-muted-foreground">{order.items}</p>
                <p className="text-xs text-muted-foreground">{order.payment_method} · {order.created_at}</p>
              </div>
              <span className="shrink-0 text-base font-bold text-gold">₱{order.total.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
