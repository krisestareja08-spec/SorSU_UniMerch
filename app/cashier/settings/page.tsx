import { requireDashboard } from "@/lib/dashboards"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Card, CardContent } from "@/components/ui/card"

export default async function Page() {
  const ctx = await requireDashboard("cashier", "settings")
  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="settings" description="This section is under construction." />
      <Card className="mt-6 border-primary/10">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Content for this section will appear here.
        </CardContent>
      </Card>
    </ManagementShell>
  )
}
