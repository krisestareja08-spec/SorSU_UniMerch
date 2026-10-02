import { requireDashboard } from "@/lib/dashboards"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatGrid, StatusBadge, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, QrCode, Wallet, RefreshCw } from "lucide-react"

const PAYMENTS = [
  ["TXN-0441","Juan Dela Cruz", "CICT Shirt × 2","₱760",  "Cash",  "Aug 17", "ref-—",   <StatusBadge key="1" status="paid" />],
  ["TXN-0440","Maria Santos",   "SSU Tumbler × 1","₱290", "GCash", "Aug 17", "ref-8842",<StatusBadge key="2" status="paid" />],
  ["TXN-0439","Pedro Reyes",    "Nursing Lace × 3","₱195","GCash", "Aug 16", "ref-7731",<StatusBadge key="3" status="pending" />],
  ["TXN-0438","Ana Garcia",     "HRM Apron × 1",  "₱420", "Cash",  "Aug 16", "ref-—",   <StatusBadge key="4" status="paid" />],
]

export default async function SellerPaymentsPage() {
  const ctx = await requireDashboard("seller", "payments")
  const stats: Stat[] = [
    { label: "Walk-in Revenue",  value: "₱21,400", icon: Wallet,     hint: "Cash payments",   accent: "primary" },
    { label: "Online Revenue",   value: "₱12,800", icon: CreditCard, hint: "GCash verified",  accent: "gold" },
    { label: "Pending Payments", value: 1,          icon: RefreshCw,  hint: "Awaiting verify", accent: "red" },
    { label: "Refunds Issued",   value: 0,          icon: RefreshCw,  hint: "This month",      accent: "primary" },
  ]
  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Payment Transactions" description="Your shop payment logs. Sales data is confidential to your organisation only." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <CreditCard className="size-4 text-primary" /> Payment Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Txn ID","Buyer","Items","Amount","Method","Date","Ref #","Status"]}
              rows={PAYMENTS}
            />
          </CardContent>
        </Card>
        <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-sm text-muted-foreground">
          🔒 Your payment data is <strong className="text-foreground">private to your organisation</strong>. Only the BAO and Cashier can view consolidated sales reports.
        </div>
      </div>
    </ManagementShell>
  )
}
