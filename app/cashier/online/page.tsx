import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatusBadge } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, QrCode, Eye } from "lucide-react"

const ONLINE_ORDERS = [
  ["ORD-0441","Juan Dela Cruz",  "CICT Shirt × 2","₱760",  "GCash","ref-9921", <StatusBadge key="1" status="pending" />],
  ["ORD-0440","Maria Santos",    "SSU Tumbler × 1","₱290", "GCash","ref-8842", <StatusBadge key="2" status="paid" />],
  ["ORD-0439","Pedro Reyes",     "Nursing Lace × 3","₱195","GCash","ref-7731", <StatusBadge key="3" status="pending" />],
  ["ORD-0438","Ana Garcia",      "HRM Apron × 1",  "₱420", "Cash","—",        <StatusBadge key="4" status="paid" />],
]

export default async function OnlinePaymentPage() {
  const { email, profile } = await requireUser(["seller", "admin"])
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Online Payment Verification" description="Review GCash receipts, validate references, and confirm buyer payments." />
      <div className="mt-6 space-y-6">
        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Pending Review",  value: "3",    color: "border-amber-200 bg-amber-50 dark:bg-amber-500/10" },
            { label: "Verified Today",  value: "12",   color: "border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10" },
            { label: "Online Revenue",  value: "₱3,600", color: "border-primary/20 bg-primary/5" },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="font-serif text-2xl font-bold mt-1">{c.value}</p>
            </div>
          ))}
        </div>

        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <CreditCard className="size-4 text-primary" /> Online Orders Pending Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Order ID","Buyer","Items","Amount","Method","Ref #","Status"]}
              rows={ONLINE_ORDERS}
            />
          </CardContent>
        </Card>

        <Card className="border-gold/20 bg-gold/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <QrCode className="size-4 text-gold" /> GCash Verification Process
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm text-muted-foreground">
              {[
                "Buyer submits GCash reference number and receipt screenshot",
                "Cashier checks GCash reference number matches the receipt",
                "Cashier verifies amount paid equals order total",
                "Mark payment as Paid — system auto-updates inventory and order status",
                "If mismatch: mark as Invalid Payment and notify buyer via message",
              ].map((s,i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i+1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
