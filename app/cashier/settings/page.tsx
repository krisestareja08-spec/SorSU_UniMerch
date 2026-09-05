import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Card, CardContent } from "@/components/ui/card"

export default async function Page() {
  const { email, profile } = await requireUser(["seller", "admin"])
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="settings" description="This section is under construction." />
      <Card className="mt-6 border-primary/10">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Content for this section will appear here.
        </CardContent>
      </Card>
    </ManagementShell>
  )
}
