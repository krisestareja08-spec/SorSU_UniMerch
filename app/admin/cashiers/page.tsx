import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateCashierBranchForm } from "@/components/admin/create-cashier-branch-form"
import { appointMainAdmin } from "@/app/dashboard-actions"
import { Crown, MapPin, Plus, Users, Wallet } from "lucide-react"
import { profilesById } from "@/lib/admin"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"
import { CASHIER_SCOPE_LABELS, type CashierScope } from "@/lib/cashier-branches"
import { storefrontHref } from "@/lib/storefront-theme"
import { cn } from "@/lib/utils"
import { ActionForm } from "@/components/ui/action-form"

type Branch = {
  id: string; name: string; store_id: string | null; campus: string | null; scope: CashierScope | null; department: string | null
  dashboard_members: { user_id: string; is_main: boolean }[]
}

/** Cashier branches: one per campus (or per department / centralized), each with its own dashboard and store. */
export default async function CashierBranchesPage({ searchParams }: { searchParams: Promise<{ campus?: string }> }) {
  const ctx = await requireDashboard("verification", "cashiers")
  const { campus = "" } = await searchParams
  const supabase = await createClient()

  const full = await supabase.from("dashboards").select("id, name, store_id, campus, scope, department, dashboard_members(user_id, is_main)").eq("module", "cashier").order("name")
  const rows = ((full.error
    ? (await supabase.from("dashboards").select("id, name, store_id, dashboard_members(user_id, is_main)").eq("module", "cashier")).data
    : full.data) ?? []) as unknown as Branch[]
  const branches = campus ? rows.filter((b) => b.campus === campus) : rows
  const people = await profilesById(supabase, rows.flatMap((b) => b.dashboard_members.filter((m) => m.is_main).map((m) => m.user_id)))

  // Group by campus
  const groups = new Map<string, Branch[]>()
  for (const b of branches) groups.set(b.campus ?? "", [...(groups.get(b.campus ?? "") ?? []), b])

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading
        title="Cashier Branches"
        description="Each campus has its own cashier office — a secondary seller of uniforms and university merchandise. A branch serves its whole campus, one department, or the university centrally (still tied to a campus)."
      />
      {full.error && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">Run <code>scripts/19_cashier_branches.sql</code> in Supabase to enable cashier branches.</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <nav aria-label="Filter by campus" className="flex flex-wrap gap-2">
            <Link href="/admin/cashiers" className={cn("rounded-full border px-3 py-1 text-xs font-medium", !campus ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>All campuses</Link>
            {Object.entries(CAMPUS_LABELS).map(([v, l]) => (
              <Link key={v} href={`/admin/cashiers?campus=${v}`} className={cn("rounded-full border px-3 py-1 text-xs font-medium", campus === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{l}</Link>
            ))}
          </nav>

          {branches.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No cashier branches{campus ? " in this campus" : ""} yet.</p>}

          {[...groups.entries()].map(([campusKey, list]) => (
            <section key={campusKey || "none"}>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><MapPin className="size-4" />{CAMPUS_LABELS[campusKey as Campus] ?? "No campus set"}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((b) => {
                  const main = b.dashboard_members.find((m) => m.is_main)
                  return (
                    <div key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Wallet className="size-5 text-primary" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.scope ? CASHIER_SCOPE_LABELS[b.scope] : "Whole campus branch"}{b.department ? ` · ${b.department}` : ""}</p>
                        </div>
                      </div>
                      <p className="mt-3 flex items-center gap-1.5 text-xs">
                        <Crown className="size-3.5 text-gold" />Main Admin:{" "}
                        {main ? <Link href={`/admin/users/${main.user_id}`} className="font-medium text-primary hover:underline">{people.get(main.user_id)?.full_name ?? "Unnamed"}</Link> : <span className="font-medium text-destructive">Not appointed</span>}
                        <span className="ml-auto flex items-center gap-1 text-muted-foreground"><Users className="size-3.5" />{b.dashboard_members.length}</span>
                      </p>
                      <ActionForm action={appointMainAdmin} className="mt-3 flex gap-2">
                        <input type="hidden" name="dashboard_id" value={b.id} />
                        <input name="email" type="email" required placeholder={main ? "Replace Main Admin (email)" : "Appoint Main Admin (email)"}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs" />
                        <button type="submit" className="h-8 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted">Save</button>
                      </ActionForm>
                      {b.store_id && <Link href={storefrontHref(b.store_id)} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Storefront →</Link>}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Plus className="size-4 text-primary" />New cashier branch</CardTitle></CardHeader>
          <CardContent><CreateCashierBranchForm /></CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
