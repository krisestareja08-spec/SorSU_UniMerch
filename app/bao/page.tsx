import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, MiniBarChart, DashTable, StatusBadge, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Store, BadgeCheck, Wallet, FileCheck2, Users,
  TrendingUp, ShoppingBag, BarChart2, AlertTriangle,
} from "lucide-react"

const WEEKLY = [42, 58, 35, 70, 65, 88, 72]
const LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

const RECENT_SELLERS = [
  ["CICT Student Council",    "Active",   "₱38,400", "12 products", <StatusBadge key="1" status="approved" />],
  ["Nursing Organization",    "Active",   "₱22,150", "8 products",  <StatusBadge key="2" status="approved" />],
  ["HRM Department",          "Pending",  "—",       "0 products",  <StatusBadge key="3" status="pending" />],
  ["Engineering Society",     "Active",   "₱15,600", "6 products",  <StatusBadge key="4" status="approved" />],
  ["CBA Council",             "Suspended","—",       "4 products",  <StatusBadge key="5" status="rejected" />],
]

const PENDING_APPROVALS = [
  ["HRM Apron Set",           "HRM Dept",      "₱420",  <StatusBadge key="a" status="pending" />],
  ["BSED Polo Shirt",         "Education Dept","₱380",  <StatusBadge key="b" status="pending" />],
  ["Campus Tumbler (SSU)",    "SSC",           "₱290",  <StatusBadge key="c" status="pending" />],
]

export default async function BaoPage() {
  const { email, profile } = await requireUser(["bao", "admin"])

  const stats: Stat[] = [
    { label: "Platform Revenue",   value: "₱182k",  icon: Wallet,      hint: "+12% this month", trend: 12,  accent: "gold" },
    { label: "Active Sellers",     value: 27,        icon: Store,       hint: "Accredited orgs",  trend: 2,   accent: "primary" },
    { label: "Pending Approvals",  value: 4,         icon: BadgeCheck,  hint: "Listings to review",             accent: "red" },
    { label: "Permits Expiring",   value: 6,         icon: FileCheck2,  hint: "This month",                     accent: "red" },
  ]

  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="BAO Dashboard" description="Business Affairs Office — marketplace oversight and compliance." />

      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />

        {/* Revenue chart + royalty */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-base">
                <TrendingUp className="size-4 text-gold" /> Weekly Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MiniBarChart data={WEEKLY} labels={LABELS} color="oklch(0.4 0.13 20)" />
              <p className="mt-2 text-xs text-muted-foreground">Platform-wide sales this week · ₱182,400 total</p>
            </CardContent>
          </Card>

          <Card className="border-gold/20 bg-gradient-to-br from-gold/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-base">
                <BarChart2 className="size-4 text-gold" /> Royalty Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">3% royalty deducted from SSU-logo products</p>
              <div className="rounded-xl border border-gold/20 bg-gold/10 p-3 text-center">
                <p className="font-serif text-2xl font-bold text-gold">₱5,472</p>
                <p className="text-xs text-muted-foreground mt-0.5">Royalty collected this month</p>
              </div>
              <div className="space-y-1.5 text-sm">
                {[["SSU Tumbler", "₱290", "₱8.70"],["CICT Hoodie","₱680","₱20.40"],["SSU Lace","₱65","₱1.95"]].map(([n,p,r]) => (
                  <div key={n} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{n}</span>
                    <span className="font-medium text-gold">{r} / unit</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending approvals */}
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <AlertTriangle className="size-4 text-amber-500" /> Pending Product Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Product", "Seller", "Price", "Status"]}
              rows={PENDING_APPROVALS}
            />
          </CardContent>
        </Card>

        {/* Seller directory */}
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <Users className="size-4 text-primary" /> Seller Directory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Org / Seller", "Status", "Revenue", "Products", "Standing"]}
              rows={RECENT_SELLERS}
            />
          </CardContent>
        </Card>

        {/* Sales per org */}
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <ShoppingBag className="size-4 text-primary" /> Sales per Organisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBarChart
              data={[38400, 22150, 15600, 11200, 9800]}
              labels={["CICT","Nursing","Engineering","SSC","CBA"]}
              color="oklch(0.66 0.13 78)"
            />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
