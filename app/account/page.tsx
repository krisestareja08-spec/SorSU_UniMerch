import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getMyMemberships, requireDashboard } from "@/lib/dashboards"
import { INSTANT_EMAIL_MODULES, primaryDashboard } from "@/lib/modules"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { PasswordChange } from "@/components/account/password-change"
import { EmailChange } from "@/components/account/email-change"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

/**
 * My Account for dashboard accounts (Verification Admin, BAO, Supply Office, Cashier, Seller).
 * They can't open the buyer pages (lib/supabase/proxy.ts), so their password is changed here.
 * Plain buyers have this under Settings in the marketplace.
 */
export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const memberships = await getMyMemberships(user.id)
  const primary = primaryDashboard(memberships)
  if (!primary) redirect("/marketplace/settings")
  const ctx = await requireDashboard(primary.module)

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="My Account" description="Your sign-in details for the UniMerch dashboards." />
      <div className="mt-6 max-w-2xl space-y-4">
        <Card className="border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">Account</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{ctx.fullName || "Not set"}</p></div>
            {/* Store accounts change their login email instantly; others confirm it from the new address */}
            <EmailChange currentEmail={ctx.email} instant={memberships.some((m) => INSTANT_EMAIL_MODULES.includes(m.module))} />
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">Change Password</CardTitle></CardHeader>
          <CardContent><PasswordChange /></CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground hover:underline">Terms and Conditions</Link>{" · "}
          <Link href="/privacy" className="hover:text-foreground hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </ManagementShell>
  )
}
