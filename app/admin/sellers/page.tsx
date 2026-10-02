import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Crown, ExternalLink, Plus, Store, Users } from "lucide-react"
import { updateSellerStatus } from "../verification-actions"
import { appointMainAdmin } from "@/app/dashboard-actions"
import { formatDateTime, profilesById } from "@/lib/admin"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { storefrontHref } from "@/lib/storefront"

type OrgRow = {
  id: string
  name: string
  store_id: string
  created_at: string
  seller_profiles: { org_name: string; category: string | null; campus: string | null; status: string } | null
  dashboard_members: { user_id: string; is_main: boolean }[]
}

/** Seller organizations: each is a store + its own Seller Dashboard with a Main Admin and members. */
export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const ctx = await requireDashboard("verification", "organizations")
  const { created } = await searchParams
  const supabase = await createClient()

  const { data } = await supabase
    .from("dashboards")
    .select("id, name, store_id, created_at, seller_profiles(org_name, category, campus, status), dashboard_members(user_id, is_main)")
    .eq("module", "seller")
    .order("created_at", { ascending: false })
  const orgs = (data ?? []) as unknown as OrgRow[]
  const people = await profilesById(supabase, orgs.flatMap((o) => o.dashboard_members.filter((m) => m.is_main).map((m) => m.user_id)))

  return (
    <ManagementShell ctx={ctx}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeading
          title="Organizations"
          description="Each organization has its own storefront and Seller Dashboard. You appoint its Main Admin, who then adds members and sets their permissions."
        />
        <Button asChild className="gap-1.5">
          <Link href="/admin/sellers/new"><Plus className="size-4" />Create organization</Link>
        </Button>
      </div>

      {created && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="size-4" /> Organization created. Its Main Admin can now open the Seller Dashboard from their account.
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orgs.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No organizations yet.</p>
        )}
        {orgs.map((o) => {
          const shop = o.seller_profiles
          const status = shop?.status ?? "active"
          const main = o.dashboard_members.find((m) => m.is_main)
          return (
            <div key={o.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Store className="size-5 text-primary" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{shop?.org_name ?? o.name}</p>
                  <p className="text-xs text-muted-foreground">{shop?.category ?? "Organization"}</p>
                  <p className="text-xs text-muted-foreground">{CAMPUS_LABELS[shop?.campus as Campus] ?? "No campus"}</p>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                  status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-destructive/10 text-destructive")}>
                  {status}
                </span>
              </div>

              <div className="mt-3 space-y-1 text-xs">
                <p className="flex items-center gap-1.5">
                  <Crown className="size-3.5 text-gold" /> Main Admin:{" "}
                  {main ? (
                    <Link href={`/admin/users/${main.user_id}`} className="font-medium text-primary hover:underline">{people.get(main.user_id)?.full_name ?? "Unnamed user"}</Link>
                  ) : <span className="font-medium text-destructive">Not appointed</span>}
                </p>
                <p className="flex items-center gap-1.5 text-muted-foreground"><Users className="size-3.5" /> {o.dashboard_members.length} member{o.dashboard_members.length === 1 ? "" : "s"} · created {formatDateTime(o.created_at)}</p>
              </div>

              <form action={appointMainAdmin} className="mt-3 flex gap-2">
                <input type="hidden" name="dashboard_id" value={o.id} />
                <input name="email" type="email" required placeholder={main ? "Replace Main Admin (email)" : "Appoint Main Admin (email)"}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs" />
                <button type="submit" className="h-8 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted">Save</button>
              </form>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Link href={storefrontHref(o.store_id)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <ExternalLink className="size-3" /> Storefront
                </Link>
                <form action={updateSellerStatus} className="ml-auto">
                  <input type="hidden" name="seller_id" value={o.store_id} />
                  <input type="hidden" name="status" value={status === "active" ? "suspended" : "active"} />
                  <button type="submit" className={cn("rounded-lg border px-3 py-1 text-xs font-semibold",
                    status === "active" ? "border-destructive/30 text-destructive hover:bg-destructive/10" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50")}>
                    {status === "active" ? "Suspend storefront" : "Activate storefront"}
                  </button>
                </form>
              </div>
            </div>
          )
        })}
      </div>
    </ManagementShell>
  )
}
