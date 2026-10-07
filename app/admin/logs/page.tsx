import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { ACTION_LABELS, formatDateTime, profilesById } from "@/lib/admin"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  { key: "all",          label: "All",           prefix: "" },
  { key: "verification", label: "Verifications", prefix: "verification_" },
  { key: "account",      label: "Accounts",      prefix: "account_" },
  { key: "member",       label: "Members",       prefix: "member_" },
  { key: "main",         label: "Main Admins",   prefix: "main_admin" },
  { key: "seller",       label: "Organizations", prefix: "seller_" },
] as const

export default async function ActivityLogsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await requireDashboard("verification", "logs")
  const { type = "all" } = await searchParams
  const category = CATEGORIES.find((c) => c.key === type) ?? CATEGORIES[0]
  const supabase = await createClient()

  let query = supabase
    .from("verification_audit_log")
    .select("id, actor_id, user_id, request_id, action, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(300)
  if (category.prefix) query = query.like("action", `${category.prefix}%`)
  const { data, error } = await query
  const logs = data ?? []
  const people = await profilesById(supabase, logs.flatMap((l) => [l.actor_id, l.user_id]))

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Activity Logs" description="Every action taken in the Verification Admin dashboard — who did it, to whom, when and why." />

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
          Activity log is not available ({error.message}). Run <code>scripts/9_admin_modules.sql</code> in Supabase.
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-160 text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Admin</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && !error && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No activity recorded yet.</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(l.created_at)}</td>
                <td className="px-4 py-2.5">{people.get(l.actor_id ?? "")?.full_name ?? "Admin"}</td>
                <td className="px-4 py-2.5 font-medium text-foreground">{ACTION_LABELS[l.action] ?? l.action}</td>
                <td className="px-4 py-2.5">
                  {l.user_id ? <Link href={`/admin/users/${l.user_id}`} className="text-primary hover:underline">{people.get(l.user_id)?.full_name ?? "View user"}</Link> : "—"}
                  {l.request_id && <> · <Link href={`/admin/queue/${l.request_id}`} className="text-xs text-primary hover:underline">request</Link></>}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ManagementShell>
  )
}
