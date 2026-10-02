import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { VerifiedBadge } from "@/components/verified-badge"
import { Crown, UserPlus, Trash2 } from "lucide-react"
import { addMember, removeMember, transferMainAdmin, updateMemberPermissions } from "@/app/dashboard-actions"
import { MODULES, grantablePages, type DashboardCtx } from "@/lib/modules"
import { profilesById } from "@/lib/admin"

/** Members of a dashboard. Only rendered for the Main Admin (guarded by requireDashboard(module, "members")). */
export async function MembersPage({ ctx }: { ctx: DashboardCtx }) {
  const supabase = await createClient()
  const [{ data: rows }, { data: emailRows }] = await Promise.all([
    supabase.from("dashboard_members").select("user_id, is_main, permissions, created_at").eq("dashboard_id", ctx.dashboardId).order("created_at"),
    supabase.rpc("dashboard_member_emails", { p_dashboard: ctx.dashboardId }),
  ])
  const members = (rows ?? []) as { user_id: string; is_main: boolean; permissions: string[] | null; created_at: string }[]
  const people = await profilesById(supabase, members.map((m) => m.user_id))
  const emails = new Map(((emailRows ?? []) as { user_id: string; email: string }[]).map((e) => [e.user_id, e.email]))
  const pages = grantablePages(ctx.module)
  const moduleName = MODULES[ctx.module].name

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading
        title={`Members — ${ctx.dashboardName}`}
        description={`${moduleName} is a management dashboard, not an account. You are its Main Admin: add people who help manage it and tick the pages each member may use.`}
      />

      {/* Add member */}
      <form action={addMember} className="mt-6 rounded-2xl border border-border bg-card p-5">
        <input type="hidden" name="dashboard_id" value={ctx.dashboardId} />
        <p className="flex items-center gap-2 font-semibold text-foreground"><UserPlus className="size-4 text-primary" />Add a member</p>
        <p className="mt-1 text-xs text-muted-foreground">The person must already have a UniMerch account.</p>
        <input name="email" type="email" required placeholder="member@sorsu.edu.ph"
          className="mt-3 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm sm:max-w-sm" />
        <p className="mt-3 text-xs font-medium text-muted-foreground">Pages this member can use</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {pages.map((p) => (
            <label key={p.perm} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs">
              <input type="checkbox" name="permissions" value={p.perm} />{p.label}
            </label>
          ))}
        </div>
        <button type="submit" className="mt-4 h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Add member
        </button>
      </form>

      {/* Member list */}
      <div className="mt-6 space-y-3">
        {members.map((m) => {
          const person = people.get(m.user_id)
          const perms = new Set(m.permissions ?? [])
          return (
            <div key={m.user_id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    {person?.full_name ?? "Unnamed user"}
                    {m.is_main ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-gold">
                        <Crown className="size-3" /> Main Admin
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Member</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{emails.get(m.user_id) ?? "—"}</p>
                  <VerifiedBadge verified={person?.is_identity_verified} affiliation={person?.affiliation} className="mt-1" />
                </div>
                {!m.is_main && (
                  <div className="flex gap-2">
                    <form action={transferMainAdmin}>
                      <input type="hidden" name="dashboard_id" value={ctx.dashboardId} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <button type="submit" className="rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-muted" title="You will become a regular member">
                        Make Main Admin
                      </button>
                    </form>
                    <form action={removeMember}>
                      <input type="hidden" name="dashboard_id" value={ctx.dashboardId} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-3" /> Remove
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {m.is_main ? (
                <p className="mt-3 text-xs text-muted-foreground">Full access to every page, and manages members.</p>
              ) : (
                <form action={updateMemberPermissions} className="mt-3">
                  <input type="hidden" name="dashboard_id" value={ctx.dashboardId} />
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <div className="flex flex-wrap gap-2">
                    {pages.map((p) => (
                      <label key={p.perm} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs">
                        <input type="checkbox" name="permissions" value={p.perm} defaultChecked={perms.has(p.perm)} />{p.label}
                      </label>
                    ))}
                  </div>
                  <button type="submit" className="mt-3 h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                    Save permissions
                  </button>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </ManagementShell>
  )
}
