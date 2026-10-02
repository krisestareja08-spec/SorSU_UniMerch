import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { AlertTriangle, ChevronRight, FileText, ShieldCheck } from "lucide-react"
import { findDuplicateGroups, formatDateTime } from "@/lib/admin"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "pending",  label: "Pending",  statuses: ["pending", "under_review"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "declined", label: "Declined", statuses: ["rejected", "needs_resubmission"] },
] as const

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  under_review: "bg-primary/10 text-primary",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected: "bg-destructive/10 text-destructive",
  needs_resubmission: "bg-muted text-muted-foreground",
}

export default async function VerificationQueuePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireDashboard("verification", "queue")
  const { tab = "pending" } = await searchParams
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]
  const supabase = await createClient()

  const [{ data, error }, duplicates] = await Promise.all([
    supabase
      .from("verification_requests")
      .select("id, user_id, full_name, student_employee_id, department, claimed_affiliation, document_url, cor_url, status, created_at")
      .in("status", [...active.statuses])
      .order("created_at", { ascending: active.key === "pending" })
      .limit(200),
    findDuplicateGroups(supabase).catch(() => []),
  ])
  const requests = data ?? []
  const duplicateIds = new Set(duplicates.map((d) => d.idNumber))

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Verification Queue" description="Click a request to review the user's full profile and uploaded documents, then approve or decline." />

      <div className="mt-5 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/queue?tab=${t.key}`}
            className={cn("flex-1 rounded-lg py-1.5 text-center text-sm font-medium transition-colors", active.key === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Could not load requests ({error.message}). Run <code>scripts/7_verification_apply.sql</code> in Supabase.
        </p>
      )}

      <div className="mt-4 space-y-2">
        {requests.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            <ShieldCheck className="mx-auto mb-2 size-8 text-muted-foreground/40" />
            No {active.label.toLowerCase()} requests.
          </div>
        )}
        {requests.map((r) => (
          <Link key={r.id} href={`/admin/queue/${r.id}`}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {r.full_name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                {r.full_name}
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", STATUS_STYLES[r.status])}>{r.status.replace(/_/g, " ")}</span>
                {duplicateIds.has(r.student_employee_id?.trim()) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    <AlertTriangle className="size-3" /> Duplicate I.D.
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {AFFILIATION_LABELS[r.claimed_affiliation as Affiliation] ?? r.claimed_affiliation} · I.D. {r.student_employee_id} · {r.department || "No department"}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="size-3" />
                {[r.document_url && "I.D.", r.cor_url && "COR"].filter(Boolean).join(" + ") || "No files"} · Submitted {formatDateTime(r.created_at)}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
          </Link>
        ))}
      </div>
    </ManagementShell>
  )
}
