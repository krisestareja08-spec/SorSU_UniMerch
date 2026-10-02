import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColumnChart } from "@/components/analytics/charts"
import { Coins, ShoppingCart, Store, FileText, CheckSquare, ShieldAlert, ChevronRight } from "lucide-react"
import { byMonth, loadSales, peso, totals } from "@/lib/analytics"
import { canUse } from "@/lib/modules"

/**
 * Business Affairs Office — oversees the whole marketplace: monitoring, control and transparency.
 * Royalty from official-logo products is BAO income (like a tax on each sale).
 */
export default async function BaoDashboardPage() {
  const ctx = await requireDashboard("bao")
  const supabase = await createClient()

  const [lines, sellers, pendingApprovals, pulled, openReports] = await Promise.all([
    loadSales(supabase),
    supabase.from("dashboards").select("id", { count: "exact", head: true }).eq("module", "seller"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pulled"),
    supabase.from("sales_reports").select("id", { count: "exact", head: true }).eq("status", "submitted"),
  ])
  const t = totals(lines)
  const months = byMonth(lines, 6)

  const stats: Stat[] = [
    { label: "Royalty earned", value: peso(t.royaltyEarned), icon: Coins, hint: `${peso(t.royaltyPending)} pending payment`, accent: "gold" },
    { label: "Marketplace sales", value: peso(t.gross), icon: ShoppingCart, hint: `${t.orders} orders · ${t.itemsSold} items`, accent: "primary" },
    { label: "Organizations", value: sellers.count ?? 0, icon: Store, hint: "Seller dashboards", accent: "green" },
    { label: "Reports to review", value: openReports.count ?? 0, icon: FileText, hint: "Submitted by stores", accent: "red" },
  ]

  const shortcuts = [
    { perm: "approvals", href: "/bao/approvals", label: "Product approvals", value: `${pendingApprovals.count ?? 0} waiting`, icon: CheckSquare },
    { perm: "marketplace", href: "/bao/marketplace", label: "Pulled-out products", value: `${pulled.count ?? 0} pulled`, icon: ShieldAlert },
    { perm: "reports", href: "/bao/reports", label: "Sales reports", value: `${openReports.count ?? 0} to review`, icon: FileText },
    { perm: "royalty", href: "/bao/royalty", label: "Royalty earnings", value: peso(t.royaltyEarned), icon: Coins },
  ].filter((s) => canUse(ctx, s.perm))

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading
        title="Business Affairs Office"
        description="System-wide monitoring, control and transparency: sales, royalty income, sellers, products and reports."
      />

      <div className="mt-6"><StatGrid stats={stats} /></div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-serif text-base">Royalty earned per month</CardTitle></CardHeader>
          <CardContent>
            <ColumnChart ariaLabel="Royalty earned per month" format="peso" data={months.map((m) => ({ label: m.label, value: m.royalty }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-serif text-base">Marketplace sales per month</CardTitle></CardHeader>
          <CardContent>
            <ColumnChart ariaLabel="Marketplace sales per month" format="peso" data={months.map((m) => ({ label: m.label, value: m.gross }))} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map(({ href, label, value, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/30 hover:shadow-md">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10"><Icon className="size-4 text-primary" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">{value}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/50" />
          </Link>
        ))}
      </div>
    </ManagementShell>
  )
}
