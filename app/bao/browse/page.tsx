import Link from "next/link"
import Image from "next/image"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Eye, Package, Search } from "lucide-react"
import { peso, storeNames } from "@/lib/analytics"
import { cn } from "@/lib/utils"

type Row = { id: string; name: string; category: string; price: number; stock: number; badge: string; image_url: string | null; seller_id: string; is_royalty_product: boolean | null; is_restricted: boolean | null }

/**
 * The marketplace as BAO sees it — inside the BAO dashboard, view-only.
 * No cart, no ordering: BAO opens a product to review it, pull it out, or flag the seller.
 */
export default async function BaoBrowsePage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const ctx = await requireDashboard("bao", "marketplace")
  const { q = "", category = "" } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("products")
    .select("id, name, category, price, stock, badge, image_url, seller_id, is_royalty_product, is_restricted")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(120)
  const term = q.trim().replace(/[,()%]/g, "")
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  if (category) query = query.eq("category", category)
  const { data } = await query
  const products = (data ?? []) as Row[]
  const names = await storeNames(supabase, products.map((p) => p.seller_id))

  const { data: catRows } = await supabase.from("products").select("category").eq("status", "approved")
  const categories = [...new Set((catRows ?? []).map((c) => c.category as string))].sort()

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Marketplace (view only)" description="Live listings as buyers see them. Open a product to review its details, pull it out, or flag the seller for a violation." />

      <form className="mt-5 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="Search products" aria-label="Search products" className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm" />
        </div>
        <select name="category" defaultValue={category} aria-label="Category" className="h-9 rounded-xl border border-input bg-background px-3 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Filter</button>
      </form>

      <p className="mt-3 text-xs text-muted-foreground">{products.length} live product{products.length === 1 ? "" : "s"}</p>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.length === 0 && <p className="col-span-full rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No products match.</p>}
        {products.map((p) => (
          <Link key={p.id} href={`/bao/browse/${p.id}`} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-primary/30 hover:shadow-md">
            <div className="relative aspect-square bg-muted">
              {p.image_url ? <Image src={p.image_url} alt={p.name} fill className="object-cover" sizes="(max-width: 640px) 50vw, 20vw" /> : <Package className="m-auto mt-12 size-10 text-muted-foreground/30" />}
              <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                {p.is_royalty_product && <span className="rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-semibold text-primary">Logo</span>}
                {p.is_restricted && <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">Restricted</span>}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-0.5 p-3">
              <p className="line-clamp-2 text-xs font-medium leading-tight">{p.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{names.get(p.seller_id) ?? "Campus Seller"}</p>
              <p className="mt-auto pt-1 text-sm font-bold text-gold">{peso(Number(p.price))}</p>
              <p className={cn("flex items-center gap-1 text-[11px] font-medium text-primary opacity-80 group-hover:opacity-100")}><Eye className="size-3" />Review</p>
            </div>
          </Link>
        ))}
      </div>
    </ManagementShell>
  )
}
