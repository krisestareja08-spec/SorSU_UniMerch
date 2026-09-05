import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatGrid, StatusBadge, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Boxes, TrendingDown, AlertTriangle, PackageX } from "lucide-react"

const ITEMS = [
  ["CICT Shirt (L)",  "3",  "10", <StatusBadge key="1" status="low" />,  "CICT Council",  "Aug 10"],
  ["CICT Shirt (M)",  "8",  "10", <StatusBadge key="2" status="ok" />,   "CICT Council",  "Aug 10"],
  ["SSU Tumbler",     "12", "5",  <StatusBadge key="3" status="ok" />,   "SSC",           "Aug 05"],
  ["SSU Hoodie (M)",  "2",  "10", <StatusBadge key="4" status="low" />,  "SSC",           "Jul 28"],
  ["Nursing Lace",    "18", "10", <StatusBadge key="5" status="ok" />,   "Nursing Org",   "Aug 12"],
  ["HRM Apron Set",   "4",  "10", <StatusBadge key="6" status="low" />,  "HRM Department","Aug 01"],
  ["CBA Polo (S)",    "28", "15", <StatusBadge key="7" status="ok" />,   "CBA Council",   "Aug 03"],
]

export default async function SupplyInventoryPage() {
  const { email, profile } = await requireUser(["supply_office","admin"])
  const stats: Stat[] = [
    { label: "Total SKUs",   value: 7,  icon: Boxes,        hint: "Tracked items",    accent: "primary" },
    { label: "Low Stock",    value: 3,  icon: TrendingDown, hint: "Need restock",     accent: "red" },
    { label: "Out of Stock", value: 0,  icon: PackageX,     hint: "None currently",   accent: "primary" },
    { label: "Discrepancies",value: 1,  icon: AlertTriangle,hint: "Under review",     accent: "red" },
  ]
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Inventory" description="Real-time stock levels across all seller organisations." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <Boxes className="size-4 text-primary" /> All Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable columns={["Item","Stock","Threshold","Status","Seller","Last Updated"]} rows={ITEMS} />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
