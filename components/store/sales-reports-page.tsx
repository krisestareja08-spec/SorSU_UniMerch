import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColumnChart } from "@/components/analytics/charts"
import { Coins, Send, ShoppingCart, Store, Package } from "lucide-react"
import { submitSalesReport } from "@/app/store-actions"
import { byMonth, groupBy, loadSales, parseDay, peso, totals } from "@/lib/analytics"
import { formatDateTime } from "@/lib/admin"
import type { DashboardCtx } from "@/lib/modules"
import { cn } from "@/lib/utils"

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Sales report for a store (organization, Cashier or Supply Office): pick a period, review the
 * figures computed from recorded orders, and send the report to the Business Affairs Office.
 */
export async function SalesReportsPage({ ctx, from: fromRaw, to: toRaw }: { ctx: DashboardCtx; from?: string; to?: string }) {
  const supabase = await createClient()
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const from = parseDay(fromRaw) ?? defaultFrom
  const to = parseDay(toRaw, true) ?? now
  const fromValue = isoDay(from)
  const toValue = isoDay(to)

  const [lines, allLines, { data: past }] = await Promise.all([
    loadSales(supabase, { storeId: ctx.storeId, from, to }),
    loadSales(supabase, { storeId: ctx.storeId, from: new Date(now.getFullYear(), now.getMonth() - 5, 1) }),
    supabase.from("sales_reports").select("id, period_start, period_end, gross_sales, royalty_due, status, bao_note, created_at").eq("store_id", ctx.storeId ?? "").order("created_at", { ascending: false }).limit(20),
  ])
  const t = totals(lines)
  const products = groupBy(lines, (l) => l.productName)
  const months = byMonth(allLines, 6)

  const stats: Stat[] = [
    { label: "Gross sales", value: peso(t.gross), icon: ShoppingCart, hint: `${t.orders} orders`, accent: "primary" },
    { label: "Items sold", value: t.itemsSold, icon: Package, hint: "In this period", accent: "green" },
    { label: "Royalty to BAO", value: peso(t.royaltyEarned + t.royaltyPending), icon: Coins, hint: "Official-logo items", accent: "gold" },
    { label: "Your net", value: peso(t.net), icon: Store, hint: "Sales minus royalty", accent: "primary" },
  ]

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Sales Reports" description="Review your sales for a period and send the report to the Business Affairs Office (BAO). Figures come straight from your recorded orders." />

      <form className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">From</span>
          <input type="date" name="from" defaultValue={fromValue} className="h-9 rounded-lg border border-input bg-background px-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">To</span>
          <input type="date" name="to" defaultValue={toValue} className="h-9 rounded-lg border border-input bg-background px-2 text-sm" />
        </label>
        <button type="submit" className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Show period</button>
      </form>

      <div className="mt-5"><StatGrid stats={stats} /></div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="font-serif text-base">Sales by product ({fromValue} → {toValue})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Product</th><th className="py-2 pr-3 text-right font-medium">Sold</th>
                <th className="py-2 pr-3 text-right font-medium">Sales</th><th className="py-2 text-right font-medium">Royalty</th></tr></thead>
              <tbody>
                {products.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No sales in this period.</td></tr>}
                {products.map((p) => (
                  <tr key={p.key} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3">{p.key}</td><td className="py-2 pr-3 text-right tabular-nums">{p.items}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{peso(p.gross)}</td>
                    <td className="py-2 text-right tabular-nums">{peso(p.royaltyEarned + p.royaltyPending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Send className="size-4 text-primary" />Send to BAO</CardTitle></CardHeader>
          <CardContent>
            <form action={submitSalesReport} className="space-y-3">
              <input type="hidden" name="module" value={ctx.module} />
              <input type="hidden" name="from" value={fromValue} />
              <input type="hidden" name="to" value={toValue} />
              <p className="text-sm text-muted-foreground">
                Period <strong className="text-foreground">{fromValue} → {toValue}</strong>: {t.orders} orders, {peso(t.gross)} sales,
                {" "}{peso(t.royaltyEarned + t.royaltyPending)} royalty.
              </p>
              <textarea name="notes" rows={3} placeholder="Notes for BAO (optional)"
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <button type="submit" className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <Send className="size-4" />Submit report to BAO
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="font-serif text-base">Sales per month (last 6 months)</CardTitle></CardHeader>
        <CardContent><ColumnChart ariaLabel="Sales per month" format="peso" data={months.map((m) => ({ label: m.label, value: m.gross }))} /></CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="font-serif text-base">Submitted reports</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {(past ?? []).length === 0 ? <p className="text-muted-foreground">No reports submitted yet.</p> : (
            <ul className="divide-y divide-border">
              {(past ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {r.period_start} → {r.period_end} · {peso(Number(r.gross_sales))} · royalty {peso(Number(r.royalty_due))}
                    <span className="ml-2 text-xs text-muted-foreground">sent {formatDateTime(r.created_at)}</span>
                    {r.bao_note && <span className="block text-xs text-muted-foreground">BAO: {r.bao_note}</span>}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                    r.status === "acknowledged" ? "bg-emerald-100 text-emerald-700" : r.status === "flagged" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-800")}>
                    {r.status === "submitted" ? "Waiting for BAO" : r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </ManagementShell>
  )
}
