import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ColumnChart } from "@/components/analytics/charts"
import { ProductControl } from "@/components/bao/product-control"
import { ArrowLeft, Coins, ExternalLink, Flag, Package, ShoppingCart, Store } from "lucide-react"
import { FlagViolationForm } from "@/components/bao/flag-violation-form"
import { byMonth, loadSales, peso, totals } from "@/lib/analytics"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"
import { profilesById, formatDateTime } from "@/lib/admin"

type ProductRow = {
  id: string; name: string; category: string; price: number; stock: number; status: string; image_url: string | null
  is_restricted: boolean | null; is_royalty_product: boolean | null; royalty_amount: number | null; pulled_reason?: string | null
}

/** One store, as seen by BAO: information, members, products (with pull-out), sales and reports. */
export default async function SellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireDashboard("bao", "sellers")
  const supabase = await createClient()

  const { data: store } = await supabase.from("seller_profiles").select("*").eq("id", id).maybeSingle()
  if (!store) notFound()

  const [{ data: dash }, productsRes, lines, { data: reports }] = await Promise.all([
    supabase.from("dashboards").select("id, module, dashboard_members(user_id, is_main)").eq("store_id", id).maybeSingle(),
    supabase.from("products").select("id, name, category, price, stock, status, image_url, is_restricted, is_royalty_product, royalty_amount, pulled_reason").eq("seller_id", id).order("created_at", { ascending: false }),
    loadSales(supabase, { storeId: id }),
    supabase.from("sales_reports").select("id, period_start, period_end, gross_sales, royalty_due, status, created_at").eq("store_id", id).order("created_at", { ascending: false }).limit(10),
  ])
  let products = (productsRes.data ?? []) as ProductRow[]
  if (productsRes.error) {
    // before scripts/15 (no pulled_reason column)
    const { data } = await supabase.from("products").select("id, name, category, price, stock, status, image_url, is_restricted, is_royalty_product, royalty_amount").eq("seller_id", id)
    products = (data ?? []) as ProductRow[]
  }
  const { data: violationRows } = await supabase.from("store_violations").select("reason, severity, product_name, created_at").eq("store_id", id).order("created_at", { ascending: false }).limit(20)
  const violations = (violationRows ?? []) as { reason: string; severity: string; product_name: string | null; created_at: string }[]
  const members = ((dash as { dashboard_members?: { user_id: string; is_main: boolean }[] } | null)?.dashboard_members ?? [])
  const people = await profilesById(supabase, members.map((m) => m.user_id))
  const t = totals(lines)
  const months = byMonth(lines, 6)
  const s = store as Record<string, string | null>

  const stats: Stat[] = [
    { label: "Sales", value: peso(t.gross), icon: ShoppingCart, hint: `${t.orders} orders · ${t.itemsSold} items`, accent: "primary" },
    { label: "Royalty to BAO", value: peso(t.royaltyEarned), icon: Coins, hint: `${peso(t.royaltyPending)} pending`, accent: "gold" },
    { label: "Store net", value: peso(t.net), icon: Store, hint: "After royalty", accent: "green" },
    { label: "Products", value: products.length, icon: Package, hint: `${products.filter((p) => p.status === "pulled").length} pulled out`, accent: "red" },
  ]

  return (
    <ManagementShell ctx={ctx}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href="/bao/sellers"><ArrowLeft className="size-4" />Seller Monitoring</Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-primary/10">
            {s.logo_url ? <Image src={s.logo_url} alt="" fill className="object-cover" sizes="56px" /> : <Store className="size-6 text-primary" />}
          </div>
          <PageHeading title={s.org_name ?? "Store"} description={`${s.category ?? "Store"} · ${CAMPUS_LABELS[s.campus as Campus] ?? "No campus"} · status: ${s.status ?? "active"}`} />
        </div>
        <Link href="/bao/browse" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
          <ExternalLink className="size-4" /> Marketplace view
        </Link>
      </div>

      <div className="mt-6"><StatGrid stats={stats} /></div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="font-serif text-base">Sales per month</CardTitle></CardHeader>
          <CardContent><ColumnChart ariaLabel="Store sales per month" format="peso" data={months.map((m) => ({ label: m.label, value: m.gross }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-serif text-base">Store information</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Description</dt><dd>{s.description || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Pickup location</dt><dd>{s.pickup_location || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">GCash</dt><dd>{s.gcash_number || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Joined</dt><dd>{s.created_at ? formatDateTime(s.created_at) : "—"}</dd></div>
              <div>
                <dt className="text-xs text-muted-foreground">Managed by</dt>
                <dd>{members.length === 0 ? "—" : members.map((m) => `${people.get(m.user_id)?.full_name ?? "Unnamed"}${m.is_main ? " (Main Admin)" : ""}`).join(", ")}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="font-serif text-base">Products</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-180 text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Product</th><th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 text-right font-medium">Price</th><th className="py-2 pr-3 text-right font-medium">Stock</th>
              <th className="py-2 pr-3 font-medium">Flags</th><th className="py-2 font-medium">BAO control</th></tr></thead>
            <tbody>
              {products.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No products.</td></tr>}
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border/60 align-top last:border-0">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-muted">{p.image_url && <Image src={p.image_url} alt="" fill className="object-cover" sizes="36px" />}</div>
                      <Link href={`/bao/browse/${p.id}`} className="font-medium hover:text-primary hover:underline">{p.name}</Link>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{p.category}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{peso(Number(p.price))}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{p.stock}</td>
                  <td className="py-2 pr-3 text-xs">
                    {p.is_royalty_product && <span className="mr-1 rounded bg-gold/20 px-1.5 py-0.5">Logo · {peso(Number(p.royalty_amount ?? 0))} royalty</span>}
                    {p.is_restricted && <span className="rounded bg-muted px-1.5 py-0.5">Restricted</span>}
                  </td>
                  <td className="py-2"><ProductControl id={p.id} status={p.status} pulledReason={p.pulled_reason} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-4 border-destructive/20">
        <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-base"><Flag className="size-4 text-destructive" />Violations</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Flag this store (the seller is notified)</p>
            <FlagViolationForm storeId={id} />
          </div>
          <div className="text-sm">
            {violations.length === 0 ? <p className="text-muted-foreground">No violations recorded.</p> : (
              <ul className="space-y-1.5">
                {violations.map((v, i) => (
                  <li key={i} className="rounded-lg bg-destructive/5 px-3 py-2">
                    <span className="text-xs font-semibold capitalize text-destructive">{v.severity}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(v.created_at)}</span>
                    <p>{v.product_name ? <strong>{v.product_name}: </strong> : null}{v.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="font-serif text-base">Sales reports from this store</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {(reports ?? []).length === 0 ? <p className="text-muted-foreground">No reports submitted yet.</p> : (
            <ul className="divide-y divide-border">
              {(reports ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{r.period_start} → {r.period_end} · {peso(Number(r.gross_sales))} sales · {peso(Number(r.royalty_due))} royalty</span>
                  <Link href={`/bao/reports?open=${r.id}`} className="text-xs font-medium capitalize text-primary hover:underline">{r.status}</Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </ManagementShell>
  )
}
