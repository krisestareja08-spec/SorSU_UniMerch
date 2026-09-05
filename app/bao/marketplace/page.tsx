import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, DashTable, StatusBadge, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Boxes, CheckSquare, Clock, Store } from "lucide-react"

export default async function Page() {
  const { email, profile } = await requireUser(["bao", "admin"])
  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, category, price, stock, status, badge, seller_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50)

  const items = products ?? []
  const approved = items.filter((p) => p.status === "approved").length
  const pending = items.filter((p) => p.status === "pending").length
  const rejected = items.filter((p) => p.status === "rejected").length

  const stats: Stat[] = [
    { label: "Live listings", value: approved, icon: CheckSquare, hint: "Approved", accent: "green" },
    { label: "Pending review", value: pending, icon: Clock, hint: "Awaiting BAO", accent: "red" },
    { label: "Rejected", value: rejected, icon: Boxes, hint: "Not listed" },
    { label: "Total catalog", value: items.length, icon: Store, hint: "Most recent 50" },
  ]

  const rows = items.map((p) => [
    p.name,
    p.category,
    `₱${Number(p.price).toLocaleString()}`,
    String(p.stock),
    p.badge,
    <StatusBadge key={p.id} status={p.status as "pending" | "approved" | "rejected"} />,
  ])

  return (
    <ManagementShell role={profile.role} fullName={profile.full_name} email={email}>
      <PageHeading title="Marketplace Oversight" description="Read-only view of the live catalog across all seller organisations." />
      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle className="size-4 shrink-0" />
            Could not load the catalog — run scripts/fix-schema.sql in Supabase.
          </div>
        )}
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-base">
              <Store className="size-4 text-primary" /> Catalog
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No products listed yet.</p>
            ) : (
              <DashTable columns={["Product", "Category", "Price", "Stock", "Badge", "Status"]} rows={rows} />
            )}
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}

