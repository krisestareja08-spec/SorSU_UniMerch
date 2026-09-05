import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, MiniBarChart, DashTable, StatusBadge, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart2, TrendingUp, Wallet, ShoppingBag } from "lucide-react"

const MONTHLY = [28400, 34200, 41800, 38900, 52100, 47600, 61200]
const LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul"]

const TOP_PRODUCTS = [
  ["CICT Dept Shirt",  "82 sold", "₱31,160", "Available", <StatusBadge key="1" status="ok" />],
  ["SSU Tumbler",      "47 sold", "₱13,630", "Available", <StatusBadge key="2" status="ok" />],
  ["CICT ID Lace",     "150 sold","₱9,750",  "Available", <StatusBadge key="3" status="ok" />],
  ["Foundation Ticket","200 sold","₱24,000", "Available", <StatusBadge key="4" status="ok" />],
  ["SSU Hoodie",       "34 sold", "₱23,120", "Pre-Order", <StatusBadge key="5" status="pending" />],
]

export default async function CashierAnalyticsPage() {
  const { email, profile } = await requireUser(["seller","admin"])
  const stats: Stat[] = [
    { label: "Total Revenue",  value: "₱54,000", icon: Wallet,     hint: "All time",         accent: "gold" },
    { label: "Monthly Sales",  value: "₱8,800",  icon: TrendingUp, hint: "+15% vs last month", trend: 15, accent: "primary" },
    { label: "Best Seller",    value: "CICT Shirt",icon: ShoppingBag,hint: "82 units sold",   accent: "primary" },
    { label: "Royalty Paid",   value: "₱1,620",  icon: BarChart2,  hint: "3% of logo items", accent: "gold" },
  ]
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Sales & Profit Analytics" description="Revenue breakdown, profit summary, and product performance." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <TrendingUp className="size-4 text-gold" /> Monthly Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBarChart data={MONTHLY} labels={LABELS} color="oklch(0.4 0.13 20)" />
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable columns={["Product","Units Sold","Revenue","Badge","Stock"]} rows={TOP_PRODUCTS} />
          </CardContent>
        </Card>
        {/* Royalty breakdown */}
        <Card className="border-gold/20 bg-gold/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <BarChart2 className="size-4 text-gold" /> Royalty Analytics (3% per SSU-logo item)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Product","Price","Royalty/Unit","Units Sold","Total Royalty"]}
              rows={[
                ["SSU Tumbler",   "₱290","₱8.70", "47 sold","₱408.90"],
                ["CICT Hoodie",   "₱680","₱20.40","34 sold","₱693.60"],
                ["CICT ID Lace",  "₱65", "₱1.95", "150 sold","₱292.50"],
                ["SSU Foundation","₱120","₱3.60", "200 sold","₱720.00"],
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
