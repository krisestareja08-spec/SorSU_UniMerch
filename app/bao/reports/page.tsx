import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatusBadge } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, FileText } from "lucide-react"

const REPORTS = [
  ["Monthly Sales Summary",     "Aug 2026", "Revenue & royalty per organisation", <StatusBadge key="1" status="ok" />],
  ["Royalty Statement",         "Q3 2026",  "3% logo-item royalty breakdown",     <StatusBadge key="2" status="ok" />],
  ["Seller Accreditation Log",  "Jul 2026", "New, suspended, and rejected orgs",  <StatusBadge key="3" status="ok" />],
  ["Product Approval Summary",  "Jul 2026", "Approved / rejected listing counts", <StatusBadge key="4" status="ok" />],
  ["Platform Activity Report",  "Aug 2026", "Currently generating",               <StatusBadge key="5" status="pending" />],
]

export default async function Page() {
  const { email, profile } = await requireUser(["bao", "admin"])
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Reports" description="Generated platform reports available for download." />
      <div className="mt-6 space-y-6">
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <FileText className="size-4 text-primary" /> Available Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable columns={["Report", "Period", "Contents", "Status"]} rows={REPORTS} />
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Download className="size-3.5" /> Export tooling connects here once report generation is wired to live data.
            </p>
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}

