import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, MiniBarChart, DashTable, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart2, TrendingUp, Wallet } from "lucide-react"

const MONTHLY = [12400, 15800, 18900, 21200, 28400, 31600, 34200]
const LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul"]

export default async function SellerAnalyticsPage() {
  const { email, profile } = await requireUser(["seller","admin"])
  const stats: Stat[] = [
    { label: "Total Revenue",  value: "₱34,200", icon: Wallet,     hint: "+8% this week", trend: 8, accent: "gold" },
    { label: "This Month",     value: "₱8,800",  icon: TrendingUp, hint: "Aug 2026",               accent: "primary" },
    { label: "Walk-in Share",  value: "63%",      icon: BarChart2,  hint: "₱21,400",                accent: "primary" },
    { label: "Online Share",   value: "37%",      icon: BarChart2,  hint: "₱12,800",                accent: "gold" },
  ]
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Analytics" description="Sales trends, profit summary, and product performance — visible only to your org." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <TrendingUp className="size-4 text-gold" /> Monthly Sales Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBarChart data={MONTHLY} labels={LABELS} color="oklch(0.4 0.13 20)" />
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Best-Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Product","Units Sold","Revenue","% of Total"]}
              rows={[
                ["CICT Dept Shirt", "82 sold","₱31,160","46%"],
                ["Foundation Ticket","200 sold","₱24,000","35%"],
                ["SSU Tumbler",    "47 sold","₱13,630","20%"],
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
