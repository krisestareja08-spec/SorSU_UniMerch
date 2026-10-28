import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { Callout, PageHeading, StatGrid, TabLinks, type Stat } from "@/components/management/dashboard-ui"
import { AlertTriangle, Boxes, Handshake, PackageX, Search, Truck, TrendingDown } from "lucide-react"
import { StockControl } from "@/components/store/stock-control"
import { BranchRequestsList, BranchStockActions, type BranchRequest } from "@/components/store/branch-requests"
import { LOW_STOCK, StockList, type StockItem } from "@/components/store/stock-list"
import { ProductThumb } from "@/components/ui/product-thumb"
import { formatDateTime } from "@/lib/admin"
import { MODULES, type DashboardCtx } from "@/lib/modules"
import { cn } from "@/lib/utils"
import { loadVariants } from "@/lib/variants"

const REASON_LABELS: Record<string, string> = {
  sale: "Sale", restock: "Restock", cancellation: "Cancelled order", adjustment: "Adjustment", initial: "Initial",
}

type ProductRow = { id: string; name: string; category: string; stock: number; status: string; badge: string; image_url: string | null; supply_office_collab?: boolean }
type Movement = { product_id: string | null; product_name: string | null; change: number; reason: string; note: string | null; created_at: string }

/**
 * Inventory for a store, in three views: Stock (each product and size with its stock and action),
 * Requests (branches: what they asked the Main Supply Office for) and History (every stock change).
 * Sales take stock automatically and cancellations return it. Supply Office branches and
 * organizations' collaboration products are stocked by the Main Supply Office (scripts/31).
 */
export async function InventoryPage({ ctx, view, filter, q }: { ctx: DashboardCtx; view?: string; filter?: string; q?: string }) {
  const supabase = await createClient()
  const branch = ctx.module === "cashier"
  const base = `${MODULES[ctx.module].basePath}/inventory`
  const tab = view === "history" ? "history" : view === "requests" && branch ? "requests" : "stock"
  const [{ data: productRows }, movementsRes, requestsRes] = await Promise.all([
    // "*": supply_office_collab arrives with scripts/32
    supabase.from("products").select("*").eq("seller_id", ctx.storeId ?? "").order("name"),
    supabase.from("inventory_movements").select("product_id, product_name, change, reason, note, created_at").eq("store_id", ctx.storeId ?? "").order("created_at", { ascending: false }).limit(tab === "history" ? 200 : 50),
    branch
      ? supabase.from("branch_stock_requests")
          .select("*").eq("branch_store_id", ctx.storeId ?? "").order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: null, error: null }),
  ])
  const requests = (requestsRes.data ?? []) as BranchRequest[]
  const waiting = requests.filter((r) => r.status === "pending").length
  const supplyHref = `${MODULES[ctx.module].basePath}/supply-requests/new`
  const products = (productRows ?? []) as ProductRow[]
  const imageOf = new Map(products.map((p) => [p.id, p.image_url]))
  // Products with sizes keep stock per size (scripts/28); changes go to that size
  const variantsByProduct = (await loadVariants(supabase, products.map((p) => p.id))) ?? new Map()
  const movements = (movementsRes.data ?? []) as Movement[]
  const totalUnits = products.reduce((n, p) => n + p.stock, 0)
  const low = products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length
  const out = products.filter((p) => p.stock === 0 && p.badge !== "Pre-Order").length
  const soldRecently = movements.filter((m) => m.reason === "sale").reduce((n, m) => n - m.change, 0)

  const stats: Stat[] = [
    { label: "Units in stock", value: totalUnits, icon: Boxes, hint: `${products.length} products`, accent: "primary" },
    { label: "Low stock", value: low, icon: AlertTriangle, hint: `${LOW_STOCK} or fewer left`, accent: "gold" },
    { label: "Out of stock", value: out, icon: PackageX, hint: "Buyers can't order", accent: "red" },
    { label: "Recently sold", value: soldRecently, icon: TrendingDown, hint: "Units in latest changes", accent: "green" },
  ]

  // Stock view: filter (all / low / out) and search
  const query = (q ?? "").trim().toLowerCase()
  const items: StockItem[] = products
    .filter((p) => (filter === "low" ? p.stock > 0 && p.stock <= LOW_STOCK : filter === "out" ? p.stock === 0 : true))
    .filter((p) => !query || p.name.toLowerCase().includes(query))
    .map((p) => ({
      id: p.id, name: p.name, image: p.image_url, stock: p.stock,
      subtitle: <><span>{p.category}</span>{p.status !== "approved" && <span className="capitalize">· {p.status}</span>}
        {p.supply_office_collab && <span className="inline-flex items-center gap-1 text-amber-800 dark:text-gold"><Handshake className="size-3" />Collaboration</span>}</>,
      sizes: (variantsByProduct.get(p.id) ?? []).map((v: { id: string; name: string; stock: number; sku: string | null }) => ({ id: v.id, name: v.name, stock: v.stock, sku: v.sku })),
    }))
  const collabById = new Map(products.map((p) => [p.id, !!p.supply_office_collab]))
  const filterHref = (f?: string) => `${base}?${new URLSearchParams({ ...(f ? { filter: f } : {}), ...(q ? { q } : {}) })}`

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Inventory" description={branch
        ? "Your branch's stock comes from the Main Supply Office. Sales take units out automatically."
        : "Stock levels for your products. Sales take units out automatically; cancelled orders put them back."} />

      <div className="mt-5 space-y-4">
        {branch && (
          <Callout icon={Truck} action={waiting > 0 ? <Link href={`${base}?view=requests`} className="text-sm font-semibold text-primary hover:underline">{waiting} waiting →</Link> : undefined}>
            Need more, or found damaged / defective items? Tap <strong>Request</strong> on the product to ask the Main Supply Office.
          </Callout>
        )}
        {ctx.module === "supply_office" && (
          <Callout icon={Boxes} action={<Link href="/supply-office/branch-inventory" className="text-sm font-semibold text-primary hover:underline">Open →</Link>}>
            Your branches&apos; and organizations&apos; collaboration stock is in <strong>Branch &amp; Collab Inventory</strong>.
          </Callout>
        )}
        <StatGrid stats={stats} />

        <TabLinks tabs={[
          { href: base, label: "Stock", active: tab === "stock" },
          ...(branch ? [{ href: `${base}?view=requests`, label: "My requests", count: waiting, active: tab === "requests" }] : []),
          { href: `${base}?view=history`, label: "History", active: tab === "history" },
        ]} />

        {tab === "stock" && (
          <section className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <form action={base} className="relative min-w-0 flex-1">
                {filter && <input type="hidden" name="filter" value={filter} />}
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input name="q" defaultValue={q ?? ""} type="search" placeholder="Search products" aria-label="Search products"
                  className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm" />
              </form>
              <nav aria-label="Show" className="flex gap-1.5">
                {([[undefined, `All (${products.length})`], ["low", `Low (${low})`], ["out", `Out (${products.filter((p) => p.stock === 0).length})`]] as const).map(([f, l]) => (
                  <Link key={l} href={filterHref(f)} aria-current={filter === f ? "page" : undefined}
                    className={cn("rounded-full border px-3 py-1 text-xs font-medium", (filter ?? undefined) === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{l}</Link>
                ))}
              </nav>
            </div>
            <StockList items={items}
              empty={products.length === 0 ? "No products yet. Add one in Products." : "No products match."}
              action={(p, s) => {
                const product = { name: p.name, image: p.image, size: s?.name ?? null }
                const current = s ? s.stock : p.stock
                if (branch) return <BranchStockActions productId={p.id} variantId={s?.id} stock={current} product={product} />
                if (collabById.get(p.id)) return <Link href={supplyHref} className="text-xs font-semibold text-primary hover:underline">Order stock from Main →</Link>
                return <StockControl module={ctx.module} productId={p.id} variantId={s?.id} current={current} product={product} />
              }} />
          </section>
        )}

        {tab === "requests" && (
          requestsRes.error
            ? <Callout tone="warn">Restock requests arrive with the latest <code>scripts/31_supply_office_branches.sql</code>. Ask the admin to run it in Supabase.</Callout>
            : <BranchRequestsList requests={requests} mode="branch" />
        )}

        {tab === "history" && (
          movementsRes.error ? (
            <Callout tone="warn">Stock history arrives with <code>scripts/15_bao_bi.sql</code>.</Callout>
          ) : movements.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No stock changes recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {movements.map((m, i) => (
                <li key={m.created_at + i} className="flex items-center gap-3 px-3 py-2.5">
                  <ProductThumb src={m.product_id ? imageOf.get(m.product_id) : null} alt="" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.product_name ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{REASON_LABELS[m.reason] ?? m.reason} · {formatDateTime(m.created_at)}{m.note ? ` · ${m.note}` : ""}</p>
                  </div>
                  <span className={cn("shrink-0 font-serif text-base font-bold tabular-nums", m.change < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
                    {m.change > 0 ? `+${m.change}` : m.change}
                  </span>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </ManagementShell>
  )
}
