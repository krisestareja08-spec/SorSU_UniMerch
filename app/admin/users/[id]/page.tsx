import Link from "next/link"
import { notFound } from "next/navigation"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfileDetails } from "@/components/admin/profile-details"
import { DeleteUserButton } from "@/components/admin/delete-user-button"
import { ArrowLeft, Building2, Crown, History, ClipboardList, ShieldCheck, UserX } from "lucide-react"
import { updateAccountStatus } from "../../verification-actions"
import { ACTION_LABELS, formatDateTime, profilesById } from "@/lib/admin"
import { MODULES, type ModuleKey } from "@/lib/modules"
import { ActionForm } from "@/components/ui/action-form"

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full name", role: "Role", affiliation: "Affiliation", student_employee_id: "I.D. number",
  department: "Department", campus: "Campus", contact: "Contact number", birthday: "Birthday",
  account_status: "Account status", verification_status: "Verification status", is_identity_verified: "Verified",
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireDashboard("verification", "users")
  const supabase = await createClient()

  const users = await profilesById(supabase, [id])
  const user = users.get(id)
  if (!user) notFound()

  const [changes, logs, requests, memberships] = await Promise.all([
    supabase.from("profile_change_log").select("id, changed_by, field, old_value, new_value, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("verification_audit_log").select("id, actor_id, action, reason, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("verification_requests").select("id, status, claimed_affiliation, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("dashboard_members").select("is_main, permissions, dashboards(id, module, name)").eq("user_id", id),
  ])
  const dashboardsOfUser = ((memberships.data ?? []) as unknown as { is_main: boolean; permissions: string[] | null; dashboards: { id: string; module: ModuleKey; name: string } | null }[])
    .filter((m) => m.dashboards)
  const people = await profilesById(supabase, [
    ...(changes.data ?? []).map((c) => c.changed_by),
    ...(logs.data ?? []).map((l) => l.actor_id),
  ])
  const who = (actorId: string | null) =>
    !actorId ? "System" : actorId === id ? "User" : people.get(actorId)?.full_name ?? "Admin"

  return (
    <ManagementShell ctx={ctx}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href="/admin/users"><ArrowLeft className="size-4" />Back to users</Link>
      </Button>
      <PageHeading title={user.full_name || "Unnamed user"} description="Full profile, account standing, dashboard memberships and change history." />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <ProfileDetails profile={user} />

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="font-serif text-base">Account controls</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ActionForm action={updateAccountStatus} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="user_id" value={user.id} />
                <label className="w-28 text-muted-foreground" htmlFor="status">Account</label>
                <select id="status" name="status" defaultValue={user.account_status ?? "active"} className="h-8 flex-1 rounded-lg border border-input bg-background px-2 text-xs">
                  <option value="active">Active</option>
                  <option value="flagged">Flagged</option>
                  <option value="suspended">Suspended</option>
                  <option value="banned">Banned</option>
                </select>
                <input name="reason" placeholder="Reason" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs sm:w-auto sm:flex-1" />
                <button type="submit" className="inline-flex h-8 items-center gap-1 rounded-lg border border-destructive/30 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10">
                  <UserX className="size-3" /> Apply
                </button>
              </ActionForm>
              {user.id !== ctx.userId && (
                <div className="border-t border-border pt-4">
                  <p className="mb-2 text-xs text-muted-foreground">
                    <strong className="text-destructive">Delete account</strong> — permanently erases this user&apos;s login and all their data. This cannot be undone.
                  </p>
                  <DeleteUserButton userId={user.id} name={user.full_name || "this user"} withReason />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Building2 className="size-4 text-primary" />Dashboard memberships</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {dashboardsOfUser.length === 0 ? (
                <p className="text-muted-foreground">Regular user — not assigned to any management dashboard.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {dashboardsOfUser.map((m) => (
                    <li key={m.dashboards!.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                      <span>
                        <span className="font-medium text-foreground">{m.dashboards!.name}</span>
                        <span className="text-muted-foreground"> · {MODULES[m.dashboards!.module].name}</span>
                      </span>
                      {m.is_main
                        ? <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-gold"><Crown className="size-3" />Main Admin</span>
                        : <span className="text-muted-foreground">Member · {(m.permissions ?? []).length} page{(m.permissions ?? []).length === 1 ? "" : "s"}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">Main Admins manage members on their dashboard&apos;s Members page. Appoint Main Admins under Dashboards or Organizations.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><ShieldCheck className="size-4 text-primary" />Verification requests</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {(requests.data ?? []).length === 0 ? <p className="text-muted-foreground">No requests submitted.</p> : (
                <ul className="divide-y divide-border">
                  {(requests.data ?? []).map((r) => (
                    <li key={r.id} className="flex items-center justify-between py-2 text-xs">
                      <Link href={`/admin/queue/${r.id}`} className="font-medium text-primary hover:underline capitalize">{r.claimed_affiliation} · {r.status.replace(/_/g, " ")}</Link>
                      <span className="text-muted-foreground">{formatDateTime(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><History className="size-4 text-primary" />Profile change history</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {changes.error ? (
              <p className="text-muted-foreground">Change history is not enabled yet — run <code>scripts/9_admin_modules.sql</code>.</p>
            ) : (changes.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">No profile changes recorded.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(changes.data ?? []).map((c) => (
                  <li key={c.id} className="py-2 text-xs">
                    <p><strong className="text-foreground">{FIELD_LABELS[c.field] ?? c.field}</strong>: <span className="text-muted-foreground line-through">{c.old_value || "—"}</span> → <span className="text-foreground">{c.new_value || "—"}</span></p>
                    <p className="text-muted-foreground">{who(c.changed_by)} · {formatDateTime(c.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><ClipboardList className="size-4 text-primary" />Admin actions on this account</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {(logs.data ?? []).length === 0 ? <p className="text-muted-foreground">No admin actions yet.</p> : (
              <ul className="divide-y divide-border">
                {(logs.data ?? []).map((l) => (
                  <li key={l.id} className="py-2 text-xs">
                    <p className="text-foreground">{ACTION_LABELS[l.action] ?? l.action}{l.reason ? ` — ${l.reason}` : ""}</p>
                    <p className="text-muted-foreground">{who(l.actor_id)} · {formatDateTime(l.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
