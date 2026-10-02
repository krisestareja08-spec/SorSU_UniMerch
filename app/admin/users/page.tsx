import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { VerifiedBadge } from "@/components/verified-badge"
import { DeleteUserButton } from "@/components/admin/delete-user-button"
import { ChevronRight, Search } from "lucide-react"
import { PROFILE_COLUMNS, type AdminProfile } from "@/lib/admin"
import { cn } from "@/lib/utils"

const FILTERS = [
  { key: "all",        label: "All" },
  { key: "verified",   label: "Verified" },
  { key: "guest",      label: "Guests" },
  { key: "staff",      label: "Dashboard members" },
  { key: "restricted", label: "Flagged / suspended / banned" },
] as const

const ACCOUNT_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  flagged: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  suspended: "bg-destructive/10 text-destructive",
  banned: "bg-destructive text-destructive-foreground",
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const ctx = await requireDashboard("verification", "users")
  const { filter = "all", q = "" } = await searchParams
  const supabase = await createClient()

  let query = supabase.from("profiles").select(PROFILE_COLUMNS).order("created_at", { ascending: false }).limit(300)
  if (filter === "verified") query = query.eq("is_identity_verified", true)
  if (filter === "guest") query = query.eq("is_identity_verified", false)

  // Dashboard membership (users are people; dashboards are modules they may be assigned to)
  const { data: memberRows } = await supabase.from("dashboard_members").select("user_id, is_main, dashboards(name)")
  const membershipsByUser = new Map<string, string[]>()
  for (const m of (memberRows ?? []) as unknown as { user_id: string; is_main: boolean; dashboards: { name: string } | null }[]) {
    if (!m.dashboards) continue
    const list = membershipsByUser.get(m.user_id) ?? []
    list.push(`${m.dashboards.name}${m.is_main ? " (Main)" : ""}`)
    membershipsByUser.set(m.user_id, list)
  }
  if (filter === "staff") query = query.in("id", [...membershipsByUser.keys()].length ? [...membershipsByUser.keys()] : ["00000000-0000-0000-0000-000000000000"])
  if (filter === "restricted") query = query.in("account_status", ["suspended", "flagged", "banned"])
  const term = q.trim().replace(/[,()]/g, "")
  if (term) query = query.or(`full_name.ilike.%${term}%,student_employee_id.ilike.%${term}%,department.ilike.%${term}%`)

  const { data, error } = await query
  const users = (data ?? []) as AdminProfile[]

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Users & Accounts" description="Every person who logs in. Open a user to see their full profile, dashboard memberships, account standing and change history." />

      <form className="relative mt-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input type="hidden" name="filter" value={filter} />
        <input name="q" defaultValue={q} placeholder="Search by name, I.D. number or department"
          className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm" />
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/admin/users?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
            {f.label}
          </Link>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">Could not load accounts: {error.message}</p>}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-160 text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">I.D. / Dept.</th>
              <th className="px-4 py-2.5 font-medium">Dashboards</th>
              <th className="px-4 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No accounts match.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-foreground hover:text-primary hover:underline">{u.full_name || "Unnamed user"}</Link>
                  <div><VerifiedBadge verified={u.is_identity_verified} affiliation={u.affiliation} className="mt-0.5" /></div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{u.student_employee_id || "—"} · {u.department || "—"}</td>
                <td className="px-4 py-2.5 text-xs">{membershipsByUser.get(u.id)?.join(", ") ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", ACCOUNT_STYLES[u.account_status ?? "active"])}>{u.account_status ?? "active"}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link href={`/admin/users/${u.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Details <ChevronRight className="size-3" />
                    </Link>
                    {u.id !== ctx.userId && <DeleteUserButton userId={u.id} name={u.full_name || "this user"} compact />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ManagementShell>
  )
}
