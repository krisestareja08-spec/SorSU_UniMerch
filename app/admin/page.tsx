import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, ShieldCheck, Store, Boxes } from "lucide-react"
import { updateUserRole } from "./actions"
import { ROLE_LABELS, type UserRole } from "@/lib/roles"

const ASSIGNABLE_ROLES: UserRole[] = ["buyer", "seller", "bao", "supply_office", "registrar", "admin"]

export default async function AdminPage() {
  const { email, profile } = await requireUser(["admin"])
  const supabase = await createClient()

  let userCount = 0
  let verifiedCount = 0
  let sellerCount = 0
  let catalogCount = 0
  let users: { id: string; full_name: string | null; role: UserRole; affiliation: string }[] = []

  try {
    const userResult = await supabase.from("profiles").select("id", { count: "exact", head: true })
    userCount = userResult.count ?? 0

    const verifiedResult = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_identity_verified", true)
    verifiedCount = verifiedResult.count ?? 0

    const sellerResult = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "seller")
    sellerCount = sellerResult.count ?? 0

    const catalogResult = await supabase.from("products").select("id", { count: "exact", head: true })
    catalogCount = catalogResult.count ?? 0

    const usersResult = await supabase
      .from("profiles")
      .select("id, full_name, role, affiliation")
      .order("created_at", { ascending: false })
      .limit(20)
    users = usersResult.data ?? []
  } catch {
    userCount = 0
    verifiedCount = 0
    sellerCount = 0
    catalogCount = 0
    users = []
  }

  const stats: Stat[] = [
    { label: "Total users", value: userCount ?? 0, icon: Users, hint: "Registered" },
    { label: "Verified", value: verifiedCount ?? 0, icon: ShieldCheck, hint: "Identity confirmed" },
    { label: "Sellers", value: sellerCount, icon: Store, hint: "Accredited" },
    { label: "Catalog items", value: catalogCount, icon: Boxes, hint: "Listed" },
  ]

  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Administration" description="Manage users, roles, and platform-wide settings." />
      <div className="mt-6">
        <StatGrid stats={stats} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <Users className="size-5 text-primary" />
            Users &amp; roles
          </CardTitle>
          <CardDescription>Assign module roles (BAO, Supply Office, Registrar, Seller) to accounts.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {users.length === 0 ? (
            <p>
              No accounts found. Run <code>scripts/fix-schema.sql</code> in Supabase if this looks wrong.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-140 text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Affiliation</th>
                    <th className="py-2 pr-4 font-medium">Role</th>
                    <th className="py-2 pr-4 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-4 font-medium text-foreground">{u.full_name || "—"}</td>
                      <td className="py-2 pr-4 capitalize">{u.affiliation}</td>
                      <td className="py-2 pr-4">
                        <form action={updateUserRole} className="flex items-center gap-2">
                          <input type="hidden" name="user_id" value={u.id} />
                          <select
                            name="role"
                            defaultValue={u.role}
                            className="rounded-lg border border-input bg-background px-2 py-1 text-xs"
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                          >
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </ManagementShell>
  )
}

