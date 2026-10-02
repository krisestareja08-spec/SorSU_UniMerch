import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { CheckCircle2, FileText, Flag } from "lucide-react"
import { reviewSalesReport } from "../actions"
import { peso, storeNames } from "@/lib/analytics"
import { formatDateTime, profilesById } from "@/lib/admin"
import { MODULES, type ModuleKey } from "@/lib/modules"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "submitted", label: "To review" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "flagged", label: "Flagged" },
] as const

type Report = {
  id: string; store_id: string; module: ModuleKey; period_start: string; period_end: string
  orders_count: number; items_sold: number; gross_sales: number; royalty_due: number; net_sales: number
  breakdown: { product: string; items: number; gross: number; royalty: number }[] | null
  notes: string | null; submitted_by: string | null; status: string; bao_note: string | null; created_at: string
}

/** Sales reports sent to BAO by sellers, the Cashier and the Supply Office. */
export default async function BaoReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; open?: string }> }) {
  const ctx = await requireDashboard("bao", "reports")
  const { tab = "submitted", open } = await searchParams
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]
  const supabase = await createClient()

  let query = supabase.from("sales_reports").select("*").order("created_at", { ascending: false }).limit(200)
  query = open ? query.eq("id", open) : query.eq("status", active.key)
  const { data, error } = await query
  const reports = (data ?? []) as Report[]
  const [names, people] = await Promise.all([
    storeNames(supabase, reports.map((r) => r.store_id)),
    profilesById(supabase, reports.map((r) => r.submitted_by)),
  ])

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Sales Reports" description="Reports submitted by stores (organizations, Cashier, Supply Office). Figures are computed from recorded orders; acknowledge or flag each one." />

      <div className="mt-5 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {TABS.map((t) => (
          <Link key={t.key} href={`/bao/reports?tab=${t.key}`}
            className={cn("flex-1 rounded-lg py-1.5 text-center text-sm font-medium", !open && active.key === t.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">Reports aren&apos;t available yet ({error.message}). Run <code>scripts/15_bao_bi.sql</code>.</p>}

      <div className="mt-4 space-y-3">
        {reports.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-2 size-8 text-muted-foreground/40" />No reports here.
          </div>
        )}
        {reports.map((r) => (
          <details key={r.id} open={!!open} className="rounded-2xl border border-border bg-card p-4 [&_summary]:list-none">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  <Link href={`/bao/sellers/${r.store_id}`} className="hover:text-primary hover:underline">{names.get(r.store_id) ?? "Unknown store"}</Link>
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{MODULES[r.module]?.name}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.period_start} → {r.period_end} · submitted {formatDateTime(r.created_at)} by {people.get(r.submitted_by ?? "")?.full_name ?? "store staff"}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>Sales <strong className="tabular-nums">{peso(Number(r.gross_sales))}</strong></span>
                <span>Royalty <strong className="tabular-nums text-amber-700 dark:text-gold">{peso(Number(r.royalty_due))}</strong></span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                  r.status === "acknowledged" ? "bg-emerald-100 text-emerald-700" : r.status === "flagged" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-800")}>{r.status}</span>
              </div>
            </summary>

            <div className="mt-4 grid gap-4 border-t border-border pt-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Product</th><th className="py-1.5 pr-3 text-right font-medium">Sold</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Sales</th><th className="py-1.5 text-right font-medium">Royalty</th></tr></thead>
                  <tbody>
                    {(r.breakdown ?? []).map((b) => (
                      <tr key={b.product} className="border-b border-border/60 last:border-0">
                        <td className="py-1.5 pr-3">{b.product}</td><td className="py-1.5 pr-3 text-right tabular-nums">{b.items}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{peso(b.gross)}</td><td className="py-1.5 text-right tabular-nums">{peso(b.royalty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 text-sm">
                <dl className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/40 px-3 py-2"><dt className="text-xs text-muted-foreground">Orders</dt><dd className="font-semibold">{r.orders_count}</dd></div>
                  <div className="rounded-lg bg-muted/40 px-3 py-2"><dt className="text-xs text-muted-foreground">Items sold</dt><dd className="font-semibold">{r.items_sold}</dd></div>
                  <div className="rounded-lg bg-muted/40 px-3 py-2"><dt className="text-xs text-muted-foreground">Gross sales</dt><dd className="font-semibold">{peso(Number(r.gross_sales))}</dd></div>
                  <div className="rounded-lg bg-muted/40 px-3 py-2"><dt className="text-xs text-muted-foreground">Store net</dt><dd className="font-semibold">{peso(Number(r.net_sales))}</dd></div>
                </dl>
                {r.notes && <p className="rounded-lg bg-muted/40 p-3"><span className="text-xs text-muted-foreground">Store notes: </span>{r.notes}</p>}
                {r.bao_note && <p className="rounded-lg bg-primary/5 p-3"><span className="text-xs text-muted-foreground">BAO note: </span>{r.bao_note}</p>}
                {r.status === "submitted" && (
                  <form action={reviewSalesReport} className="space-y-2">
                    <input type="hidden" name="report_id" value={r.id} />
                    <input name="note" placeholder="Note to the store (optional)" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" />
                    <div className="flex gap-2">
                      <button name="decision" value="acknowledged" className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700">
                        <CheckCircle2 className="size-4" />Acknowledge
                      </button>
                      <button name="decision" value="flagged" className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10">
                        <Flag className="size-4" />Flag
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>
    </ManagementShell>
  )
}
