import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardList } from "lucide-react"

const LOGS = [
  ["Aug 17 09:12","BAO Admin",     "Approved product: CICT Hoodie"],
  ["Aug 17 09:04","BAO Admin",     "Reviewed seller: HRM Department"],
  ["Aug 16 15:32","System",        "New seller registration: HRM Dept"],
  ["Aug 16 14:11","BAO Admin",     "Suspended seller: CBA Council"],
  ["Aug 16 11:00","System",        "New product listing: CICT Shirt"],
  ["Aug 15 10:25","BAO Admin",     "Approved product: BSED Polo"],
  ["Aug 15 08:50","System",        "Royalty calculated: ₱5,472 for July"],
]

export default async function BaoLogsPage() {
  const { email, profile } = await requireUser(["bao","admin"])
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Activity Logs" description="Full audit trail of BAO admin actions and system events." />
      <div className="mt-6">
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <ClipboardList className="size-4 text-primary" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable columns={["Timestamp","Actor","Action"]} rows={LOGS} />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
