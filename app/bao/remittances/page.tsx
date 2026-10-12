import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { CheckCircle2, ExternalLink, HandCoins, XCircle } from "lucide-react"
import { reviewRoyaltyRemittance } from "../actions"
import { peso, storeNames } from "@/lib/analytics"
import { formatDateTime, profilesById } from "@/lib/admin"
import { RemittanceBreakdown } from "@/components/store/royalty-page"
import { cn } from "@/lib/utils"
import { ActionForm } from "@/components/ui/action-form"

const TABS = [
  { key: "pending", label: "To review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const

type Remittance = {
  id: string; store_id: string; amount: number; items_count: number; period_start: string | null; period_end: string | null
  breakdown: { product: string; rate: number | null; items: number; gross: number; royalty: number; collab: boolean; store: string | null }[] | null
  method: string; receipt_url: string; reference_number: string | null; notes: string | null; status: string
  submitted_by: string | null; bao_note: string | null; created_at: string; reviewed_at: string | null
}

/** Royalty remittances sent by stores. Approving resets the store's royalty balance. */
export default async function BaoRemittancesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireDashboard("bao", "royalty")
  const { tab = "pending" } = await searchParams
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]
  const supabase = await createClient()

  const { data, error } = await supabase.from("royalty_remittances").select("*")
    .eq("status", active.key).order("created_at", { ascending: false }).limit(200)
  const remittances = (data ?? []) as Remittance[]
  const [names, people] = await Promise.all([
    storeNames(supabase, remittances.map((r) => r.store_id)),
    profilesById(supabase, remittances.map((r) => r.submitted_by)),
  ])

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Royalty Remittances" description="Stores remit the royalty of their paid sales with a receipt. Check the payment, then approve (the store's balance resets) or reject (the sales return to its balance)." />

      <div className="mt-5 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {TABS.map((t) => (
          <Link key={t.key} href={`/bao/remittances?tab=${t.key}`}
            className={cn("flex-1 rounded-lg py-1.5 text-center text-sm font-medium", active.key === t.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">Remittances aren&apos;t available yet ({error.message}). Run <code>scripts/32_performance.sql</code>.</p>}

      <div className="mt-4 space-y-3">
        {remittances.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            <HandCoins className="mx-auto mb-2 size-8 text-muted-foreground/40" />No remittances here.
          </div>
        )}
        {remittances.map((r) => (
          <details key={r.id} open={active.key === "pending"} className="rounded-2xl border border-border bg-card p-4 [&_summary]:list-none">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  <Link href={`/bao/sellers/${r.store_id}`} className="hover:text-primary hover:underline">{names.get(r.store_id) ?? "Unknown store"}</Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.items_count} sale line{r.items_count === 1 ? "" : "s"} · sent {formatDateTime(r.created_at)} by {people.get(r.submitted_by ?? "")?.full_name ?? "store staff"}
                  {r.reviewed_at && ` · reviewed ${formatDateTime(r.reviewed_at)}`}
                </p>
              </div>
              <strong className="font-serif text-lg tabular-nums text-amber-700 dark:text-gold">{peso(Number(r.amount))}</strong>
            </summary>

            <div className="mt-2 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <RemittanceBreakdown remittance={r} />
              <div className="space-y-3 pt-3 text-sm">
                <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                  <ExternalLink className="size-4" />View payment receipt
                </a>
                {r.notes && <p className="rounded-lg bg-muted/40 p-3"><span className="text-xs text-muted-foreground">Store notes: </span>{r.notes}</p>}
                {r.bao_note && <p className="rounded-lg bg-primary/5 p-3"><span className="text-xs text-muted-foreground">BAO note: </span>{r.bao_note}</p>}
                {r.status === "pending" && (
                  <ActionForm action={reviewRoyaltyRemittance} className="space-y-2">
                    <input type="hidden" name="remittance_id" value={r.id} />
                    <input name="note" placeholder="Note to the store (required to reject)" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" />
                    <div className="flex gap-2">
                      <button name="decision" value="approved" className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700">
                        <CheckCircle2 className="size-4" />Approve — paid
                      </button>
                      <button name="decision" value="rejected" className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10">
                        <XCircle className="size-4" />Reject
                      </button>
                    </div>
                  </ActionForm>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>
    </ManagementShell>
  )
}
