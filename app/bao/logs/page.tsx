import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { ACTION_LABELS, formatDateTime, profilesById } from "@/lib/admin"
import { peso, storeNames } from "@/lib/analytics"
import { statusDef } from "@/lib/order-status"
import { cn } from "@/lib/utils"

const SOURCES = [
  { key: "all", label: "All" },
  { key: "admin", label: "Admin actions" },
  { key: "orders", label: "Order status" },
  { key: "inventory", label: "Inventory" },
  { key: "reports", label: "Sales reports" },
] as const

type Entry = { at: string; source: string; actor: string | null; text: string; href?: string }

const MOVEMENT_TEXT: Record<string, string> = {
  sale: "sold", restock: "restocked", cancellation: "returned to stock (cancelled order)", adjustment: "adjusted", initial: "initial stock",
}

/** One operational timeline for transparency: admin actions, order status changes, stock movement, reports. */
export default async function OperationalLogsPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const ctx = await requireDashboard("bao", "logs")
  const { source = "all" } = await searchParams
  const supabase = await createClient()
  const want = (s: string) => source === "all" || source === s

  const [audit, history, movements, reports] = await Promise.all([
    want("admin") ? supabase.from("verification_audit_log").select("actor_id, action, reason, created_at").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    want("orders") ? supabase.from("order_status_history").select("order_id, status, changed_by, created_at").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    want("inventory") ? supabase.from("inventory_movements").select("store_id, product_name, change, reason, created_by, created_at").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    want("reports") ? supabase.from("sales_reports").select("id, store_id, gross_sales, period_start, period_end, submitted_by, created_at").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
  ])

  const a = (audit.data ?? []) as { actor_id: string | null; action: string; reason: string | null; created_at: string }[]
  const h = (history.data ?? []) as { order_id: string; status: string; changed_by: string | null; created_at: string }[]
  const m = (movements.data ?? []) as { store_id: string; product_name: string | null; change: number; reason: string; created_by: string | null; created_at: string }[]
  const r = (reports.data ?? []) as { id: string; store_id: string; gross_sales: number; period_start: string; period_end: string; submitted_by: string | null; created_at: string }[]

  const [people, stores] = await Promise.all([
    profilesById(supabase, [...a.map((x) => x.actor_id), ...h.map((x) => x.changed_by), ...m.map((x) => x.created_by), ...r.map((x) => x.submitted_by)]),
    storeNames(supabase, [...m.map((x) => x.store_id), ...r.map((x) => x.store_id)]),
  ])
  const who = (id: string | null) => (id ? people.get(id)?.full_name ?? "Staff" : "System")

  const entries: Entry[] = [
    ...a.map((x) => ({ at: x.created_at, source: "Admin", actor: who(x.actor_id), text: `${ACTION_LABELS[x.action] ?? x.action}${x.reason ? ` — ${x.reason}` : ""}` })),
    ...h.map((x) => ({ at: x.created_at, source: "Order", actor: who(x.changed_by), text: `Order #${x.order_id.slice(0, 8).toUpperCase()} → ${statusDef(x.status).label}` })),
    ...m.map((x) => ({ at: x.created_at, source: "Inventory", actor: who(x.created_by), text: `${stores.get(x.store_id) ?? "Store"}: ${x.product_name ?? "product"} ${MOVEMENT_TEXT[x.reason] ?? x.reason} (${x.change > 0 ? "+" : ""}${x.change})` })),
    ...r.map((x) => ({ at: x.created_at, source: "Report", actor: who(x.submitted_by), text: `${stores.get(x.store_id) ?? "Store"} submitted a sales report (${x.period_start} → ${x.period_end}, ${peso(Number(x.gross_sales))})`, href: `/bao/reports?open=${x.id}` })),
  ].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 200)

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Operational Logs" description="A single timeline of what happens across the marketplace — admin actions, order status changes, stock movement and submitted reports." />

      <div className="mt-5 flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <Link key={s.key} href={`/bao/logs?source=${s.key}`}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", source === s.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
            {s.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-160 text-sm">
          <thead><tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">When</th><th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">By</th><th className="px-4 py-2.5 font-medium">What happened</th></tr></thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No activity recorded yet.</td></tr>}
            {entries.map((e, i) => (
              <tr key={e.at + i} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(e.at)}</td>
                <td className="px-4 py-2.5"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{e.source}</span></td>
                <td className="px-4 py-2.5">{e.actor}</td>
                <td className="px-4 py-2.5">{e.href ? <Link href={e.href} className="hover:text-primary hover:underline">{e.text}</Link> : e.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ManagementShell>
  )
}
