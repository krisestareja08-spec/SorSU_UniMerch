import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatusBadge } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, CheckCircle2, XCircle } from "lucide-react"

const QUEUE = [
  ["Maria Santos",  "2021-00891","Student","Faculty Polo (M)",   "COR uploaded", <StatusBadge key="1" status="pending" />],
  ["Jose Reyes",    "E-1042",    "Faculty","Staff Uniform Set",  "ID uploaded",  <StatusBadge key="2" status="approved" />],
  ["Liza Cruz",     "S-0821",    "Staff",  "Dept Lace (2 pcs)",  "ID uploaded",  <StatusBadge key="3" status="pending" />],
  ["Carlo Bernal",  "2022-01022","Student","Restricted Hoodie",  "No document",  <StatusBadge key="4" status="rejected" />],
]

export default async function VerificationPage() {
  const { email, profile } = await requireUser(["seller", "admin"])
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Account Verification (ID / COR)" description="Verify buyer identity before releasing restricted items." />
      <div className="mt-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Pending",  value: "2", icon: ShieldCheck, cls: "border-amber-200 bg-amber-50 dark:bg-amber-500/10" },
            { label: "Approved", value: "1", icon: CheckCircle2,cls: "border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10" },
            { label: "Rejected", value: "1", icon: XCircle,     cls: "border-destructive/20 bg-destructive/5" },
          ].map((c) => (
            <div key={c.label} className={`flex items-center gap-3 rounded-2xl border p-4 ${c.cls}`}>
              <c.icon className="size-6 text-current opacity-60" />
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="font-serif text-2xl font-bold">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <ShieldCheck className="size-4 text-primary" /> Verification Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable
              columns={["Buyer","ID Number","Type","Restricted Item","Documents","Status"]}
              rows={QUEUE}
            />
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Verification Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {[
              ["Faculty items","Valid Faculty ID or appointment letter required"],
              ["Staff items",  "Valid Staff ID or department certificate required"],
              ["Student-restricted","COR for current semester required"],
            ].map(([role, rule]) => (
              <div key={role as string} className="flex gap-2 items-start">
                <ShieldCheck className="size-4 shrink-0 text-gold mt-0.5" />
                <span><strong className="text-foreground">{role}:</strong> {rule}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
