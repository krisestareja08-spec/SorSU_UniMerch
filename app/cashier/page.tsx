import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, MiniBarChart, DashTable, StatusBadge, Sparkline, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Wallet, ShieldCheck, TrendingUp, Users, AlertTriangle, Boxes, Package } from "lucide-react"

// NOTE: Cashier uses the "seller" role with special privileges in the real DB.
// This page is accessible from /cashier for staff assigned the cashier role.

const DAILY = [4200, 5800, 3900, 7100, 6400, 8800, 7500]
const LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

const RECENT_TXN = [
  ["TXN-0441","Juan Dela Cruz", "CICT Shirt × 2","₱760",  "Cash",  <StatusBadge key="1" status="paid" />],
  ["TXN-0440","Maria Santos",   "SSU Tumbler × 1","₱290", "GCash", <StatusBadge key="2" status="paid" />],
  ["TXN-0439","Pedro Reyes",    "HRM Apron × 1",  "₱420", "Cash",  <StatusBadge key="3" status="pending" />],
  ["TXN-0438","Ana Garcia",     "Nursing Lace × 3","₱195","GCash", <StatusBadge key="4" status="paid" />],
]

const VERIFY_QUEUE = [
  ["Maria Santos",  "Student","Faculty Polo", <StatusBadge key="1" status="pending" />],
  ["Jose Reyes",    "Faculty","Staff Uniform",<StatusBadge key="2" status="approved" />],
  ["Liza Cruz",     "Staff",  "Dept Lace",   <StatusBadge key="3" status="pending" />],
]

export default async function CashierPage() {
  // Cashier is a seller-role user with special access
  const { email, profile } = await requireUser(["seller", "admin"])

  const stats: Stat[] = [
    { label: "Today's Sales",     value: "₱8,800", icon: TrendingUp,  hint: "+15% vs yesterday", trend: 15, accent: "gold" },
    { label: "Walk-in Payments",  value: "₱5,200", icon: Wallet,      hint: "Cash + GCash",                 accent: "primary" },
    { label: "Online Payments",   value: "₱3,600", icon: CreditCard,  hint: "Verified",                     accent: "primary" },
    { label: "Pending Verify",    value: 3,          icon: ShieldCheck, hint: "ID/COR queue",                  accent: "red" },
  ]

  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Cashier Dashboard" description="Walk-in payments, online verification, inventory and analytics." />

      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />

        {/* Quick action buttons */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Walk-in Payment", href: "/cashier/walkin",       color: "bg-primary text-primary-foreground", icon: Wallet },
            { label: "Verify Online",   href: "/cashier/online",       color: "bg-gold/90 text-primary",            icon: CreditCard },
            { label: "Verify ID/COR",   href: "/cashier/verification", color: "bg-card border border-border",       icon: ShieldCheck },
            { label: "Add Product",     href: "/cashier/products",     color: "bg-card border border-border",       icon: Package },
          ].map(({ label, href, color, icon: Icon }) => (
            <a key={label} href={href}
              className={`flex flex-col items-center gap-2 rounded-2xl p-4 text-center text-sm font-semibold transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95 ${color}`}>
              <Icon className="size-6" />
              {label}
            </a>
          ))}
        </div>

        {/* Sales trend */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-base">
                <TrendingUp className="size-4 text-gold" /> Sales Trend This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MiniBarChart data={DAILY} labels={LABELS} color="oklch(0.4 0.13 20)" />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-primary/10 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Walk-in</p>
                  <p className="font-serif text-lg font-bold text-primary">₱32,400</p>
                  <Sparkline data={[2400,3100,2000,4200,3800,5200,4500]} color="#800000" />
                </div>
                <div className="rounded-xl border border-gold/20 bg-gold/5 p-3">
                  <p className="text-xs text-muted-foreground">Online</p>
                  <p className="font-serif text-lg font-bold text-gold">₱21,600</p>
                  <Sparkline data={[1800,2400,1900,2900,2600,3600,3000]} color="#D4AF37" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verification queue */}
          <Card className="border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-base">
                <ShieldCheck className="size-4 text-primary" /> Verification Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DashTable columns={["Buyer","Type","Item","Status"]} rows={VERIFY_QUEUE} />
            </CardContent>
          </Card>
        </div>

        {/* Recent transactions */}
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <CreditCard className="size-4 text-primary" /> Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Txn ID","Buyer","Items","Amount","Method","Status"]}
              rows={RECENT_TXN}
            />
          </CardContent>
        </Card>

        {/* Inventory alerts */}
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base text-destructive">
              <AlertTriangle className="size-4" /> Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {["CICT Shirt (L) — 3 pcs","SSU Hoodie (M) — 2 pcs","HRM Apron — 5 pcs"].map((item) => (
                <span key={item} className="rounded-full border border-destructive/30 bg-background px-3 py-1 text-xs font-medium text-destructive">
                  ⚠ {item}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
