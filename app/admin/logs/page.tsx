import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { ACTION_LABELS, formatDateTime, profilesById } from "@/lib/admin"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"
import { cn } from "@/lib/utils"

/**
 * Activity Logs — user account management only: new sign-ups, verification submissions and the
 * admin's decisions on verifications, account status, identity changes and account reports.
 * (Organization, cashier branch and dashboard member activity is not shown here.)
 */
const CATEGORIES = [
  { key: "all",          label: "All" },
  { key: "signup",       label: "New Accounts" },
  { key: "submitted",    label: "Verification Requests" },
  { key: "verification", label: "Verification Decisions" },
  { key: "account",      label: "Account Status" },
  { key: "identity",     label: "Identity Changes" },
] as const
type CategoryKey = (typeof CATEGORIES)[number]["key"]

// Admin actions that concern user accounts (audit log action prefixes)
const ACCOUNT_ACTIONS: { category: CategoryKey; filter: string }[] = [
  { category: "verification", filter: "action.like.verification_%" },
  { category: "account",      filter: "action.like.account_%" },
  { category: "account",      filter: "action.eq.report_dismissed" },
  { category: "identity",     filter: "action.like.identity_change_%" },
]

type Entry = {
  id: string
  at: string
  category: CategoryKey
  action: string
  actorId: string | null
  userId: string | null
  requestId: string | null
  details: string | null
}

const LIMIT = 300

export default async function ActivityLogsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await requireDashboard("verification", "logs")
  const { type = "all" } = await searchParams
  const category = CATEGORIES.find((c) => c.key === type) ?? CATEGORIES[0]
  const want = (key: CategoryKey) => category.key === "all" || category.key === key
  const supabase = await createClient()

  const auditFilters = ACCOUNT_ACTIONS.filter((a) => want(a.category)).map((a) => a.filter)
  const [audit, signups, requests] = await Promise.all([
    auditFilters.length
      ? supabase.from("verification_audit_log")
          .select("id, actor_id, user_id, request_id, action, reason, created_at")
          .or(auditFilters.join(","))
          .order("created_at", { ascending: false })
          .limit(LIMIT)
      : null,
    want("signup")
      ? supabase.from("profiles").select("id, affiliation, created_at").order("created_at", { ascending: false }).limit(LIMIT)
      : null,
    want("submitted")
      ? supabase.from("verification_requests").select("id, user_id, created_at").order("created_at", { ascending: false }).limit(LIMIT)
      : null,
  ])

  const entries: Entry[] = [
    ...(audit?.data ?? []).map((l): Entry => ({
      id: `log-${l.id}`,
      at: l.created_at,
      category: l.action.startsWith("verification_") ? "verification" : l.action.startsWith("identity_change_") ? "identity" : "account",
      action: ACTION_LABELS[l.action] ?? l.action,
      actorId: l.actor_id,
      userId: l.user_id,
      requestId: l.request_id,
      details: l.reason,
    })),
    ...(signups?.data ?? []).filter((p) => p.created_at).map((p): Entry => ({
      id: `signup-${p.id}`,
      at: p.created_at as string,
      category: "signup",
      action: "New account created",
      actorId: null,
      userId: p.id,
      requestId: null,
      details: p.affiliation ? AFFILIATION_LABELS[p.affiliation as Affiliation] ?? p.affiliation : null,
    })),
    ...(requests?.data ?? []).map((r): Entry => ({
      id: `request-${r.id}`,
      at: r.created_at,
      category: "submitted",
      action: "Submitted verification documents",
      actorId: null,
      userId: r.user_id,
      requestId: r.id,
      details: null,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, LIMIT)

  const error = audit?.error ?? signups?.error ?? requests?.error
  const people = await profilesById(supabase, entries.flatMap((e) => [e.actorId, e.userId]))

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Activity Logs" description="User account activity — new accounts, verification requests and the decisions made on them, and account status changes." />

      <div className="mt-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link key={c.key} href={`/admin/logs?type=${c.key}`}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", category.key === c.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
            {c.label}
          </Link>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Some activity could not be loaded ({error.message}). Run <code>scripts/9_admin_modules.sql</code> in Supabase.
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-160 text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5 font-medium">Activity</th>
              <th className="px-4 py-2.5 font-medium">By</th>
              <th className="px-4 py-2.5 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && !error && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No activity recorded yet.</td></tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(e.at)}</td>
                <td className="px-4 py-2.5">
                  {e.userId ? <Link href={`/admin/users/${e.userId}`} className="text-primary hover:underline">{people.get(e.userId)?.full_name || "View user"}</Link> : "—"}
                  {e.requestId && <> · <Link href={`/admin/queue/${e.requestId}`} className="text-xs text-primary hover:underline">request</Link></>}
                </td>
                <td className="px-4 py-2.5 font-medium text-foreground">{e.action}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{e.actorId ? people.get(e.actorId)?.full_name ?? "Admin" : "The user"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{e.details || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ManagementShell>
  )
}
