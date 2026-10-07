import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReceiptText, Tag, TrendingUp, Package } from "lucide-react"

export default async function SellerPage() {
  const ctx = await requireDashboard("seller")
  const sellerId = ctx.storeId ?? ""
  const supabase = await createClient()

  const [{ data: products }, { data: orders }] = await Promise.all([
    supabase.from("products").select("id, status").eq("seller_id", sellerId),
    supabase.from("order_items").select("order_id, unit_price, quantity, orders(status, total)").eq("seller_id", sellerId),
  ])

  const activeListings = (products ?? []).filter((p) => p.status === "approved").length
  const pendingProducts = (products ?? []).filter((p) => p.status === "pending").length
  const allOrders = orders ?? []
  const openOrders = allOrders.filter((o) => {
    const s = (Array.isArray(o.orders) ? o.orders[0] : o.orders)?.status
    return s === "pending" || s === "paid" || s === "partially_paid"
  }).length
  const totalRevenue = allOrders.reduce((sum, o) => {
    const order = Array.isArray(o.orders) ? o.orders[0] : o.orders
    return order?.status === "completed" ? sum + Number(order.total ?? 0) : sum
  }, 0)

  const stats: Stat[] = [
    { label: "Total Revenue",    value: `₱${totalRevenue.toLocaleString()}`, icon: TrendingUp,   hint: "Completed orders",  accent: "gold" },
    { label: "Open Orders",      value: openOrders,   icon: ReceiptText, hint: "Pending/Paid",      accent: "primary" },
    { label: "Active Listings",  value: activeListings, icon: Tag,        hint: "Live on marketplace",accent: "primary" },
    { label: "Pending Review",   value: pendingProducts, icon: Package,   hint: "Awaiting BAO",       accent: "red" },
  ]

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Seller Dashboard" description="Manage your shop, orders, and products." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-primary/10">
            <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">Quick Links</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[["Add a Product", "/seller/products"], ["View Orders", "/seller/orders"], ["Shop Settings", "/seller/shop"]].map(([label, href]) => (
                <a key={href as string} href={href as string} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm font-medium hover:bg-muted/40 transition-colors">
                  {label as string}
                </a>
              ))}
            </CardContent>
          </Card>
          <Card className="border-primary/10">
            <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">Order Workflow</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground">
                {["Buyer places order", "Seller verifies payment receipt", "Mark as Paid / Partially Paid", "Prepare item — Mark For Pick Up", "Buyer collects — Mark Completed"].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </ManagementShell>
  )
}
