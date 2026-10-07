import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Boxes, History, PackageX, TrendingDown } from "lucide-react"
import { adjustStock } from "@/app/store-actions"
import { formatDateTime } from "@/lib/admin"
import type { DashboardCtx } from "@/lib/modules"
import { cn } from "@/lib/utils"
import { ActionForm } from "@/components/ui/action-form"

const LOW_STOCK = 5

const REASON_LABELS: Record<string, string> = {
  sale: "Sale", restock: "Restock", cancellation: "Cancelled order", adjustment: "Adjustment", initial: "Initial",
}

type ProductRow = { id: string; name: string; category: string; stock: number; status: string; badge: string; image_url: string | null }

/**
 * Inventory management for a store: current stock, low-stock alerts, restock / adjustment,
 * and the movement history (sales reduce stock automatically; cancellations return it).
 */
export async function InventoryPage({ ctx }: { ctx: DashboardCtx }) {
  const supabase = await createClient()
  const [{ data: productRows }, movementsRes] = await Promise.all([
    supabase.from("products").select("id, name, category, stock, status, badge, image_url").eq("seller_id", ctx.storeId ?? "").order("stock", { ascending: true }),
    supabase.from("inventory_movements").select("product_name, change, reason, note, created_at").eq("store_id", ctx.storeId ?? "").order("created_at", { ascending: false }).limit(50),
  ])
  const products = (productRows ?? []) as ProductRow[]
  const movements = (movementsRes.data ?? []) as { product_name: string | null; change: number; reason: string; note: string | null; created_at: string }[]
  const totalUnits = products.reduce((n, p) => n + p.stock, 0)
  const low = products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length
  const out = products.filter((p) => p.stock === 0 && p.badge !== "Pre-Order").length
  const soldRecently = movements.filter((m) => m.reason === "sale").reduce((n, m) => n - m.change, 0)

  const stats: Stat[] = [
    { label: "Units in stock", value: totalUnits, icon: Boxes, hint: `${products.length} products`, accent: "primary" },
    { label: "Low stock", value: low, icon: AlertTriangle, hint: `${LOW_STOCK} or fewer left`, accent: "gold" },
    { label: "Out of stock", value: out, icon: PackageX, hint: "Buyers can't order", accent: "red" },
    { label: "Recently sold", value: soldRecently, icon: TrendingDown, hint: "Units in latest movements", accent: "green" },
  ]

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Inventory" description="Stock levels for your products. Sales take items out of stock automatically and cancelled orders put them back; record restocks and corrections here." />
      <div className="mt-6"><StatGrid stats={stats} /></div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Boxes className="size-4 text-primary" />Stock levels</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-180 text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Product</th><th className="py-2 pr-3 text-right font-medium">In stock</th>
              <th className="py-2 pr-3 font-medium">Status</th><th className="py-2 font-medium">Restock / adjust</th></tr></thead>
            <tbody>
              {products.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No products yet.</td></tr>}
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border/60 align-middle last:border-0">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-muted">{p.image_url && <Image src={p.image_url} alt="" fill className="object-cover" sizes="36px" />}</div>
                      <div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></div>
                    </div>
                  </td>
                  <td className={cn("py-2 pr-3 text-right font-semibold tabular-nums", p.stock === 0 ? "text-destructive" : p.stock <= LOW_STOCK ? "text-amber-700" : "")}>{p.stock}</td>
                  <td className="py-2 pr-3 text-xs capitalize text-muted-foreground">{p.status}{p.stock === 0 ? " · out of stock" : p.stock <= LOW_STOCK ? " · low" : ""}</td>
                  <td className="py-2">
                    <ActionForm action={adjustStock} className="flex flex-wrap items-center gap-1.5">
                      <input type="hidden" name="module" value={ctx.module} />
                      <input type="hidden" name="product_id" value={p.id} />
                      <select name="reason" className="h-8 rounded-lg border border-input bg-background px-2 text-xs" aria-label="Type">
                        <option value="restock">Restock (+)</option>
                        <option value="adjustment">Adjustment (±)</option>
                      </select>
                      <input name="change" type="number" required placeholder="Qty" className="h-8 w-20 rounded-lg border border-input bg-background px-2 text-xs" aria-label="Quantity" />
                      <input name="note" placeholder="Note" className="h-8 w-32 rounded-lg border border-input bg-background px-2 text-xs" aria-label="Note" />
                      <button type="submit" className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Save</button>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><History className="size-4 text-primary" />Stock movement</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {movementsRes.error ? (
            <p className="text-sm text-muted-foreground">Stock movement history arrives with <code>scripts/15_bao_bi.sql</code>.</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock movement recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">When</th><th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 font-medium">Type</th><th className="py-2 pr-3 text-right font-medium">Change</th><th className="py-2 font-medium">Note</th></tr></thead>
              <tbody>
                {movements.map((m, i) => (
                  <tr key={m.created_at + i} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{formatDateTime(m.created_at)}</td>
                    <td className="py-2 pr-3">{m.product_name ?? "—"}</td>
                    <td className="py-2 pr-3">{REASON_LABELS[m.reason] ?? m.reason}</td>
                    <td className={cn("py-2 pr-3 text-right font-semibold tabular-nums", m.change < 0 ? "text-destructive" : "text-emerald-700")}>{m.change > 0 ? `+${m.change}` : m.change}</td>
                    <td className="py-2 text-xs text-muted-foreground">{m.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </ManagementShell>
  )
}
