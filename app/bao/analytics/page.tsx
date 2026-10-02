import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColumnChart, RankedBars } from "@/components/analytics/charts"
import { BarChart2, Coins, Package, ShoppingCart, Store, Wallet } from "lucide-react"
import { byMonth, groupBy, loadSales, peso, storeNames, totals } from "@/lib/analytics"
import { statusDef } from "@/lib/order-status"
import { cn } from "@/lib/utils"

const RANGES = [3, 6, 12] as const

const MOVEMENT_LABELS: Record<string, string> = {
  sale: "Sold", restock: "Restocked", cancellation: "Returned (cancelled)", adjustment: "Adjusted", initial: "Initial stock",
}

/** Business Intelligence dashboard: sales performance, royalty computation, inventory movement, operations. */
export default async function BaoAnalyticsPage({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const ctx = await requireDashboard("bao", "analytics")
  const { months: raw } = await searchParams
  const months = RANGES.includes(Number(raw) as (typeof RANGES)[number]) ? Number(raw) : 6
  const from = new Date(new Date().getFullYear(), new Date().getMonth() - (months - 1), 1)
  const supabase = await createClient()

  const [lines, movementsRes, statusRes] = await Promise.all([
    loadSales(supabase, { from }),
    supabase.from("inventory_movements").select("change, reason, created_at").gte("created_at", from.toISOString()).limit(5000),
    supabase.from("orders").select("status").gte("created_at", from.toISOString()).limit(5000),
  ])
  const t = totals(lines)
  const perMonth = byMonth(lines, months)
  const stores = groupBy(lines, (l) => l.storeId).slice(0, 8)
  const names = await storeNames(supabase, stores.map((s) => s.key))
  const products = groupBy(lines, (l) => l.productName).slice(0, 8)

  // Inventory movement
  const movementTotals = new Map<string, number>()
  const unitsOutPerMonth = perMonth.map((m) => ({ label: m.label, value: m.items }))
  for (const m of (movementsRes.data ?? []) as { change: number; reason: string }[]) {
    movementTotals.set(m.reason, (movementTotals.get(m.reason) ?? 0) + m.change)
  }

  // Order status breakdown
  const statusCounts = new Map<string, number>()
  for (const o of (statusRes.data ?? []) as { status: string }[]) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1)

  const stats: Stat[] = [
    { label: "Gross sales", value: peso(t.gross), icon: ShoppingCart, hint: `${t.orders} orders`, accent: "primary" },
    { label: "Average order", value: peso(t.orders ? t.gross / t.orders : 0), icon: Wallet, hint: `${t.itemsSold} items sold`, accent: "green" },
    { label: "Royalty earned (BAO)", value: peso(t.royaltyEarned), icon: Coins, hint: `${peso(t.royaltyPending)} pending`, accent: "gold" },
    { label: "Sellers' net", value: peso(t.net), icon: Store, hint: "Gross minus royalty", accent: "primary" },
  ]

  return (
    <ManagementShell ctx={ctx}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading title="BI Analytics" description="Sales performance, royalty fee computation, inventory movement and operations across every store." />
        <nav aria-label="Time range" className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {RANGES.map((r) => (
            <Link key={r} href={`/bao/analytics?months=${r}`}
              className={cn("rounded-lg px-3 py-1 text-sm font-medium", months === r ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {r} months
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-6"><StatGrid stats={stats} /></div>

      {/* Sales performance */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><BarChart2 className="size-4 text-primary" />Gross sales per month</CardTitle></CardHeader>
          <CardContent><ColumnChart ariaLabel="Gross sales per month" format="peso" data={perMonth.map((m) => ({ label: m.label, value: m.gross }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Coins className="size-4 text-gold" />Royalty earned per month</CardTitle></CardHeader>
          <CardContent><ColumnChart ariaLabel="Royalty earned per month" format="peso" data={perMonth.map((m) => ({ label: m.label, value: m.royalty }))} /></CardContent>
        </Card>
      </div>

      {/* Table view of the monthly figures */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="font-serif text-base">Monthly figures</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-120 text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Month</th><th className="py-2 pr-4 text-right font-medium">Orders</th>
              <th className="py-2 pr-4 text-right font-medium">Items</th><th className="py-2 pr-4 text-right font-medium">Gross sales</th>
              <th className="py-2 text-right font-medium">Royalty earned</th></tr></thead>
            <tbody>
              {perMonth.map((m) => (
                <tr key={m.label} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-4">{m.label}</td><td className="py-2 pr-4 text-right tabular-nums">{m.orders}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{m.items}</td><td className="py-2 pr-4 text-right tabular-nums">{peso(m.gross)}</td>
                  <td className="py-2 text-right tabular-nums">{peso(m.royalty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Rankings */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-serif text-base">Top stores by sales</CardTitle></CardHeader>
          <CardContent>
            <RankedBars format="peso" rows={stores.map((s) => ({
              label: names.get(s.key) ?? "Unknown store", value: s.gross,
              sub: `${s.orders} orders · royalty ${peso(s.royaltyEarned)}`, href: `/bao/sellers/${s.key}`,
            }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-serif text-base">Top products by sales</CardTitle></CardHeader>
          <CardContent>
            <RankedBars format="peso" rows={products.map((p) => ({ label: p.key, value: p.gross, sub: `${p.items} sold` }))} />
          </CardContent>
        </Card>
      </div>

      {/* Inventory movement + operations */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Package className="size-4 text-primary" />Units sold per month</CardTitle></CardHeader>
          <CardContent>
            <ColumnChart ariaLabel="Units sold per month" data={unitsOutPerMonth} />
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {[...movementTotals.entries()].map(([reason, total]) => (
                <div key={reason} className="rounded-lg bg-muted/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{MOVEMENT_LABELS[reason] ?? reason}</dt>
                  <dd className="font-semibold tabular-nums">{total > 0 ? `+${total}` : total} units</dd>
                </div>
              ))}
              {movementTotals.size === 0 && <p className="col-span-2 text-xs text-muted-foreground">No stock movement recorded yet (needs scripts/15_bao_bi.sql).</p>}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-serif text-base">Orders by status</CardTitle></CardHeader>
          <CardContent>
            <RankedBars rows={[...statusCounts.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => ({ label: statusDef(s).label, value: n }))} />
            <Link href="/bao/logs" className="mt-4 inline-block text-xs font-medium text-primary hover:underline">Open operational logs →</Link>
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
