import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { BaoApprovalCard } from "@/components/bao/approval-card"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react"

export default async function BaoApprovalsPage() {
  const { email, profile } = await requireUser(["bao", "admin"])
  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, description, category, price, image_url, stock, status, bao_comment, badge, created_at, seller_id")
    .order("created_at", { ascending: true })

  const all = products ?? []
  const pending  = all.filter((p) => p.status === "pending")
  const approved = all.filter((p) => p.status === "approved")
  const rejected = all.filter((p) => p.status === "rejected")

  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Product Approvals" description="Review seller-submitted products. Approved products go live on the marketplace." />

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "Pending",  count: pending.length,  icon: Clock,         color: "text-amber-600 dark:text-amber-400" },
          { label: "Approved", count: approved.length, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Rejected", count: rejected.length, icon: XCircle,      color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label} className="border-primary/10 p-4">
            <s.icon className={`size-4 ${s.color}`} />
            <p className={`mt-1 font-serif text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          Could not load products — run the database migration (scripts/migration.sql) first.
        </div>
      )}

      <div className="mt-6 space-y-4">
        <h2 className="font-serif text-lg font-semibold text-foreground">Pending Review ({pending.length})</h2>
        {pending.length === 0 && !error ? (
          <Card className="border-primary/10">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No pending submissions right now.
            </CardContent>
          </Card>
        ) : (
          pending.map((p) => <BaoApprovalCard key={p.id} product={p} />)
        )}
      </div>

      {(approved.length > 0 || rejected.length > 0) && (
        <div className="mt-8">
          <h2 className="font-serif text-lg font-semibold text-foreground">Recently Reviewed</h2>
          <div className="mt-3 space-y-3">
            {[...approved, ...rejected]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 10)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category} · ₱{Number(p.price).toLocaleString()}</p>
                    {p.bao_comment && <p className="mt-1 text-xs text-destructive">BAO: {p.bao_comment}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${p.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>
                    {p.status === "approved" ? "Approved" : "Rejected"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </ManagementShell>
  )
}
