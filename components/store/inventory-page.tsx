import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Boxes, History, PackageX, Send, TrendingDown } from "lucide-react"
import { StockControl } from "@/components/store/stock-control"
import { BranchRequestsList, BranchStockActions, type BranchRequest } from "@/components/store/branch-requests"
import { formatDateTime } from "@/lib/admin"
import { MODULES, type DashboardCtx } from "@/lib/modules"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Fragment } from "react"
import { loadVariants } from "@/lib/variants"

const LOW_STOCK = 5

const REASON_LABELS: Record<string, string> = {
  sale: "Sale", restock: "Restock", cancellation: "Cancelled order", adjustment: "Adjustment", initial: "Initial",
}

type ProductRow = { id: string; name: string; category: string; stock: number; status: string; badge: string; image_url: string | null; supply_office_collab?: boolean }

const stockTone = (n: number) => (n === 0 ? "text-destructive" : n <= LOW_STOCK ? "text-amber-700" : "")
const stockNote = (n: number) => (n === 0 ? " · out of stock" : n <= LOW_STOCK ? " · low" : "")

/**
 * Inventory management for a store: current stock, low-stock alerts, restock / adjustment,
 * and the movement history (sales reduce stock automatically; cancellations return it).
 * Supply Office branches are stocked by the Main Supply Office: they see their stock, ask for
 * restocks and report damaged / defective units instead of changing stock (scripts/31).
 */
export async function InventoryPage({ ctx }: { ctx: DashboardCtx }) {
  const supabase = await createClient()
  const branch = ctx.module === "cashier"
  const [{ data: productRows }, movementsRes, requestsRes] = await Promise.all([
    // "*": supply_office_collab arrives with scripts/32
    supabase.from("products").select("*").eq("seller_id", ctx.storeId ?? "").order("stock", { ascending: true }),
    supabase.from("inventory_movements").select("product_name, change, reason, note, created_at").eq("store_id", ctx.storeId ?? "").order("created_at", { ascending: false }).limit(50),
    branch
      ? supabase.from("branch_stock_requests")
          .select("id, branch_store_id, kind, product_name, quantity, reason, note, status, fulfilled_quantity, main_note, created_at, reviewed_at")
          .eq("branch_store_id", ctx.storeId ?? "").order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: null, error: null }),
  ])
  const requests = (requestsRes.data ?? []) as BranchRequest[]
  const supplyHref = `${MODULES[ctx.module].basePath}/supply-requests/new`
  const products = (productRows ?? []) as ProductRow[]
  // Products with sizes keep stock per size (scripts/28); restocks and adjustments go to that size
  const variantsByProduct = (await loadVariants(supabase, products.map((p) => p.id))) ?? new Map()
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
      <PageHeading title="Inventory" description={branch
        ? "Your branch's stock comes from the Main Supply Office. Sales take items out automatically; use Request restock when you need more, or Report damaged / defective to send units back."
        : "Stock levels for your products. Sales take items out of stock automatically and cancelled orders put them back; use Update stock to add units you received, remove units that are lost or damaged, or set the total you counted."} />
      <div className="mt-6"><StatGrid stats={stats} /></div>
      {ctx.module === "supply_office" && (
        <p className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
          Stock of your branches and of organizations&apos; collaboration products is managed in{" "}
          <Link href="/supply-office/branch-inventory?tab=collab" className="font-medium text-primary hover:underline">Branch &amp; Collab Inventory</Link>.
        </p>
      )}

      {branch && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Send className="size-4 text-primary" />My requests to the Main Supply Office</CardTitle></CardHeader>
          <CardContent>
            {requestsRes.error
              ? <p className="text-sm text-muted-foreground">Restock requests arrive with the latest <code>scripts/31_supply_office_branches.sql</code>. Ask the admin to run it in Supabase.</p>
              : <BranchRequestsList requests={requests} mode="branch" />}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Boxes className="size-4 text-primary" />Stock levels</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-170 text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Product</th><th className="py-2 pr-3 text-right font-medium">In stock</th>
              <th className="py-2 pr-3 font-medium">Status</th><th className="py-2 font-medium">{branch ? "Main Supply Office" : "Update stock"}</th></tr></thead>
            <tbody>
              {products.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No products yet.</td></tr>}
              {products.map((p) => {
                const variants = variantsByProduct.get(p.id) ?? []
                return (
                  <Fragment key={p.id}>
                    <tr className={cn("align-middle", variants.length ? "" : "border-b border-border/60 last:border-0")}>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-muted">{p.image_url && <Image src={p.image_url} alt="" fill className="object-cover" sizes="36px" />}</div>
                          <div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}{variants.length ? ` · ${variants.length} sizes` : ""}</p></div>
                        </div>
                      </td>
                      <td className={cn("py-2 pr-3 text-right font-semibold tabular-nums", stockTone(p.stock))}>{p.stock}</td>
                      <td className="py-2 pr-3 text-xs capitalize text-muted-foreground">{p.status}{stockNote(p.stock)}</td>
                      <td className="py-2">
                        {variants.length
                          ? <span className="text-xs text-muted-foreground">Total of all sizes — {branch ? "request per size below" : "adjust each size below"}</span>
                          : branch ? <BranchStockActions productId={p.id} stock={p.stock} />
                          : p.supply_office_collab ? <CollabStockNote href={supplyHref} />
                          : <StockControl module={ctx.module} productId={p.id} current={p.stock} />}
                      </td>
                    </tr>
                    {variants.map((v: { id: string; name: string; stock: number; sku: string | null }, i: number) => (
                      <tr key={v.id} className={cn("align-middle bg-muted/20", i === variants.length - 1 && "border-b border-border/60")}>
                        <td className="py-1.5 pl-11 pr-3 text-sm">
                          <span className="font-medium">{v.name}</span>
                          {v.sku && <span className="ml-2 text-xs text-muted-foreground">SKU {v.sku}</span>}
                        </td>
                        <td className={cn("py-1.5 pr-3 text-right font-semibold tabular-nums", stockTone(v.stock))}>{v.stock}</td>
                        <td className="py-1.5 pr-3 text-xs text-muted-foreground">{stockNote(v.stock).replace(" · ", "") || "in stock"}</td>
                        <td className="py-1.5">{branch
                          ? <BranchStockActions productId={p.id} variantId={v.id} stock={v.stock} />
                          : p.supply_office_collab ? <CollabStockNote href={supplyHref} />
                          : <StockControl module={ctx.module} productId={p.id} variantId={v.id} current={v.stock} />}</td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
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

/** Collaboration products: stock comes from the Main Supply Office through a paid supply order */
function CollabStockNote({ href }: { href: string }) {
  return (
    <span className="text-xs text-muted-foreground">
      Stocked by the Main Supply Office · <Link href={href} className="font-medium text-primary hover:underline">Order stock</Link>
    </span>
  )
}
