import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatusBadge } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Store, CheckSquare } from "lucide-react"

const SELLERS = [
  ["CICT Student Council",  "seller@cict.edu.ph",  "12 products","₱38,400", <StatusBadge key="1" status="approved" />, "Aug 2024"],
  ["Nursing Organisation",  "nursing@sorsu.edu.ph","8 products", "₱22,150", <StatusBadge key="2" status="approved" />, "Jan 2025"],
  ["Engineering Society",   "engineering@sorsu",   "6 products", "₱15,600", <StatusBadge key="3" status="approved" />, "Mar 2025"],
  ["SSC Bulan Campus",      "ssc@sorsu.edu.ph",    "4 products", "₱11,200", <StatusBadge key="4" status="approved" />, "Nov 2024"],
  ["CBA Council",           "cba@sorsu.edu.ph",    "5 products", "—",       <StatusBadge key="5" status="rejected" />,  "Feb 2025"],
  ["HRM Department",        "hrm@sorsu.edu.ph",    "0 products", "—",       <StatusBadge key="6" status="pending" />,   "Aug 2026"],
]

export default async function BaoSellersPage() {
  const { email, profile } = await requireUser(["bao","admin"])
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Seller Management" description="Directory of all accredited organisations and vendors on the marketplace." />
      <div className="mt-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[["Active Sellers","4","border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10"],["Pending Approval","1","border-amber-200 bg-amber-50 dark:bg-amber-500/10"],["Suspended","1","border-destructive/20 bg-destructive/5"]].map(([l,v,c]) => (
            <div key={l as string} className={`rounded-2xl border p-4 ${c}`}>
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="font-serif text-2xl font-bold mt-1">{v}</p>
            </div>
          ))}
        </div>
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <Users className="size-4 text-primary" /> Seller Directory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Organisation","Email","Products","Revenue","Standing","Accredited"]}
              rows={SELLERS}
            />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
