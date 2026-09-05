import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, FileText, Clock, CheckCircle2, XCircle } from "lucide-react"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default async function RegistrarPage() {
  const { email, profile } = await requireUser(["registrar", "admin"])
  const supabase = await createClient()

  const { data: requests } = await supabase
    .from("verification_requests")
    .select("id, document_type, claimed_affiliation, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50)

  const all = requests ?? []
  const pending = all.filter((r) => r.status === "pending")
  const approved = all.filter((r) => r.status === "approved")
  const rejected = all.filter((r) => r.status === "rejected")

  const stats: Stat[] = [
    { label: "Pending", value: pending.length, icon: Clock, hint: "Awaiting review" },
    { label: "Approved", value: approved.length, icon: CheckCircle2, hint: "Verified members" },
    { label: "Rejected", value: rejected.length, icon: XCircle, hint: "Invalid docs" },
    { label: "Total", value: all.length, icon: FileText, hint: "Last 50" },
  ]

  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading
        title="Identity Verification"
        description="Review COR and School ID submissions to confirm legitimate university members."
      />
      <div className="mt-6">
        <StatGrid stats={stats} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <ShieldCheck className="size-5 text-primary" />
            Verification queue
          </CardTitle>
          <CardDescription>Pending submissions appear first. Full review actions open on desktop.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              No pending submissions right now.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {pending.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {AFFILIATION_LABELS[r.claimed_affiliation as Affiliation]} —{" "}
                      {r.document_type === "cor" ? "Certificate of Registration" : "School ID"}
                    </p>
                    <p className="text-xs text-muted-foreground">Submitted {formatDate(r.created_at)}</p>
                  </div>
                  <Badge variant="secondary" className="w-fit shrink-0">
                    Pending
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </ManagementShell>
  )
}
