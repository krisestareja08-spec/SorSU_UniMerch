import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, UserCheck, Users, AlertOctagon, Store, ClipboardList, ChevronRight, Building2, Flag, Wallet } from "lucide-react"
import { canUse } from "@/lib/modules"
import { ACTION_LABELS, findDuplicateGroups, formatDateTime, profilesById } from "@/lib/admin"

const SECTIONS = [
  { perm: "queue", href: "/admin/queue",      label: "Verification Queue",  desc: "Review profile details and uploaded I.D. / COR, then approve or decline.", icon: ShieldCheck },
  { perm: "users", href: "/admin/users",      label: "User Management",     desc: "All users, dashboard memberships, account standing and change history.",      icon: Users },
  { perm: "duplicates", href: "/admin/duplicates", label: "Duplicate Detection", desc: "Accounts sharing the same I.D. number — one account per user.",          icon: AlertOctagon },
  { perm: "reports", href: "/admin/reports",    label: "Reported Accounts",   desc: "Buyers reported by sellers as dummy or fake — suspend or ban them.",    icon: Flag },
  { perm: "organizations", href: "/admin/sellers",    label: "Seller Management",   desc: "Create organizations — each gets a storefront and its own Seller Dashboard.", icon: Store },
  { perm: "cashiers", href: "/admin/cashiers",   label: "Cashier Branches",    desc: "Create a cashier office per campus, department or centralized, and appoint its Main Admin.", icon: Wallet },
  { perm: "dashboards", href: "/admin/dashboards", label: "Dashboard Admins",    desc: "Appoint the Main Admin of BAO, Supply Office, Cashier and this dashboard.", icon: Building2 },
  { perm: "logs", href: "/admin/logs",       label: "Activity Logs",       desc: "Every action taken in the Verification Admin dashboard.",                icon: ClipboardList },
]

export default async function AdminPage() {
  const ctx = await requireDashboard("verification")
  const supabase = await createClient()

  const [pending, verified, sellers, duplicates, recent] = await Promise.all([
    supabase.from("verification_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "under_review"]),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_identity_verified", true),
    supabase.from("dashboards").select("id", { count: "exact", head: true }).eq("module", "seller"),
    findDuplicateGroups(supabase).catch(() => []),
    supabase.from("verification_audit_log").select("id, actor_id, user_id, action, reason, created_at").order("created_at", { ascending: false }).limit(5),
  ])

  const logs = recent.data ?? []
  const people = await profilesById(supabase, logs.flatMap((l) => [l.actor_id, l.user_id]))

  const stats: Stat[] = [
    { label: "Pending review",  value: pending.count ?? 0,  icon: ClipboardList, hint: "In the queue",         accent: "red" },
    { label: "Verified users",  value: verified.count ?? 0, icon: UserCheck,     hint: "Approved identities",  accent: "green" },
    { label: "Duplicate I.D.s", value: duplicates.length,   icon: AlertOctagon,  hint: "Needs manual review",  accent: "gold" },
    { label: "Organizations",   value: sellers.count ?? 0,  icon: Store,         hint: "Seller dashboards",    accent: "primary" },
  ]

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Verification Admin" description="Validates university identity, manages accounts and seller onboarding." />

      <div className="mt-6">
        <StatGrid stats={stats} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.filter((m) => canUse(ctx, m.perm)).map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icon className="size-4 text-primary" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-primary" />
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-lg">Recent activity</CardTitle>
          <Link href="/admin/logs" className="text-xs font-medium text-primary hover:underline">View all</Link>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {logs.length === 0 ? (
            <p>No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                  <span>
                    <strong className="text-foreground">{people.get(l.actor_id ?? "")?.full_name ?? "Admin"}</strong>{" "}
                    {(ACTION_LABELS[l.action] ?? l.action).toLowerCase()}
                    {l.user_id && <> · <Link href={`/admin/users/${l.user_id}`} className="text-primary hover:underline">{people.get(l.user_id)?.full_name ?? "user"}</Link></>}
                  </span>
                  <span>{formatDateTime(l.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </ManagementShell>
  )
}
