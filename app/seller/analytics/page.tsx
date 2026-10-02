import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, MiniBarChart, DashTable, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart2, TrendingUp, Wallet, Award } from "lucide-react"

const MONTHLY = [12400, 15800, 18900, 21200, 28400, 31600, 34200]
const LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul"]

export default async function SellerAnalyticsPage() {
  // Section 7 — sellers can only view analytics scoped to their own products.
  const ctx = await requireDashboard("seller", "analytics")
  const sellerId = ctx.storeId ?? ""
  const supabase = await createClient()

  const { data: royaltyRows } = await supabase
    .from("order_items")
    .select("quantity, unit_price, products(is_royalty_product, royalty_amount)")
    .eq("seller_id", sellerId)

  let totalRoyaltyDeducted = 0
  let totalSalesAfterRoyalty = 0
  let logoProductsSold = 0
  for (const row of royaltyRows ?? []) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products
    if (!product?.is_royalty_product) continue
    logoProductsSold += row.quantity
    totalRoyaltyDeducted += Number(product.royalty_amount) * row.quantity
    totalSalesAfterRoyalty += Number(row.unit_price) * row.quantity
  }

  const stats: Stat[] = [
    { label: "Total Revenue",  value: "₱34,200", icon: Wallet,     hint: "+8% this week", trend: 8, accent: "gold" },
    { label: "This Month",     value: "₱8,800",  icon: TrendingUp, hint: "Aug 2026",               accent: "primary" },
    { label: "Walk-in Share",  value: "63%",      icon: BarChart2,  hint: "₱21,400",                accent: "primary" },
    { label: "Online Share",   value: "37%",      icon: BarChart2,  hint: "₱12,800",                accent: "gold" },
  ]
  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Analytics" description="Sales trends, profit summary, and product performance — visible only to your org." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />
        <Card className="border-gold/20 bg-gold/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <Award className="size-4 text-gold" /> Logo Royalty Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Logo Products Sold", "Total Royalty Deducted", "Total Sales After Royalty"]}
              rows={[[String(logoProductsSold), `₱${totalRoyaltyDeducted.toLocaleString()}`, `₱${totalSalesAfterRoyalty.toLocaleString()}`]]}
            />
            <p className="mt-3 text-xs text-muted-foreground">Only your own royalty-flagged sales are shown here — see /bao/analytics for the platform-wide view.</p>
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <TrendingUp className="size-4 text-gold" /> Monthly Sales Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBarChart data={MONTHLY} labels={LABELS} color="oklch(0.4 0.13 20)" />
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Best-Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Product","Units Sold","Revenue","% of Total"]}
              rows={[
                ["CICT Dept Shirt", "82 sold","₱31,160","46%"],
                ["Foundation Ticket","200 sold","₱24,000","35%"],
                ["SSU Tumbler",    "47 sold","₱13,630","20%"],
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
