import Link from "next/link"
import { MODULES, type DashboardCtx } from "@/lib/modules"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColumnChart } from "@/components/analytics/charts"
import { AlertTriangle, ArrowUpDown, Boxes, ClipboardList, PackageX, ShieldCheck, TrendingDown } from "lucide-react"
import { byMonth, loadSales } from "@/lib/analytics"
import { formatDateTime } from "@/lib/admin"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"
import { cn } from "@/lib/utils"

const LOW_STOCK = 5

const MOVEMENT_LABELS: Record<string, string> = {
  sale: "Sale", restock: "Restock", cancellation: "Cancelled order", adjustment: "Adjustment", initial: "Initial",
}

type Product = { id: string; name: string; stock: number; status: string; badge: string; is_restricted: boolean | null; allowed_roles: string[] | null }

/**
 * Overview for an office store dashboard (Supply Office, Cashier branches) — everything comes from
 * that store's own records: stock, low-stock alerts, units sold, stock movement, restricted items.
 */
export async function OfficeHome({ ctx, title, description }: { ctx: DashboardCtx; title: string; description: string }) {
  const base = MODULES[ctx.module].basePath
  const storeId = ctx.storeId ?? ""
  const supabase = await createClient()

  const [productsRes, movementsRes, pendingOrders, lines] = await Promise.all([
    supabase.from("products").select("id, name, stock, status, badge, is_restricted, allowed_roles").eq("seller_id", storeId).order("stock"),
    supabase.from("inventory_movements").select("product_name, change, reason, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(8),
    supabase.from("order_items").select("order_id, orders!inner(status)").eq("seller_id", storeId).eq("orders.status", "pending"),
    loadSales(supabase, { storeId }),
  ])
  const products = (productsRes.data ?? []) as Product[]
  const movements = (movementsRes.data ?? []) as { product_name: string | null; change: number; reason: string; created_at: string }[]
  const pendingCount = new Set((pendingOrders.data ?? []).map((r) => r.order_id as string)).size
  const low = products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK)
  const out = products.filter((p) => p.stock === 0 && p.badge !== "Pre-Order")
  const restricted = products.filter((p) => p.is_restricted)
  const months = byMonth(lines, 6)

  const stats: Stat[] = [
    { label: "Products tracked", value: products.length, icon: Boxes, hint: `${products.reduce((n, p) => n + p.stock, 0)} units in stock`, accent: "primary" },
    { label: "Low stock", value: low.length, icon: TrendingDown, hint: `${LOW_STOCK} or fewer left`, accent: "gold" },
    { label: "Out of stock", value: out.length, icon: PackageX, hint: "Needs restock", accent: "red" },
    { label: "Pending orders", value: pendingCount, icon: ClipboardList, hint: "Awaiting payment check", accent: "primary" },
  ]

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title={title} description={description} />

      <div className="mt-6 space-y-6">
        <StatGrid stats={stats} />

        {products.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No products yet. <Link href={`${base}/products`} className="font-medium text-primary hover:underline">Add your first product</Link> —
            stock, sales and movement will appear here as real data comes in.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-primary/10 lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 font-serif text-base"><Boxes className="size-4 text-primary" />Units sold per month</CardTitle></CardHeader>
            <CardContent><ColumnChart ariaLabel="Units sold per month" data={months.map((m) => ({ label: m.label, value: m.items }))} /></CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 font-serif text-base text-destructive"><AlertTriangle className="size-4" />Low stock alerts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[...out, ...low].length === 0 && <p className="text-xs text-muted-foreground">All products are sufficiently stocked.</p>}
              {[...out, ...low].slice(0, 6).map((p) => (
                <div key={p.id} className="flex justify-between rounded-lg border border-destructive/20 bg-background px-3 py-2 text-xs">
                  <span className="font-medium">{p.name}</span>
                  <span className="font-bold text-destructive">{p.stock === 0 ? "Out" : `${p.stock} left`}</span>
                </div>
              ))}
              {[...out, ...low].length > 0 && <Link href={`${base}/inventory`} className="block pt-1 text-xs font-medium text-primary hover:underline">Restock in Inventory →</Link>}
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 font-serif text-base"><ArrowUpDown className="size-4 text-primary" />Latest stock movement</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {movements.length === 0 ? <p className="text-sm text-muted-foreground">No stock movement recorded yet.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">When</th><th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Type</th><th className="py-2 text-right font-medium">Change</th></tr></thead>
                <tbody>
                  {movements.map((m, i) => (
                    <tr key={m.created_at + i} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{formatDateTime(m.created_at)}</td>
                      <td className="py-2 pr-3">{m.product_name ?? "—"}</td>
                      <td className="py-2 pr-3">{MOVEMENT_LABELS[m.reason] ?? m.reason}</td>
                      <td className={cn("py-2 text-right font-semibold tabular-nums", m.change < 0 ? "text-destructive" : "text-emerald-700")}>{m.change > 0 ? `+${m.change}` : m.change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="border-gold/20 bg-gold/5">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 font-serif text-base"><ShieldCheck className="size-4 text-gold" />Restricted items</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {restricted.length === 0 ? <p className="text-muted-foreground">No restricted items.</p> : (
              <ul className="divide-y divide-border">
                {restricted.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 py-2">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{(p.allowed_roles ?? []).map((r) => AFFILIATION_LABELS[r as Affiliation] ?? r).join(", ") || "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}
