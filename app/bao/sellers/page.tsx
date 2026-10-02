import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { ChevronRight, Search, Store } from "lucide-react"
import { groupBy, loadSales, peso } from "@/lib/analytics"
import { MODULES, type ModuleKey } from "@/lib/modules"
import { cn } from "@/lib/utils"

type StoreRow = {
  id: string; name: string; module: ModuleKey; store_id: string
  seller_profiles: { org_name: string; category: string | null; status: string; logo_url?: string | null } | null
}

/** BAO monitors every store: organizations plus the Cashier and Supply Office stores. */
export default async function SellerMonitoringPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireDashboard("bao", "sellers")
  const { q = "" } = await searchParams
  const supabase = await createClient()

  const [{ data }, lines, products] = await Promise.all([
    supabase.from("dashboards").select("id, name, module, store_id, seller_profiles(org_name, category, status)").not("store_id", "is", null).order("name"),
    loadSales(supabase),
    supabase.from("products").select("seller_id, status"),
  ])
  let stores = (data ?? []) as unknown as StoreRow[]
  const term = q.trim().toLowerCase()
  if (term) stores = stores.filter((s) => (s.seller_profiles?.org_name ?? s.name).toLowerCase().includes(term))

  const sales = new Map(groupBy(lines, (l) => l.storeId).map((g) => [g.key, g]))
  const productCounts = new Map<string, { live: number; pulled: number; pending: number }>()
  for (const p of (products.data ?? []) as { seller_id: string; status: string }[]) {
    const c = productCounts.get(p.seller_id) ?? { live: 0, pulled: 0, pending: 0 }
    if (p.status === "approved") c.live++
    else if (p.status === "pulled") c.pulled++
    else if (p.status === "pending") c.pending++
    productCounts.set(p.seller_id, c)
  }

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Seller Monitoring" description="Every store on the marketplace — their information, products, sales and royalty. Open a store to review or pull out products." />

      <form className="relative mt-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input name="q" defaultValue={q} placeholder="Search stores" className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm" />
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-180 text-sm">
          <thead><tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Store</th><th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 text-right font-medium">Live / pending / pulled</th>
            <th className="px-4 py-2.5 text-right font-medium">Sales</th><th className="px-4 py-2.5 text-right font-medium">Royalty earned</th>
            <th className="px-4 py-2.5" /></tr></thead>
          <tbody>
            {stores.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No stores found.</td></tr>}
            {stores.map((s) => {
              const g = sales.get(s.store_id)
              const c = productCounts.get(s.store_id) ?? { live: 0, pulled: 0, pending: 0 }
              const status = s.seller_profiles?.status ?? "active"
              return (
                <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link href={`/bao/sellers/${s.store_id}`} className="flex items-center gap-2 font-medium hover:text-primary hover:underline">
                      <Store className="size-4 text-primary" />{s.seller_profiles?.org_name ?? s.name}
                    </Link>
                    <span className={cn("ml-6 text-[10px] font-semibold capitalize", status === "active" ? "text-emerald-600" : "text-destructive")}>{status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.module === "seller" ? s.seller_profiles?.category ?? "Organization" : MODULES[s.module].name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.live} / {c.pending} / <span className={c.pulled ? "font-semibold text-destructive" : ""}>{c.pulled}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{peso(g?.gross ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{peso(g?.royaltyEarned ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right"><Link href={`/bao/sellers/${s.store_id}`} className="inline-flex items-center text-xs font-medium text-primary hover:underline">Monitor <ChevronRight className="size-3" /></Link></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ManagementShell>
  )
}
