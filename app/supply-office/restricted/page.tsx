import { requireUser } from "@/lib/auth"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, DashTable, StatusBadge } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck } from "lucide-react"

const ITEMS = [
  ["Faculty Polo (M)",  "University Logo","Faculty only",    <StatusBadge key="1" status="approved" />,"Must show Faculty ID"],
  ["Staff Uniform Set", "SSU Official",   "Staff only",      <StatusBadge key="2" status="approved" />,"Must show Staff ID"],
  ["Dept Lace Bundle",  "Department",     "Student (dept)",  <StatusBadge key="3" status="pending" />, "Must show COR"],
  ["CICT Hoodie",       "SSU Logo",       "All students",    <StatusBadge key="4" status="approved" />,"COR for current sem"],
]

export default async function SupplyRestrictedPage() {
  const { email, profile } = await requireUser(["supply_office","admin"])
  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Restricted Items" description="Items that require identity or document verification before purchase." />
      <div className="mt-6">
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <ShieldCheck className="size-4 text-gold" /> Restricted Item Registry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashTable columns={["Item","Restriction Type","Eligible","Status","Requirement"]} rows={ITEMS} />
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
