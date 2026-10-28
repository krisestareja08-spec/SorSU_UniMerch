import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Coins, Handshake, Hourglass, Percent, Send } from "lucide-react"
import { EARNED_STATUSES, peso, ratesLabel, storeNames } from "@/lib/analytics"
import { getGlobalRoyaltyPercentage } from "@/lib/bao-settings"
import { formatDateTime } from "@/lib/admin"
import { formatOrderTime, statusDef } from "@/lib/order-status"
import type { DashboardCtx } from "@/lib/modules"
import { cn } from "@/lib/utils"
import { RemitRoyaltyForm } from "./remit-royalty-form"

type Line = {
  item_id: string; order_id: string; ordered_at: string; order_status: string; product_name: string
  quantity: number; unit_price: number; royalty_percentage: number | null; royalty_amount: number
  origin_store: string; origin_name: string | null; collab: boolean; remittance_id: string | null
  /** Sold by a Supply Office branch (the Main office pays its royalty); paid in full (remittable) */
  origin_branch?: boolean; fully_paid?: boolean
}

type Remittance = {
  id: string; amount: number; items_count: number; period_start: string | null; period_end: string | null
  breakdown: { product: string; rate: number | null; items: number; royalty: number; collab: boolean; branch?: boolean; store: string | null }[] | null
  method: string; reference_number: string | null; status: string; bao_note: string | null; created_at: string; reviewed_at: string | null
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-destructive/10 text-destructive",
}
const STATUS_LABEL: Record<string, string> = { pending: "Waiting for BAO", approved: "Approved", rejected: "Rejected" }

/**
 * Royalty a store owes BAO and its remittances. Royalty from PAID sales can be remitted with a
 * receipt; BAO approves it (the balance resets) or rejects it (the sales return to the balance).
 * The Main Supply Office also owes the royalty of organizations' collaboration products and of
 * everything its branches sell (they have no Royalty page of their own).
 */
export async function RoyaltyPage({ ctx }: { ctx: DashboardCtx }) {
  const supabase = await createClient()
  const storeId = ctx.storeId ?? ""
  const isOffice = ctx.module === "supply_office"

  const [linesRes, remittancesRes, rate, collabRes] = await Promise.all([
    supabase.rpc("royalty_lines", { p_store: storeId }),
    supabase.from("royalty_remittances")
      .select("id, amount, items_count, period_start, period_end, breakdown, method, reference_number, status, bao_note, created_at, reviewed_at")
      .eq("store_id", storeId).order("created_at", { ascending: false }).limit(30),
    getGlobalRoyaltyPercentage(),
    isOffice
      ? supabase.from("products").select("id, name, seller_id, price, royalty_amount, created_at")
        .eq("supply_office_collab", true).eq("status", "approved").order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: null, error: null }),
  ])

  // Database not updated yet (scripts/32_performance.sql adds remittances)
  if (linesRes.error) {
    return (
      <ManagementShell ctx={ctx}>
        <PageHeading title="Royalty" description="Royalty you owe BAO for official-logo products, and your remittances." />
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Royalty remittance isn&apos;t available yet ({linesRes.error.message}). Ask the admin to run <code>scripts/32_performance.sql</code> in Supabase.
        </p>
      </ManagementShell>
    )
  }

  const lines = (linesRes.data ?? []) as Line[]
  const remittances = (remittancesRes.data ?? []) as Remittance[]
  const collabProducts = (collabRes.data ?? []) as { id: string; name: string; seller_id: string; price: number; royalty_amount: number }[]
  const names = await storeNames(supabase, collabProducts.map((p) => p.seller_id))

  const open = lines.filter((l) => !l.remittance_id)
  // Fully paid sales are remittable (a partly paid pre-order waits for its balance)
  const paidInFull = (l: Line) => l.fully_paid ?? EARNED_STATUSES.includes(l.order_status)
  const remittable = open.filter(paidInFull)
  const notYetPaid = open.filter((l) => !paidInFull(l))
  // Main office: royalty owed per branch
  const byBranch = [...open.filter((l) => l.origin_branch).reduce((m, l) => {
    const k = l.origin_name ?? "Branch"
    const cur = m.get(k) ?? { lines: 0, royalty: 0 }
    m.set(k, { lines: cur.lines + 1, royalty: cur.royalty + Number(l.royalty_amount) * l.quantity })
    return m
  }, new Map<string, { lines: number; royalty: number }>())].sort((a, b) => b[1].royalty - a[1].royalty)
  const sum = (ls: Line[]) => ls.reduce((s, l) => s + Number(l.royalty_amount) * l.quantity, 0)
  const pending = remittances.find((r) => r.status === "pending")
  const approvedTotal = remittances.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.amount), 0)
  const balance = sum(remittable)

  const stats: Stat[] = [
    { label: "Royalty to remit", value: peso(balance), icon: Coins, hint: `${remittable.length} paid sale line${remittable.length === 1 ? "" : "s"}`, accent: "gold" },
    { label: "Not yet remittable", value: peso(sum(notYetPaid)), icon: Hourglass, hint: "Orders awaiting payment", accent: "primary" },
    { label: "Remitted (approved)", value: peso(approvedTotal), icon: Send, hint: pending ? `${peso(Number(pending.amount))} waiting for BAO` : "Approved by BAO", accent: "green" },
    { label: "Current royalty rate", value: `${rate}%`, icon: Percent, hint: "Set by BAO", accent: "primary" },
  ]

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading
        title="Royalty"
        description={`Official-logo products send a royalty to BAO on every sale. Remit the royalty of your paid sales with a receipt; once BAO approves it, your balance resets.${isOffice ? " The Main Supply Office also pays the royalty on everything its branches sell and on organizations' collaboration products." : ""}`}
      />
      <div className="mt-6"><StatGrid stats={stats} /></div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="font-serif text-base">Sales not yet remitted</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-130 text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Date</th><th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 text-right font-medium">Qty × price</th><th className="py-2 pr-3 text-right font-medium">Rate</th>
                <th className="py-2 pr-3 text-right font-medium">Royalty</th><th className="py-2 font-medium">Order</th></tr></thead>
              <tbody>
                {open.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No royalty to remit right now.</td></tr>}
                {open.map((l) => (
                  <tr key={l.item_id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{formatOrderTime(l.ordered_at)}</td>
                    <td className="py-2 pr-3">
                      {l.product_name}
                      {l.origin_branch
                        ? <span className="block text-[11px] text-primary">Branch · {l.origin_name ?? "Supply Office branch"}</span>
                        : l.collab && <span className="block text-[11px] text-amber-800 dark:text-gold">Collab · {l.origin_name ?? "organization"}</span>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{l.quantity} × {peso(Number(l.unit_price))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{ratesLabel(l.royalty_percentage != null ? [Number(l.royalty_percentage)] : [])}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums">{peso(Number(l.royalty_amount) * l.quantity)}</td>
                    <td className="py-2 text-xs">{paidInFull(l) ? "Paid" : statusDef(l.order_status).label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Send className="size-4 text-primary" />Remit to BAO</CardTitle></CardHeader>
          <CardContent>
            {pending ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Your remittance of <strong>{peso(Number(pending.amount))}</strong> sent {formatDateTime(pending.created_at)} is waiting for BAO&apos;s review.
                You can remit again once it is reviewed.
              </p>
            ) : balance <= 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to remit yet. Royalty becomes remittable once the order is paid.</p>
            ) : (
              <RemitRoyaltyForm storeId={storeId} amount={balance} />
            )}
          </CardContent>
        </Card>
      </div>

      {isOffice && byBranch.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Building2 className="size-4 text-primary" />Branch sales not yet remitted</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <ul className="divide-y divide-border">
              {byBranch.map(([name, b]) => (
                <li key={name} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">{b.lines} sale line{b.lines === 1 ? "" : "s"} · <strong className="text-foreground tabular-nums">{peso(b.royalty)}</strong> royalty</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {isOffice && (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base"><Handshake className="size-4 text-gold" />Collaboration products</CardTitle>
            <Link href="/supply-office/branch-inventory?tab=collab" className="text-xs font-medium text-primary hover:underline">Manage their stock</Link>
          </CardHeader>
          <CardContent className="text-sm">
            {collabProducts.length === 0 ? <p className="text-muted-foreground">No collaboration products are live.</p> : (
              <ul className="divide-y divide-border">
                {collabProducts.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <Link href={`/marketplace/product/${p.id}`} className="font-medium hover:text-primary hover:underline">{p.name}</Link>
                      <span className="ml-2 text-xs text-muted-foreground">{names.get(p.seller_id) ?? "Organization"}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{peso(Number(p.price))} · royalty {peso(Number(p.royalty_amount))} per unit, paid in its stock orders</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader><CardTitle className="font-serif text-base">Remittance history</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {remittances.length === 0 && <p className="text-muted-foreground">No remittances yet.</p>}
          {remittances.map((r) => (
            <details key={r.id} className="rounded-xl border border-border p-3 [&_summary]:list-none">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="tabular-nums">{peso(Number(r.amount))}</strong>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.items_count} line{r.items_count === 1 ? "" : "s"} · rate {ratesLabel([...new Set((r.breakdown ?? []).map((b) => Number(b.rate)).filter((n) => !Number.isNaN(n)))])} · sent {formatDateTime(r.created_at)}
                  </span>
                  {r.bao_note && <span className="block text-xs text-muted-foreground">BAO: {r.bao_note}</span>}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_STYLE[r.status])}>{STATUS_LABEL[r.status] ?? r.status}</span>
              </summary>
              <RemittanceBreakdown remittance={r} />
            </details>
          ))}
        </CardContent>
      </Card>
    </ManagementShell>
  )
}

/** Per product and rate — shared with BAO's review page. */
export function RemittanceBreakdown({ remittance: r }: { remittance: Pick<Remittance, "breakdown" | "period_start" | "period_end" | "method" | "reference_number"> }) {
  return (
    <div className="mt-3 overflow-x-auto border-t border-border pt-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Sales {r.period_start ? formatOrderTime(r.period_start) : "—"} → {r.period_end ? formatOrderTime(r.period_end) : "—"} ·
        {" "}{r.method === "bank" ? "Bank transfer" : "GCash"}{r.reference_number ? ` · ref ${r.reference_number}` : ""}
      </p>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
          <th className="py-1.5 pr-3 font-medium">Product</th><th className="py-1.5 pr-3 text-right font-medium">Rate</th>
          <th className="py-1.5 pr-3 text-right font-medium">Sold</th><th className="py-1.5 text-right font-medium">Royalty</th></tr></thead>
        <tbody>
          {(r.breakdown ?? []).map((b, i) => (
            <tr key={`${b.product}-${b.rate}-${i}`} className="border-b border-border/60 last:border-0">
              <td className="py-1.5 pr-3">
                {b.product}
                {b.branch
                  ? <span className="block text-[11px] text-primary">Branch · {b.store ?? "Supply Office branch"}</span>
                  : b.collab && <span className="block text-[11px] text-amber-800 dark:text-gold">Supply Office collab · {b.store ?? "organization"}</span>}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{b.rate != null ? `${Number(b.rate)}%` : "—"}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{b.items}</td>
              <td className="py-1.5 text-right tabular-nums">{peso(Number(b.royalty))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
