import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { VerifiedBadge } from "@/components/verified-badge"
import { Ban, CheckCircle2, Flag, PauseCircle } from "lucide-react"
import { resolveAccountReport } from "../verification-actions"
import { formatDateTime, profilesById } from "@/lib/admin"
import { cn } from "@/lib/utils"

const REASON_LABELS: Record<string, string> = {
  dummy_account: "Dummy / fake account",
  fake_identity: "Identity doesn't match I.D.",
  no_show: "Repeated no-show / unpaid orders",
  abusive: "Abusive behaviour",
  other: "Other",
}

const TABS = [
  { key: "open", label: "Open" },
  { key: "actioned", label: "Suspended / banned" },
  { key: "dismissed", label: "Dismissed" },
] as const

type ReportRow = {
  id: string; reported_user: string; reporter_id: string; store_id: string | null; order_id: string | null
  reason: string; details: string | null; status: string; created_at: string
  seller_profiles: { org_name: string } | null
}

/** Accounts reported by sellers (e.g. dummy accounts). The Verification Admin can suspend or ban them. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireDashboard("verification", "reports")
  const { tab = "open" } = await searchParams
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("account_reports")
    .select("id, reported_user, reporter_id, store_id, order_id, reason, details, status, created_at, seller_profiles(org_name)")
    .eq("status", active.key)
    .order("created_at", { ascending: false })
    .limit(200)
  const reports = (data ?? []) as unknown as ReportRow[]
  const people = await profilesById(supabase, reports.flatMap((r) => [r.reported_user, r.reporter_id]))

  // Number of reports per account (repeat offenders)
  const counts = new Map<string, number>()
  if (reports.length) {
    const { data: all } = await supabase.from("account_reports").select("reported_user").in("reported_user", [...new Set(reports.map((r) => r.reported_user))])
    for (const r of all ?? []) counts.set(r.reported_user, (counts.get(r.reported_user) ?? 0) + 1)
  }

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading
        title="Reported Accounts"
        description="Buyers reported by sellers, e.g. dummy or fake accounts. Reported accounts are flagged automatically; review the profile, then dismiss, suspend or ban."
      />

      <div className="mt-5 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/reports?tab=${t.key}`}
            className={cn("flex-1 rounded-lg py-1.5 text-center text-sm font-medium", active.key === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Reports aren&apos;t available yet ({error.message}). Run <code>scripts/12_profile_rules.sql</code> in Supabase.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {reports.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            <Flag className="mx-auto mb-2 size-8 text-muted-foreground/40" />No {active.label.toLowerCase()} reports.
          </div>
        )}
        {reports.map((r) => {
          const user = people.get(r.reported_user)
          const reporter = people.get(r.reporter_id)
          return (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    <Link href={`/admin/users/${r.reported_user}`} className="hover:text-primary hover:underline">{user?.full_name || "Unnamed user"}</Link>
                    <VerifiedBadge verified={user?.is_identity_verified} affiliation={user?.affiliation} />
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-destructive">{user?.account_status ?? "active"}</span>
                    {(counts.get(r.reported_user) ?? 0) > 1 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{counts.get(r.reported_user)} reports</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm"><strong>{REASON_LABELS[r.reason] ?? r.reason}</strong>{r.details ? ` — ${r.details}` : ""}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reported by {reporter?.full_name ?? "store staff"}{r.seller_profiles ? ` of ${r.seller_profiles.org_name}` : ""}
                    {r.order_id ? ` · order #${r.order_id.slice(0, 8)}` : ""} · {formatDateTime(r.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Profile: I.D. {user?.student_employee_id || "—"} · {user?.department || "no department"} · {user?.contact || "no contact"}
                  </p>
                </div>

                {r.status === "open" && (
                  <form action={resolveAccountReport} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="report_id" value={r.id} />
                    <input name="note" placeholder="Note (optional)" className="h-8 w-40 rounded-lg border border-input bg-background px-2 text-xs" />
                    <button name="decision" value="dismiss" className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted">
                      <CheckCircle2 className="size-3.5" />Dismiss
                    </button>
                    <button name="decision" value="suspend" className="inline-flex h-8 items-center gap-1 rounded-lg border border-destructive/30 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10">
                      <PauseCircle className="size-3.5" />Suspend
                    </button>
                    <button name="decision" value="ban" className="inline-flex h-8 items-center gap-1 rounded-lg bg-destructive px-3 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90">
                      <Ban className="size-3.5" />Ban account
                    </button>
                  </form>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </ManagementShell>
  )
}
