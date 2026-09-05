import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatGrid, StatusBadge, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Boxes, ArrowUpDown, AlertTriangle, PackageX, Trash2 } from "lucide-react"

const INVENTORY = [
  ["CICT Shirt (L)","3",  "10", <StatusBadge key="1" status="low" />,  "2026-08-10","—"],
  ["CICT Shirt (M)","8",  "10", <StatusBadge key="2" status="ok" />,   "2026-08-10","—"],
  ["SSU Tumbler",   "12", "5",  <StatusBadge key="3" status="ok" />,   "2026-08-05","—"],
  ["SSU Hoodie (M)","2",  "10", <StatusBadge key="4" status="low" />,  "2026-07-28","—"],
  ["HRM Apron",     "5",  "10", <StatusBadge key="5" status="low" />,  "2026-08-01","1 damaged"],
]

export default async function SellerInventoryPage() {
  const { email, profile } = await requireUser(["seller","admin"])
  const stats: Stat[] = [
    { label: "Total SKUs",   value: 5,  icon: Boxes,        hint: "Active listings",  accent: "primary" },
    { label: "Low Stock",    value: 3,  icon: AlertTriangle, hint: "Below threshold", accent: "red" },
    { label: "Out of Stock", value: 0,  icon: PackageX,     hint: "None currently",   accent: "primary" },
    { label: "Discrepancies",value: 1,  icon: ArrowUpDown,  hint: "To investigate",   accent: "red" },
  ]
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Inventory Management" description="Track your shop's stock levels, FIFO flow, and discrepancies." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <Boxes className="size-4 text-primary" /> Stock Levels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Item","Stock","Min Threshold","Status","Last Updated","Discrepancy"]}
              rows={INVENTORY}
            />
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base text-destructive">
              <Trash2 className="size-4" /> Disposal / Damaged Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Item","Qty","Reason","Date","Action"]}
              rows={[
                ["HRM Apron","1","Torn during storage","Aug 14","Mark disposed"],
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
