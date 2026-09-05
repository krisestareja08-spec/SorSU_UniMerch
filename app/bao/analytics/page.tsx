import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatGrid, MiniBarChart, StatusBadge, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart2, TrendingUp, Wallet, Users } from "lucide-react"

const MONTHLY = [95000, 118000, 142000, 131000, 165000, 158000, 182000]
const LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul"]

const ORG_SALES = [
  ["CICT Student Council", "₱38,400", "12 products","₱1,152","Active"],
  ["Nursing Org",          "₱22,150", "8 products", "₱664",  "Active"],
  ["Engineering Society",  "₱15,600", "6 products", "₱468",  "Active"],
  ["SSC Bulan Campus",     "₱11,200", "4 products", "₱336",  "Active"],
  ["CBA Council",          "₱9,800",  "5 products", "₱294",  "Suspended"],
]

export default async function BaoAnalyticsPage() {
  const { email, profile } = await requireUser(["bao","admin"])
  const stats: Stat[] = [
    { label: "Platform Revenue",  value: "₱182k",  icon: Wallet,     hint: "+12% this month", trend: 12, accent: "gold" },
    { label: "Total Royalty",     value: "₱5,472", icon: BarChart2,  hint: "3% from logo items",         accent: "gold" },
    { label: "Active Orgs",       value: 4,         icon: Users,      hint: "Selling this month",         accent: "primary" },
    { label: "Best Month",        value: "Jul 2026",icon: TrendingUp, hint: "₱182,000",                   accent: "primary" },
  ]
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Reports & Analytics" description="Platform-wide revenue, royalty breakdown, and per-organisation sales." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <TrendingUp className="size-4 text-gold" /> Monthly Platform Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBarChart data={MONTHLY} labels={LABELS} color="oklch(0.4 0.13 20)" />
          </CardContent>
        </Card>
        <Card className="border-gold/20 bg-gold/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <BarChart2 className="size-4 text-gold" /> Sales per Organisation (BAO View)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Organisation","Revenue","Products","Royalty (3%)","Status"]}
              rows={ORG_SALES}
            />
            <p className="mt-3 text-xs text-muted-foreground">Individual seller profit details are confidential — only aggregated org revenue is shown here.</p>
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Revenue by Org (Bar)</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBarChart data={[38400,22150,15600,11200,9800]} labels={["CICT","Nursing","Eng","SSC","CBA"]} color="oklch(0.66 0.13 78)" />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
