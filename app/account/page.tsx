import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getMemberships, requireDashboard } from "@/lib/dashboards"
import { primaryDashboard } from "@/lib/modules"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { PasswordChange } from "@/components/account/password-change"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * My Account for dashboard accounts (Verification Admin, BAO, Supply Office, Cashier, Seller).
 * They can't open the buyer pages (lib/supabase/proxy.ts), so their password is changed here.
 * Plain buyers have this under Settings in the marketplace.
 */
export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const primary = primaryDashboard(await getMemberships(supabase, user.id))
  if (!primary) redirect("/marketplace/settings")
  const ctx = await requireDashboard(primary.module)

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="My Account" description="Your sign-in details for the UniMerch dashboards." />
      <div className="mt-6 max-w-2xl space-y-4">
        <Card className="border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">Account</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{ctx.fullName || "Not set"}</p></div>
            <div><p className="text-xs text-muted-foreground">Email</p><p className="break-all font-medium">{ctx.email}</p></div>
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">Change Password</CardTitle></CardHeader>
          <CardContent><PasswordChange /></CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
