import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, MiniBarChart, DashTable, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart2, Package, ShoppingCart, TrendingUp, Wallet, Award } from "lucide-react"
import { byMonth, groupBy, loadSales, peso, totals } from "@/lib/analytics"

export default async function SellerAnalyticsPage() {
  // Sellers only see analytics for their own store.
  const ctx = await requireDashboard("seller", "analytics")
  const supabase = await createClient()
  const lines = await loadSales(supabase, { storeId: ctx.storeId ?? "" })

  const all = totals(lines)
  const months = byMonth(lines, 6)
  const thisMonth = months[months.length - 1]
  const lastMonth = months[months.length - 2]
  const trend = lastMonth?.gross ? Math.round(((thisMonth.gross - lastMonth.gross) / lastMonth.gross) * 100) : undefined
  const products = groupBy(lines, (l) => l.productName).slice(0, 5)
  const logoLines = lines.filter((l) => l.royaltyPerUnit > 0)
  const logo = totals(logoLines)

  const stats: Stat[] = [
    { label: "Total Sales", value: peso(all.gross), icon: Wallet, hint: "All orders except cancelled", accent: "gold" },
    { label: "This Month", value: peso(thisMonth?.gross ?? 0), icon: TrendingUp, hint: trend != null ? `${trend >= 0 ? "+" : ""}${trend}% vs last month` : thisMonth?.label, trend, accent: "primary" },
    { label: "Orders", value: all.orders, icon: ShoppingCart, hint: "All time", accent: "primary" },
    { label: "Items Sold", value: all.itemsSold, icon: Package, hint: "All time", accent: "gold" },
  ]

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Analytics" description="Sales trends, royalty and best-selling products for your store only." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />

        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base"><BarChart2 className="size-4 text-gold" /> Monthly Sales (last 6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            {all.orders === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No sales yet. Your trend will appear here once orders come in.</p>
            ) : (
              <>
                <MiniBarChart data={months.map((m) => m.gross)} labels={months.map((m) => m.label)} color="oklch(0.4 0.13 20)" />
                <p className="sr-only">{months.map((m) => `${m.label}: ${peso(m.gross)}`).join(", ")}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="font-serif text-base">Best-Selling Products</CardTitle></CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No products sold yet.</p>
            ) : (
              <DashTable
                columns={["Product", "Units Sold", "Revenue", "% of Sales"]}
                rows={products.map((p) => [p.key, String(p.items), peso(p.gross), `${all.gross ? Math.round((p.gross / all.gross) * 100) : 0}%`])}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-gold/20 bg-gold/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base"><Award className="size-4 text-gold" /> Logo Royalty Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Logo Products Sold", "Royalty to BAO", "Your Sales After Royalty"]}
              rows={[[String(logo.itemsSold), peso(logo.royaltyEarned + logo.royaltyPending), peso(logo.net)]]}
            />
            <p className="mt-3 text-xs text-muted-foreground">Official-logo products only. Royalty is deducted from your earnings and goes to BAO.</p>
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
