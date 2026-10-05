import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Card } from "@/components/ui/card"
import { ShoppingCart, AlertTriangle } from "lucide-react"
import { updateOrderStatus } from "./actions"
import { BuyerIdCheck } from "@/components/store/buyer-id-check"
import { ReportBuyerButton } from "@/components/store/report-buyer-button"
import { getOrderBuyers } from "@/app/store-order-actions"

export default async function SupplyOfficeOrdersPage() {
  const ctx = await requireDashboard("supply_office", "orders")
  const sellerId = ctx.storeId ?? ""
  const supabase = await createClient()

  const { data: orderItems, error } = await supabase
    .from("order_items")
    .select("order_id, product_name, quantity, products(is_restricted), orders(id, status, total, payment_method, created_at)")
    .eq("seller_id", sellerId)
    .order("order_id", { ascending: false })

  const orders = new Map<string, { id: string; status: string; total: number; payment_method: string; created_at: string; items: string[]; restricted?: boolean }>()
  for (const item of orderItems ?? []) {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders
    if (!order) continue
    const current: { id: string; status: string; total: number; payment_method: string; created_at: string; items: string[]; restricted?: boolean } = orders.get(order.id) ?? { ...order, total: Number(order.total), items: [] }
    current.items.push(`${item.product_name} × ${item.quantity}`)
    const product = Array.isArray(item.products) ? item.products[0] : item.products
    if (product?.is_restricted) current.restricted = true
    orders.set(order.id, current)
  }
  const rows = [...orders.values()]
  const buyers = await getOrderBuyers("supply_office", rows.map((r) => r.id)).catch(() => ({} as Awaited<ReturnType<typeof getOrderBuyers>>))
  const count = (s: string) => rows.filter((o) => o.status === s).length

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Orders" description="Incoming orders from your shop." />
      <div className="mt-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {[["Pending", count("pending"), "border-amber-200 bg-amber-50"], ["Payment Verified", count("paid"), "border-primary/20 bg-primary/5"], ["Ready for Pickup", count("ready_for_pickup"), "border-emerald-200 bg-emerald-50"], ["Completed", count("completed"), "border-border bg-muted/30"]].map(([l, v, c]) => (
            <div key={l as string} className={`rounded-2xl border p-4 ${c}`}><p className="text-xs text-muted-foreground">{l}</p><p className="font-serif text-2xl font-bold mt-0.5">{v}</p></div>
          ))}
        </div>
        {error && <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"><AlertTriangle className="size-4" />Run scripts/setup_all.sql in Supabase first.</div>}
        <Card className="border-primary/10 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border p-4 font-serif text-base font-semibold"><ShoppingCart className="size-4 text-primary" />Order Queue (FIFO)</div>
          {rows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No orders yet.</p> : (
            <div className="divide-y divide-border">
              {rows.map((order) => (
                <div key={order.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Order {order.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">{order.items.join(", ")}</p>
                    <p className="text-xs text-muted-foreground">{order.payment_method} · {new Date(order.created_at).toLocaleDateString()}</p>
                    {buyers[order.id] && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="font-medium">Buyer: {buyers[order.id].name || "No name"}</span>
                        <span className="text-muted-foreground">{buyers[order.id].contact || "No contact number"}</span>
                        {buyers[order.id].accountStatus !== "active" && <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold capitalize text-destructive">{buyers[order.id].accountStatus}</span>}
                        <ReportBuyerButton orderId={order.id} module="supply_office" buyerName={buyers[order.id].name} />
                      </div>
                    )}
                    {order.restricted && (
                      <div className="mt-2 space-y-1">
                        <BuyerIdCheck orderId={order.id} module="supply_office" />
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">Restricted items — check the buyer&apos;s I.D. before confirming.</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gold">₱{order.total.toLocaleString()}</span>
                    <form action={updateOrderStatus} className="flex gap-2">
                      <input type="hidden" name="order_id" value={order.id} />
                      <select name="status" defaultValue={order.status} className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs">
                        {["pending", "paid", "ready_for_pickup", "completed", "cancelled"].map((s) => <option key={s} value={s}>{s === "ready_for_pickup" ? "Ready for Pickup" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                      <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Update</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </ManagementShell>
  )
}
