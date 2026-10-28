import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { Callout, PageHeading, TabLinks } from "@/components/management/dashboard-ui"
import { Handshake, Info } from "lucide-react"
import { StockControl } from "@/components/store/stock-control"
import { BranchRequestsList, type BranchRequest } from "@/components/store/branch-requests"
import { CollabStockOrder } from "@/components/store/collab-stock-order"
import { StockList, type StockItem } from "@/components/store/stock-list"
import { getGlobalRoyaltyPercentage } from "@/lib/bao-settings"
import type { DashboardCtx } from "@/lib/modules"
import { cn } from "@/lib/utils"

type Branch = { store_id: string; name: string; campus: string | null }
type InvRow = {
  product_id: string; product_name: string; image_url: string | null; product_status: string; product_stock: number
  variant_id: string | null; variant_name: string | null; variant_stock: number | null
}
type CollabRow = {
  store_id: string; store_name: string; product_id: string; product_name: string; image_url: string | null; product_status: string
  price: number; logo: boolean; product_stock: number; variant_id: string | null; variant_name: string | null; variant_price: number | null; variant_stock: number | null
}
export type InventoryTab = "requests" | "stock" | "collab"

/**
 * Main Supply Office: its branches' restock requests and damage / defect reports, each branch's
 * stock (the Main office supplies the branches, so it adds and counts their stock), and the stock of
 * organizations' collaboration products (sent as paid stock orders; corrections only otherwise).
 */
export async function BranchInventoryPage({ ctx, tab, branchId }: { ctx: DashboardCtx; tab: InventoryTab; branchId?: string }) {
  const supabase = await createClient()
  const [branchesRes, requestsRes] = await Promise.all([
    supabase.rpc("supply_branches"),
    supabase.from("branch_stock_requests").select("*").order("created_at", { ascending: false }).limit(300),
  ])
  const setupMissing = branchesRes.error || requestsRes.error
  const branches = (branchesRes.data ?? []) as Branch[]
  const requests = ((requestsRes.data ?? []) as BranchRequest[])
    // Waiting requests first, oldest first; then the reviewed ones, newest first
    .sort((a, b) => (a.status === "pending") !== (b.status === "pending") ? (a.status === "pending" ? -1 : 1)
      : a.status === "pending" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at))
  const branchNames = Object.fromEntries(branches.map((b) => [b.store_id, b.name]))
  const pending = requests.filter((r) => r.status === "pending").length
  const pendingBy = (id: string) => requests.filter((r) => r.status === "pending" && r.branch_store_id === id).length

  // One branch's stock
  const selected = branches.find((b) => b.store_id === branchId) ?? branches[0]
  const { data: invRows } = tab === "stock" && selected ? await supabase.rpc("branch_inventory", { p_store: selected.store_id }) : { data: null }
  const branchItems = new Map<string, StockItem>()
  for (const r of (invRows ?? []) as InvRow[]) {
    const p: StockItem = branchItems.get(r.product_id) ?? { id: r.product_id, name: r.product_name, image: r.image_url, stock: r.product_stock, sizes: [],
      subtitle: r.product_status !== "approved" ? <span className="capitalize">{r.product_status}</span> : undefined }
    if (r.variant_id) p.sizes.push({ id: r.variant_id, name: r.variant_name ?? "", stock: r.variant_stock ?? 0 })
    branchItems.set(r.product_id, p)
  }

  // Collaboration products of every organization, with their sizes and prices
  const [collabRes, rate] = tab === "collab" ? await Promise.all([supabase.rpc("collab_inventory"), getGlobalRoyaltyPercentage()]) : [{ data: null, error: null }, 0]
  type Collab = StockItem & { store: string; price: number; logo: boolean; prices: Record<string, number> }
  const orgs = new Map<string, Map<string, Collab>>()
  for (const r of (collabRes.data ?? []) as CollabRow[]) {
    const org = orgs.get(r.store_id) ?? new Map<string, Collab>()
    const p: Collab = org.get(r.product_id) ?? { id: r.product_id, name: r.product_name, image: r.image_url, stock: r.product_stock, sizes: [],
      store: r.store_name, price: Number(r.price), logo: r.logo, prices: {},
      subtitle: <>{r.logo && <span>Official logo</span>}{r.product_status !== "approved" && <span className="capitalize">· {r.product_status}</span>}</> }
    if (r.variant_id) { p.sizes.push({ id: r.variant_id, name: r.variant_name ?? "", stock: r.variant_stock ?? 0 }); p.prices[r.variant_id] = Number(r.variant_price ?? r.price) }
    org.set(r.product_id, p)
    orgs.set(r.store_id, org)
  }

  const base = "/supply-office/branch-inventory"
  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Branch & Collab Inventory"
        description="You supply the branches and organizations' collaboration products: answer branch requests, and keep their stock right." />

      {setupMissing ? (
        <div className="mt-5"><Callout tone="warn">Branch inventory needs the latest <code>scripts/31_supply_office_branches.sql</code>. Ask the admin to run it in Supabase.</Callout></div>
      ) : (
        <div className="mt-5 space-y-4">
          <TabLinks tabs={[
            { href: `${base}?tab=requests`, label: "Branch requests", count: pending, active: tab === "requests" },
            { href: selected ? `${base}?tab=stock&branch=${selected.store_id}` : `${base}?tab=stock`, label: "Branch stock", active: tab === "stock" },
            { href: `${base}?tab=collab`, label: "Collaboration stock", active: tab === "collab" },
          ]} />

          {tab === "requests" && <BranchRequestsList requests={requests} mode="main" branchNames={branchNames} />}

          {tab === "stock" && (branches.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No Supply Office branches yet.</p>
          ) : (
            <section className="space-y-3">
              <nav aria-label="Branches" className="scrollbar-none flex gap-1.5 overflow-x-auto pb-1">
                {branches.map((b) => (
                  <Link key={b.store_id} href={`${base}?tab=stock&branch=${b.store_id}`} aria-current={b.store_id === selected?.store_id ? "page" : undefined}
                    className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
                      b.store_id === selected?.store_id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
                    {b.name.replace(/^Supply Office — /, "")}
                    {pendingBy(b.store_id) > 0 && <span className="min-w-4 rounded-full bg-gold px-1 text-center text-[10px] font-bold leading-4 text-primary">{pendingBy(b.store_id)}</span>}
                  </Link>
                ))}
              </nav>
              <StockList items={[...branchItems.values()]} empty="This branch has no products yet."
                action={(p, s) => (
                  <StockControl module="supply_office" productId={p.id} variantId={s?.id} current={s ? s.stock : p.stock} branchStoreId={selected!.store_id}
                    product={{ name: p.name, image: p.image, size: s?.name ?? null }} />
                )} />
            </section>
          ))}

          {tab === "collab" && (collabRes.error ? (
            <Callout tone="warn">Collaboration stock needs the latest <code>scripts/31_supply_office_branches.sql</code>. Ask the admin to run it in Supabase.</Callout>
          ) : (
            <section className="space-y-4">
              <Callout icon={Info}>
                New stock goes out as a <strong>stock order</strong>: the organization pays cost + royalty, and the stock is added when you complete it in{" "}
                <Link href="/supply-office/special-orders" className="font-medium text-primary hover:underline">Special Orders</Link>. <strong>Correct</strong> is only for damaged units or a recount.
              </Callout>
              {orgs.size === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No organization has a collaboration product yet.</p>}
              {[...orgs].map(([storeId, org]) => {
                const list = [...org.values()]
                return (
                  <div key={storeId} className="space-y-2">
                    <h2 className="flex items-center gap-2 font-serif text-base font-semibold"><Handshake className="size-4 text-gold" />{list[0]?.store}</h2>
                    <StockList items={list}
                      productAction={(p) => {
                        const c = org.get(p.id)!
                        const sizes = c.sizes.length ? c.sizes.map((s) => ({ id: s.id, name: s.name, price: c.prices[s.id] ?? c.price, stock: s.stock })) : [{ id: null, name: "One size", price: c.price, stock: c.stock }]
                        return <CollabStockOrder productId={p.id} productName={p.name} image={p.image} storeName={c.store} logo={c.logo} rate={rate} sizes={sizes} />
                      }}
                      action={(p, s) => (
                        <StockControl module="supply_office" productId={p.id} variantId={s?.id} current={s ? s.stock : p.stock} collab
                          product={{ name: p.name, image: p.image, size: s?.name ?? null }} />
                      )} />
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      )}
    </ManagementShell>
  )
}
