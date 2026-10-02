import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColumnChart } from "@/components/analytics/charts"
import { Coins, Hourglass, Percent, Receipt } from "lucide-react"
import { EARNED_STATUSES, byMonth, groupBy, loadSales, peso, storeNames } from "@/lib/analytics"
import { getGlobalRoyaltyPercentage } from "@/lib/bao-settings"
import { formatOrderTime, statusDef } from "@/lib/order-status"

/**
 * Royalty = BAO income. Every sale of an official-logo product sends its royalty to BAO
 * (deducted from the seller's earnings, like a tax). Shown here in pesos, in real time.
 */
export default async function RoyaltyPage() {
  const ctx = await requireDashboard("bao", "royalty")
  const supabase = await createClient()
  const [allLines, percentage] = await Promise.all([loadSales(supabase), getGlobalRoyaltyPercentage()])
  const lines = allLines.filter((l) => l.royaltyPerUnit > 0)

  const earned = lines.filter((l) => EARNED_STATUSES.includes(l.status)).reduce((s, l) => s + l.royaltyPerUnit * l.quantity, 0)
  const pending = lines.filter((l) => !EARNED_STATUSES.includes(l.status)).reduce((s, l) => s + l.royaltyPerUnit * l.quantity, 0)
  const logoSales = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const perMonth = byMonth(lines, 12)
  const perStore = groupBy(lines, (l) => l.storeId)
  const perProduct = groupBy(lines, (l) => l.productName).slice(0, 10)
  const names = await storeNames(supabase, perStore.map((s) => s.key))
  const recent = [...lines].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 15)

  const stats: Stat[] = [
    { label: "Royalty earned", value: peso(earned), icon: Coins, hint: "From paid / completed orders", accent: "gold" },
    { label: "Pending royalty", value: peso(pending), icon: Hourglass, hint: "Orders awaiting payment", accent: "primary" },
    { label: "Official-logo sales", value: peso(logoSales), icon: Receipt, hint: `${lines.reduce((n, l) => n + l.quantity, 0)} items`, accent: "green" },
    { label: "Current royalty rate", value: `${percentage}%`, icon: Percent, hint: "Set in Royalty Settings", accent: "primary" },
  ]

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading
        title="Royalty Earnings"
        description="Royalty from official-logo products goes to BAO, like a tax on each sale. Amounts are in pesos and update as orders are paid."
      />
      <div className="mt-6"><StatGrid stats={stats} /></div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="font-serif text-base">Royalty earned per month (last 12 months)</CardTitle></CardHeader>
        <CardContent><ColumnChart ariaLabel="Royalty earned per month" format="peso" data={perMonth.map((m) => ({ label: m.label, value: m.royalty }))} /></CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-serif text-base">Royalty by store</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Store</th><th className="py-2 pr-3 text-right font-medium">Logo sales</th>
                <th className="py-2 pr-3 text-right font-medium">Earned</th><th className="py-2 text-right font-medium">Pending</th></tr></thead>
              <tbody>
                {perStore.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No official-logo sales yet.</td></tr>}
                {perStore.map((s) => (
                  <tr key={s.key} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3"><Link href={`/bao/sellers/${s.key}`} className="font-medium hover:text-primary hover:underline">{names.get(s.key) ?? "Unknown store"}</Link></td>
                    <td className="py-2 pr-3 text-right tabular-nums">{peso(s.gross)}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums">{peso(s.royaltyEarned)}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{peso(s.royaltyPending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-serif text-base">Royalty by product</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Product</th><th className="py-2 pr-3 text-right font-medium">Sold</th>
                <th className="py-2 text-right font-medium">Earned</th></tr></thead>
              <tbody>
                {perProduct.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">No official-logo sales yet.</td></tr>}
                {perProduct.map((p) => (
                  <tr key={p.key} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3">{p.key}</td><td className="py-2 pr-3 text-right tabular-nums">{p.items}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{peso(p.royaltyEarned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="font-serif text-base">Latest royalty-bearing sales</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-140 text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3 font-medium">When</th><th className="py-2 pr-3 font-medium">Store</th><th className="py-2 pr-3 font-medium">Product</th>
              <th className="py-2 pr-3 text-right font-medium">Qty × price</th><th className="py-2 pr-3 text-right font-medium">Royalty</th><th className="py-2 font-medium">Status</th></tr></thead>
            <tbody>
              {recent.map((l, i) => (
                <tr key={l.orderId + i} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{formatOrderTime(l.createdAt)}</td>
                  <td className="py-2 pr-3">{names.get(l.storeId) ?? "—"}</td>
                  <td className="py-2 pr-3">{l.productName}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{l.quantity} × {peso(l.unitPrice)}</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">{peso(l.royaltyPerUnit * l.quantity)}</td>
                  <td className="py-2 text-xs">{EARNED_STATUSES.includes(l.status) ? "Earned" : `Pending · ${statusDef(l.status).label}`}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No royalty-bearing sales yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </ManagementShell>
  )
}
