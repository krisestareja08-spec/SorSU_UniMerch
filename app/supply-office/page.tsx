import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, MiniBarChart, DashTable, StatusBadge, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Boxes, PackageX, ClipboardList, TrendingDown, AlertTriangle, ArrowUpDown, ShieldCheck } from "lucide-react"

const STOCK_LEVELS = [348, 312, 290, 265, 310, 330, 348]
const LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul"]

const INVENTORY = [
  ["CICT Shirt (L)",    "3",   "10", <StatusBadge key="1" status="low" />,  "Restock needed"],
  ["SSU Hoodie (M)",    "2",   "10", <StatusBadge key="2" status="low" />,  "Restock needed"],
  ["Nursing Lace",      "45",  "20", <StatusBadge key="3" status="ok" />,   "Sufficient"],
  ["HRM Apron Set",     "5",   "10", <StatusBadge key="4" status="low" />,  "Low stock"],
  ["CBA Polo (S)",      "28",  "15", <StatusBadge key="5" status="ok" />,   "Sufficient"],
]

const MOVEMENTS = [
  ["Aug 16", "CICT Shirt", "OUT", "5 units", "Walk-in sale"],
  ["Aug 16", "SSU Hoodie", "OUT", "2 units", "Online order"],
  ["Aug 15", "Nursing Lace","IN", "30 units","Restocked"],
  ["Aug 15", "HRM Apron",  "OUT", "1 unit",  "Walk-in sale"],
]

export default async function SupplyOfficePage() {
  const { email, profile } = await requireUser(["supply_office", "admin"])

  const stats: Stat[] = [
    { label: "SKUs Tracked",      value: 348, icon: Boxes,       hint: "Across all orgs",  accent: "primary" },
    { label: "Low Stock Items",   value: 12,  icon: TrendingDown, hint: "Below threshold", accent: "red" },
    { label: "Out of Stock",      value: 3,   icon: PackageX,    hint: "Needs restock",    accent: "red" },
    { label: "Pending Requests",  value: 8,   icon: ClipboardList,hint: "Awaiting action", accent: "gold" },
  ]

  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Supply Office" description="Monitor inventory, stock movement, and restricted items." />

      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />

        {/* Stock trend + alerts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-base">
                <Boxes className="size-4 text-primary" /> Stock Level Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MiniBarChart data={STOCK_LEVELS} labels={LABELS} color="oklch(0.4 0.13 20)" />
              <p className="mt-2 text-xs text-muted-foreground">Total SKUs tracked monthly</p>
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-base text-destructive">
                <AlertTriangle className="size-4" /> Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[["CICT Shirt (L)","3 pcs"],["SSU Hoodie (M)","2 pcs"],["HRM Apron","5 pcs"]].map(([n,s]) => (
                <div key={n} className="flex justify-between rounded-lg border border-destructive/20 bg-background px-3 py-2 text-xs">
                  <span className="font-medium">{n}</span>
                  <span className="text-destructive font-bold">{s}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Inventory table */}
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <Boxes className="size-4 text-primary" /> Inventory Levels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Item", "Stock", "Threshold", "Status", "Action"]}
              rows={INVENTORY}
            />
          </CardContent>
        </Card>

        {/* Stock movement log */}
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <ArrowUpDown className="size-4 text-primary" /> Stock Movement Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Date", "Item", "Direction", "Qty", "Reason"]}
              rows={MOVEMENTS}
            />
          </CardContent>
        </Card>

        {/* Restricted items */}
        <Card className="border-gold/20 bg-gold/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <ShieldCheck className="size-4 text-gold" /> Restricted Items Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Item", "Restriction", "Eligible Role", "Status"]}
              rows={[
                ["Faculty Polo (M)","University Logo","Faculty",   <StatusBadge key="1" status="approved" />],
                ["Staff Uniform",   "SSU Official",  "Staff",      <StatusBadge key="2" status="approved" />],
                ["Dept Lace Set",   "Department",    "Student",    <StatusBadge key="3" status="pending" />],
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
