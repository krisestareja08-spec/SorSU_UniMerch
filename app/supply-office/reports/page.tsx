import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatusBadge } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, FileText } from "lucide-react"

const REPORTS = [
  ["Low Stock Alert Report",   "Aug 17, 2026", "SKUs below restock threshold",     <StatusBadge key="1" status="ok" />],
  ["Stock Movement Summary",   "Aug 2026",     "IN / OUT / disposal totals (FIFO)",<StatusBadge key="2" status="ok" />],
  ["Discrepancy Log",          "Aug 2026",     "Unreconciled inventory counts",    <StatusBadge key="3" status="pending" />],
  ["Restricted Items Audit",   "Jul 2026",     "Controlled/restricted stock check",<StatusBadge key="4" status="ok" />],
]

export default async function Page() {
  const { email, profile } = await requireUser(["supply_office", "admin"])
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Inventory Reports" description="Stock, movement, and discrepancy reports for the Supply Office." />
      <div className="mt-6 space-y-6">
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <FileText className="size-4 text-primary" /> Recent Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable columns={["Report", "Period", "Contents", "Status"]} rows={REPORTS} />
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Download className="size-3.5" /> See <a href="/supply-office/inventory" className="underline">Inventory</a> and <a href="/supply-office/movement" className="underline">Movement</a> for the live data these reports summarize.
            </p>
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}

