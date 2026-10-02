import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Building2, Crown, Users } from "lucide-react"
import { appointMainAdmin } from "@/app/dashboard-actions"
import { MODULES, type ModuleKey } from "@/lib/modules"
import { profilesById } from "@/lib/admin"

/** University management dashboards (modules) and who holds Main Admin of each. */
export default async function DashboardsPage() {
  const ctx = await requireDashboard("verification", "dashboards")
  const supabase = await createClient()

  const { data: dashboards } = await supabase
    .from("dashboards")
    .select("id, module, name, dashboard_members(user_id, is_main)")
    .not("module", "in", "(seller,cashier)")
    .order("module")
  const rows = (dashboards ?? []) as { id: string; module: ModuleKey; name: string; dashboard_members: { user_id: string; is_main: boolean }[] }[]
  const people = await profilesById(supabase, rows.flatMap((d) => d.dashboard_members.map((m) => m.user_id)))

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading
        title="Dashboards"
        description="Dashboards are management modules, not user accounts. Each has one Main Admin (full control, manages members) and any number of members. Appoint or replace a Main Admin here. Seller Dashboards are managed under Seller Management, and each campus Cashier under Cashier Branches."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {rows.map((d) => {
          const main = d.dashboard_members.find((m) => m.is_main)
          const mainProfile = main ? people.get(main.user_id) : null
          return (
            <div key={d.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Building2 className="size-5 text-primary" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{MODULES[d.module].basePath} · <Users className="inline size-3" /> {d.dashboard_members.length} member{d.dashboard_members.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-sm">
                <Crown className="size-4 text-gold" />
                Main Admin:{" "}
                {mainProfile ? (
                  <Link href={`/admin/users/${main!.user_id}`} className="font-medium text-primary hover:underline">{mainProfile.full_name ?? "Unnamed user"}</Link>
                ) : (
                  <span className="font-medium text-destructive">Not appointed</span>
                )}
              </p>
              <form action={appointMainAdmin} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="dashboard_id" value={d.id} />
                <input name="email" type="email" required placeholder="New Main Admin's email"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs" />
                <button type="submit" className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                  {mainProfile ? "Replace" : "Appoint"}
                </button>
              </form>
              <p className="mt-2 text-[11px] text-muted-foreground">The previous Main Admin stays on as a regular member.</p>
            </div>
          )
        })}
      </div>
    </ManagementShell>
  )
}
