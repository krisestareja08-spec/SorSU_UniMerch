import Link from "next/link"
import Image from "next/image"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading, StatGrid, type Stat } from "@/components/management/dashboard-ui"
import { ProductControl } from "@/components/bao/product-control"
import { CheckSquare, Clock, Search, ShieldAlert, Store } from "lucide-react"
import { peso, storeNames } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"

const FILTERS = [
  { key: "approved", label: "Live" },
  { key: "pulled", label: "Pulled out" },
  { key: "pending", label: "Pending" },
  { key: "all", label: "All" },
] as const

type Row = {
  id: string; name: string; category: string; price: number; stock: number; status: string; badge: string
  seller_id: string; image_url: string | null; is_restricted: boolean | null; is_royalty_product: boolean | null; pulled_reason?: string | null
}

/** Product Monitor — BAO watches every listing and pulls out products with violations. */
export default async function ProductMonitorPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; campus?: string; store?: string }> }) {
  const ctx = await requireDashboard("bao", "marketplace")
  const { status = "approved", q = "", campus = "", store = "" } = await searchParams
  const supabase = await createClient()

  // Stores (organizations + office stores) with their campus, for the campus / organization filters
  const { data: storeRows } = await supabase.from("seller_profiles").select("id, org_name, campus").order("org_name")
  const stores = (storeRows ?? []) as { id: string; org_name: string; campus: string | null }[]
  const campusOf = new Map(stores.map((s) => [s.id, s.campus]))
  const storesInCampus = campus ? stores.filter((s) => (campus === "none" ? !s.campus : s.campus === campus)) : stores
  const selectedStore = store && storesInCampus.some((s) => s.id === store) ? store : ""
  // null = no store restriction; [] = filter matches no store
  const scope: string[] | null = selectedStore ? [selectedStore] : campus ? storesInCampus.map((s) => s.id) : null
  const NONE = "00000000-0000-0000-0000-000000000000"
  const scopeIds = scope ? (scope.length ? scope : [NONE]) : null

  const params = (over: Record<string, string>) => {
    const qs = new URLSearchParams({ status, ...(q ? { q } : {}), ...(campus ? { campus } : {}), ...(selectedStore ? { store: selectedStore } : {}), ...over })
    for (const [k, v] of [...qs.entries()]) if (!v) qs.delete(k)
    return `/bao/marketplace?${qs.toString()}`
  }

  const cols = "id, name, category, price, stock, status, badge, seller_id, image_url, is_restricted, is_royalty_product"
  const build = (withPulled: boolean) => {
    let query = supabase.from("products").select(withPulled ? `${cols}, pulled_reason` : cols).order("created_at", { ascending: false }).limit(200)
    if (scopeIds) query = query.in("seller_id", scopeIds)
    if (status !== "all") query = query.eq("status", status)
    const term = q.trim().replace(/[,()%]/g, "")
    if (term) query = query.ilike("name", `%${term}%`)
    return query
  }
  let { data, error } = await build(true)
  if (error) ({ data, error } = await build(false))
  const rows = (data ?? []) as unknown as Row[]
  const names = await storeNames(supabase, rows.map((r) => r.seller_id))

  const count = async (s: string) => {
    let query = supabase.from("products").select("id", { count: "exact", head: true }).eq("status", s)
    if (scopeIds) query = query.in("seller_id", scopeIds)
    return (await query).count ?? 0
  }
  const [live, pulled, pending] = await Promise.all([count("approved"), count("pulled"), count("pending")])
  const stats: Stat[] = [
    { label: "Live listings", value: live, icon: CheckSquare, hint: "Visible to buyers", accent: "green" },
    { label: "Pulled out", value: pulled, icon: ShieldAlert, hint: "Hidden for violations", accent: "red" },
    { label: "Pending approval", value: pending, icon: Clock, hint: "See Product Approvals", accent: "gold" },
    { label: "Stores listed", value: names.size, icon: Store, hint: campus ? CAMPUS_LABELS[campus as Campus] ?? "No campus set" : "In this view", accent: "primary" },
  ]

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Product Monitor" description="Every listing across all stores. Pull out products that violate marketplace rules — they disappear from the marketplace until restored." />
      <div className="mt-6"><StatGrid stats={stats} /></div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {FILTERS.map((f) => (
            <Link key={f.key} href={params({ status: f.key })}
              className={cn("rounded-lg px-3 py-1 text-sm font-medium", status === f.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Filters: search + campus + organization (organizations are grouped by campus) */}
      <form className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filter products">
        <input type="hidden" name="status" value={status} />
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="Search products" aria-label="Search products" className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm" />
        </div>
        <select name="campus" defaultValue={campus} aria-label="Campus" className="h-9 rounded-xl border border-input bg-background px-3 text-sm">
          <option value="">All campuses</option>
          {Object.entries(CAMPUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          <option value="none">No campus set</option>
        </select>
        <select name="store" defaultValue={selectedStore} aria-label="Organization" className="h-9 max-w-64 rounded-xl border border-input bg-background px-3 text-sm">
          <option value="">{campus ? "All organizations in this campus" : "All organizations"}</option>
          {campus ? (
            storesInCampus.map((s) => <option key={s.id} value={s.id}>{s.org_name}</option>)
          ) : (
            [...Object.entries(CAMPUS_LABELS), ["", "No campus set"] as const].map(([value, label]) => {
              const group = stores.filter((s) => (value ? s.campus === value : !s.campus))
              return group.length ? (
                <optgroup key={value || "none"} label={label}>
                  {group.map((s) => <option key={s.id} value={s.id}>{s.org_name}</option>)}
                </optgroup>
              ) : null
            })
          )}
        </select>
        <button type="submit" className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Apply</button>
        {(campus || selectedStore || q) && (
          <Link href={`/bao/marketplace?status=${status}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">Clear</Link>
        )}
      </form>

      {error && <p className="mt-4 text-sm text-destructive">Could not load products: {error.message}</p>}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-200 text-sm">
          <thead><tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Product</th><th className="px-4 py-2.5 font-medium">Store</th>
            <th className="px-4 py-2.5 text-right font-medium">Price</th><th className="px-4 py-2.5 text-right font-medium">Stock</th>
            <th className="px-4 py-2.5 font-medium">Flags</th><th className="px-4 py-2.5 font-medium">BAO control</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No products in this view.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border/60 align-top last:border-0">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-muted">{p.image_url && <Image src={p.image_url} alt="" fill className="object-cover" sizes="36px" />}</div>
                    <div className="min-w-0">
                      <Link href={`/bao/browse/${p.id}`} className="font-medium hover:text-primary hover:underline">{p.name}</Link>
                      <p className="text-xs text-muted-foreground">{p.category} · {p.badge}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/bao/sellers/${p.seller_id}`} className="hover:text-primary hover:underline">{names.get(p.seller_id) ?? "Unknown store"}</Link>
                  <p className="text-xs text-muted-foreground">{CAMPUS_LABELS[campusOf.get(p.seller_id) as Campus] ?? "No campus set"}</p>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(Number(p.price))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.stock}</td>
                <td className="px-4 py-2.5 text-xs">
                  {p.is_royalty_product && <span className="mr-1 rounded bg-gold/20 px-1.5 py-0.5">Logo</span>}
                  {p.is_restricted && <span className="rounded bg-muted px-1.5 py-0.5">Restricted</span>}
                </td>
                <td className="px-4 py-2.5"><ProductControl id={p.id} status={p.status} pulledReason={p.pulled_reason} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ManagementShell>
  )
}
