import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, DashTable, StatusBadge, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CreditCard, QrCode, Wallet } from "lucide-react"
import type { DashboardCtx } from "@/lib/modules"

/** Cash and GCash payment log for a store. Shared by the seller and cashier dashboards. */
export async function StorePayments({ ctx }: { ctx: DashboardCtx }) {
  const supabase = await createClient()
  const { data: orderItems, error } = await supabase
    .from("order_items")
    .select("order_id, product_name, quantity, orders(id, status, total, payment_method, created_at)")
    .eq("seller_id", ctx.storeId ?? "")
    .order("order_id", { ascending: false })
    .limit(300)

  type OrderRow = { id: string; status: string; total: number; payment_method: string; created_at: string; items: string[] }
  const orders = new Map<string, OrderRow>()
  for (const item of orderItems ?? []) {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders
    if (!order) continue
    const current: OrderRow = orders.get(order.id) ?? { ...order, total: Number(order.total), items: [] }
    current.items.push(`${item.product_name} × ${item.quantity}`)
    orders.set(order.id, current)
  }
  const rows = [...orders.values()]
    .filter((o) => o.status !== "cancelled")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const settled = rows.filter((o) => o.status !== "pending")
  const cashRevenue = settled.filter((o) => o.payment_method === "cash").reduce((s, o) => s + o.total, 0)
  const onlineRevenue = settled.filter((o) => o.payment_method !== "cash").reduce((s, o) => s + o.total, 0)
  const pendingCount = rows.length - settled.length

  const stats: Stat[] = [
    { label: "Walk-in Revenue", value: `₱${cashRevenue.toLocaleString()}`, icon: Wallet, hint: "Cash payments", accent: "primary" },
    { label: "Online Revenue", value: `₱${onlineRevenue.toLocaleString()}`, icon: CreditCard, hint: "GCash / bank, verified", accent: "gold" },
    { label: "Pending Payments", value: pendingCount, icon: QrCode, hint: "Awaiting verification", accent: pendingCount > 0 ? "red" : "primary" },
    { label: "Total Transactions", value: rows.length, icon: CreditCard, hint: "All time", accent: "primary" },
  ]

  const tableRows = rows.slice(0, 30).map((o) => [
    o.id.slice(0, 8).toUpperCase(),
    o.items.join(", "),
    `₱${o.total.toLocaleString()}`,
    o.payment_method,
    new Date(o.created_at).toLocaleDateString(),
    <StatusBadge key={o.id} status={o.status === "paid" || o.status === "completed" ? "paid" : o.status === "ready_for_pickup" ? "processing" : "pending"} />,
  ])

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Payment Transactions" description="Cash and GCash payments for your shop. Confirm payments from the Orders page." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle className="size-4 shrink-0" />
            Could not load payments — run scripts/setup_all.sql in Supabase.
          </div>
        )}
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base"><CreditCard className="size-4 text-primary" /> Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {tableRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <DashTable columns={["Order", "Items", "Amount", "Method", "Date", "Status"]} rows={tableRows} />
            )}
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
