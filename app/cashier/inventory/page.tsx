import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatGrid, StatusBadge, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Boxes, ArrowUpDown, AlertTriangle, PackageX } from "lucide-react"

const INVENTORY = [
  ["CICT Shirt (L)",    "3",  "10", <StatusBadge key="1" status="low" />, "2026-08-10"],
  ["CICT Shirt (M)",    "8",  "10", <StatusBadge key="2" status="ok" />,  "2026-08-10"],
  ["SSU Tumbler",       "12", "5",  <StatusBadge key="3" status="ok" />,  "2026-08-05"],
  ["SSU Hoodie (M)",    "2",  "10", <StatusBadge key="4" status="low" />, "2026-07-28"],
  ["Nursing Lace",      "18", "10", <StatusBadge key="5" status="ok" />,  "2026-08-12"],
  ["HRM Apron Set",     "5",  "10", <StatusBadge key="6" status="low" />, "2026-08-01"],
]

const MOVEMENTS = [
  ["Aug 16","CICT Shirt (L)","OUT","5","Walk-in sale #TXN-0441"],
  ["Aug 16","SSU Tumbler",   "IN", "10","Restocked from supply office"],
  ["Aug 15","SSU Hoodie (M)","OUT","1", "Online order #ORD-0440"],
  ["Aug 15","Nursing Lace",  "IN", "30","Restocked from supply office"],
  ["Aug 14","HRM Apron",     "OUT","1", "Walk-in sale #TXN-0435"],
]

export default async function CashierInventoryPage() {
  const { email, profile } = await requireUser(["seller","admin"])
  const stats: Stat[] = [
    { label: "Total SKUs",   value: 6,  icon: Boxes,       hint: "Active items",       accent: "primary" },
    { label: "Low Stock",    value: 3,  icon: AlertTriangle,hint: "Below threshold",   accent: "red" },
    { label: "Out of Stock", value: 0,  icon: PackageX,    hint: "Currently none",     accent: "primary" },
    { label: "Movements",    value: 12, icon: ArrowUpDown, hint: "This week",           accent: "gold" },
  ]
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Inventory Management" description="Track stock levels, log movements, and manage your shop inventory." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <Boxes className="size-4 text-primary" /> Stock Levels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable columns={["Item","Stock","Threshold","Status","Last Updated"]} rows={INVENTORY} />
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <ArrowUpDown className="size-4 text-primary" /> Movement Log (FIFO)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable columns={["Date","Item","In/Out","Qty","Reason"]} rows={MOVEMENTS} />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
