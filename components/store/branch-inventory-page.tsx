import Image from "next/image"
import Link from "next/link"
import { Fragment } from "react"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Boxes, Inbox } from "lucide-react"
import { StockControl } from "@/components/store/stock-control"
import { BranchRequestsList, type BranchRequest } from "@/components/store/branch-requests"
import type { DashboardCtx } from "@/lib/modules"
import { cn } from "@/lib/utils"

type Branch = { store_id: string; name: string; campus: string | null }
type InvRow = {
  product_id: string; product_name: string; image_url: string | null; product_status: string; product_stock: number
  variant_id: string | null; variant_name: string | null; variant_stock: number | null
}

const LOW = 5
const tone = (n: number) => (n === 0 ? "text-destructive" : n <= LOW ? "text-amber-700" : "")

/**
 * Main Supply Office: its branches' restock requests and damage / defect reports, and each
 * branch's stock (the Main office supplies the branches, so it adds and counts their stock).
 */
export async function BranchInventoryPage({ ctx, tab, branchId }: { ctx: DashboardCtx; tab: "requests" | "stock"; branchId?: string }) {
  const supabase = await createClient()
  const [branchesRes, requestsRes] = await Promise.all([
    supabase.rpc("supply_branches"),
    supabase.from("branch_stock_requests")
      .select("id, branch_store_id, kind, product_name, quantity, reason, note, status, fulfilled_quantity, main_note, created_at, reviewed_at")
      .order("created_at", { ascending: false }).limit(300),
  ])
  const setupMissing = branchesRes.error || requestsRes.error
  const branches = (branchesRes.data ?? []) as Branch[]
  const requests = ((requestsRes.data ?? []) as BranchRequest[])
    // Waiting requests first, oldest first; then the reviewed ones, newest first
    .sort((a, b) => (a.status === "pending") !== (b.status === "pending") ? (a.status === "pending" ? -1 : 1)
      : a.status === "pending" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at))
  const branchNames = Object.fromEntries(branches.map((b) => [b.store_id, b.name]))
  const pending = requests.filter((r) => r.status === "pending").length

  const selected = branches.find((b) => b.store_id === branchId) ?? branches[0]
  const { data: invRows } = tab === "stock" && selected ? await supabase.rpc("branch_inventory", { p_store: selected.store_id }) : { data: null }
  const products = new Map<string, { name: string; image: string | null; status: string; stock: number; sizes: { id: string; name: string; stock: number }[] }>()
  for (const r of (invRows ?? []) as InvRow[]) {
    const p = products.get(r.product_id) ?? { name: r.product_name, image: r.image_url, status: r.product_status, stock: r.product_stock, sizes: [] }
    if (r.variant_id) p.sizes.push({ id: r.variant_id, name: r.variant_name ?? "", stock: r.variant_stock ?? 0 })
    products.set(r.product_id, p)
  }

  const base = "/supply-office/branch-inventory"
  const tabLink = (t: "requests" | "stock", label: string) => (
    <Link href={t === "stock" && selected ? `${base}?tab=stock&branch=${selected.store_id}` : `${base}?tab=${t}`} aria-current={tab === t ? "page" : undefined}
      className={cn("flex-1 rounded-lg py-1.5 text-center text-sm font-medium transition-colors", tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
      {label}
    </Link>
  )

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Branch Inventory"
        description="The Main Supply Office supplies its branches: send the stock they ask for, take back damaged or defective items, and add to or count each branch's stock." />

      {setupMissing ? (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Branch inventory needs the latest <code>scripts/31_supply_office_branches.sql</code>. Ask the admin to run it in Supabase.
        </p>
      ) : (
        <>
          <div className="mt-6 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
            {tabLink("requests", `Requests${pending ? ` (${pending})` : ""}`)}
            {tabLink("stock", "Branch stock")}
          </div>

          {tab === "requests" ? (
            <Card className="mt-4">
              <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Inbox className="size-4 text-primary" />Restock requests &amp; damage reports</CardTitle></CardHeader>
              <CardContent><BranchRequestsList requests={requests} mode="main" branchNames={branchNames} /></CardContent>
            </Card>
          ) : branches.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No Supply Office branches yet.</p>
          ) : (
            <Card className="mt-4">
              <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 font-serif text-base"><Boxes className="size-4 text-primary" />{selected?.name}</CardTitle>
                <nav aria-label="Branches" className="flex flex-wrap gap-1.5">
                  {branches.map((b) => (
                    <Link key={b.store_id} href={`${base}?tab=stock&branch=${b.store_id}`} aria-current={b.store_id === selected?.store_id ? "page" : undefined}
                      className={cn("rounded-full border px-3 py-1 text-xs font-medium", b.store_id === selected?.store_id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
                      {b.name.replace(/^Supply Office — /, "")}
                    </Link>
                  ))}
                </nav>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-160 text-sm">
                  <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Product</th><th className="py-2 pr-3 text-right font-medium">In stock</th><th className="py-2 font-medium">Update branch stock</th></tr></thead>
                  <tbody>
                    {products.size === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">This branch has no products yet.</td></tr>}
                    {[...products].map(([id, p]) => (
                      <Fragment key={id}>
                        <tr className={cn("align-middle", p.sizes.length ? "" : "border-b border-border/60")}>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-muted">{p.image && <Image src={p.image} alt="" fill className="object-cover" sizes="36px" />}</div>
                              <div><p className="font-medium">{p.name}</p><p className="text-xs capitalize text-muted-foreground">{p.status}{p.sizes.length ? ` · ${p.sizes.length} sizes` : ""}</p></div>
                            </div>
                          </td>
                          <td className={cn("py-2 pr-3 text-right font-semibold tabular-nums", tone(p.stock))}>{p.stock}</td>
                          <td className="py-2">
                            {p.sizes.length
                              ? <span className="text-xs text-muted-foreground">Total of all sizes — update each size below</span>
                              : <StockControl module="supply_office" productId={id} current={p.stock} branchStoreId={selected!.store_id} />}
                          </td>
                        </tr>
                        {p.sizes.map((v, i) => (
                          <tr key={v.id} className={cn("align-middle bg-muted/20", i === p.sizes.length - 1 && "border-b border-border/60")}>
                            <td className="py-1.5 pl-11 pr-3 font-medium">{v.name}</td>
                            <td className={cn("py-1.5 pr-3 text-right font-semibold tabular-nums", tone(v.stock))}>{v.stock}</td>
                            <td className="py-1.5"><StockControl module="supply_office" productId={id} variantId={v.id} current={v.stock} branchStoreId={selected!.store_id} /></td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </ManagementShell>
  )
}
