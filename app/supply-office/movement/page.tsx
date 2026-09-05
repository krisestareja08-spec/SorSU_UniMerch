import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatusBadge } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpDown } from "lucide-react"

const MOVEMENTS = [
  ["Aug 17","CICT Shirt (L)",   "OUT","5",  "Walk-in sale",  "CICT Council",     <StatusBadge key="1" status="approved" />],
  ["Aug 17","SSU Tumbler",      "IN", "10", "Restocked",     "Supply Office",    <StatusBadge key="2" status="approved" />],
  ["Aug 16","SSU Hoodie (M)",   "OUT","2",  "Online order",  "CICT Council",     <StatusBadge key="3" status="approved" />],
  ["Aug 16","Nursing Lace",     "IN", "30", "Restocked",     "Supply Office",    <StatusBadge key="4" status="approved" />],
  ["Aug 15","HRM Apron",        "OUT","1",  "Walk-in sale",  "HRM Department",   <StatusBadge key="5" status="approved" />],
  ["Aug 14","HRM Apron",        "DISPOSAL","1","Torn item",  "Supply Office",    <StatusBadge key="6" status="rejected" />],
]

export default async function SupplyMovementPage() {
  const { email, profile } = await requireUser(["supply_office","admin"])
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Stock Movement" description="FIFO tracking, disposal monitoring, and discrepancy log." />
      <div className="mt-6 space-y-6">
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <ArrowUpDown className="size-4 text-primary" /> Movement Log (FIFO)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Date","Item","Direction","Qty","Reason","By","Status"]}
              rows={MOVEMENTS}
            />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
