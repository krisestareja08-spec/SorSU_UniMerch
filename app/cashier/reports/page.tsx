import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatusBadge } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, FileText } from "lucide-react"

const REPORTS = [
  ["Daily Cash Reconciliation", "Aug 17, 2026", "Opening/closing till, variance",     <StatusBadge key="1" status="ok" />],
  ["GCash Verification Log",    "Aug 17, 2026", "Reference numbers matched today",    <StatusBadge key="2" status="ok" />],
  ["Weekly Sales Summary",      "Aug 11–17",    "Walk-in + online totals",             <StatusBadge key="3" status="ok" />],
  ["End-of-Day Report",         "Aug 16, 2026", "Transactions, refunds, discrepancies",<StatusBadge key="4" status="ok" />],
]

export default async function Page() {
  const { email, profile } = await requireUser(["seller", "admin"])
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Cashier Reports" description="Daily and weekly cash-handling reports for this counter." />
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
              <Download className="size-3.5" /> See <a href="/cashier/payments" className="underline">Payments</a> for the live transaction log this data is drawn from.
            </p>
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}

