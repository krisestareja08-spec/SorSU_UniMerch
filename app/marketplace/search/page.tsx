import Link from "next/link"
import Image from "next/image"
import { Search, SlidersHorizontal, Store, X } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ProductCard } from "@/components/marketplace/product-card"
import { RatingSummary } from "@/components/reviews/stars"
import { storefrontHref } from "@/lib/storefront-theme"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"
import { SORTS, cleanTerm, findProducts, type SortKey } from "@/lib/products"

type Params = { q?: string; category?: string; min?: string; max?: string; campus?: string; rating?: string; sort?: string; stock?: string }

const num = (v?: string) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : undefined)
const selectCls = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"

/** Marketplace search + browse: keyword, category, price range, campus ("near me"), rating and sorting. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const term = cleanTerm(params.q ?? "")
  const sort: SortKey = params.sort && params.sort in SORTS ? (params.sort as SortKey) : "newest"
  const supabase = await createClient()

  // "Near me" defaults to the signed-in user's campus
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = user ? await supabase.from("profiles").select("campus").eq("id", user.id).maybeSingle() : { data: null }
  const myCampus = (me?.campus as string | null) ?? null
  const campus = params.campus === "near" ? myCampus ?? undefined : params.campus && params.campus in CAMPUS_LABELS ? params.campus : undefined

  const filters = {
    q: term || undefined,
    category: params.category || undefined,
    minPrice: num(params.min),
    maxPrice: num(params.max),
    campus,
    minRating: num(params.rating),
    inStock: params.stock === "1",
    sort,
  }

  const [products, { data: catRows }, storeRes] = await Promise.all([
    findProducts(supabase, filters),
    supabase.from("products").select("category").eq("status", "approved").limit(1000),
    term
      ? supabase.from("seller_profiles").select("id, org_name, category, logo_url, rating, rating_count").ilike("org_name", `%${term}%`).eq("status", "active").limit(12)
      : Promise.resolve({ data: [] as { id: string; org_name: string; category: string | null; logo_url: string | null; rating: number | null; rating_count: number | null }[] }),
  ])
  const categories = [...new Set((catRows ?? []).map((c) => c.category as string).filter(Boolean))].sort()
  const stores = (storeRes.data ?? []) as { id: string; org_name: string; category: string | null; logo_url: string | null; rating: number | null; rating_count: number | null }[]

  const activeFilters = [
    filters.category && { key: "category", label: filters.category },
    filters.minPrice != null && { key: "min", label: `From ₱${filters.minPrice}` },
    filters.maxPrice != null && { key: "max", label: `Up to ₱${filters.maxPrice}` },
    params.campus && { key: "campus", label: params.campus === "near" ? "Near me" : CAMPUS_LABELS[params.campus as Campus] ?? params.campus },
    filters.minRating && { key: "rating", label: `${filters.minRating}★ & up` },
    filters.inStock && { key: "stock", label: "In stock" },
  ].filter(Boolean) as { key: keyof Params; label: string }[]

  const without = (key: keyof Params) => {
    const sp = new URLSearchParams(Object.entries(params).filter(([k, v]) => k !== key && v) as [string, string][])
    return `/marketplace/search${sp.size ? `?${sp}` : ""}`
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="font-serif text-xl font-semibold sm:text-2xl">{term ? <>Results for “{term}”</> : "Browse products"}</h1>
      <div className="mb-4 mt-1.5 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Filters (GET form, so results are shareable and work without JavaScript) */}
        <form action="/marketplace/search" role="search" aria-label="Search and filter products"
          className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm lg:sticky lg:top-24 lg:w-64 lg:shrink-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Search products…" aria-label="Keyword"
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <details className="group lg:open:block" open>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold lg:pointer-events-none">
              <SlidersHorizontal className="size-4 text-primary" />Filters
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-1">
              <label className="col-span-2 space-y-1 text-xs font-medium text-muted-foreground lg:col-span-1">
                Sort by
                <select name="sort" defaultValue={sort} className={selectCls}>
                  {Object.entries(SORTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </label>
              <label className="col-span-2 space-y-1 text-xs font-medium text-muted-foreground lg:col-span-1">
                Category
                <select name="category" defaultValue={params.category ?? ""} className={selectCls}>
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <fieldset className="col-span-2 lg:col-span-1">
                <legend className="mb-1 text-xs font-medium text-muted-foreground">Price (₱)</legend>
                <div className="flex items-center gap-2">
                  <input name="min" type="number" min={0} inputMode="numeric" defaultValue={params.min ?? ""} placeholder="Min" aria-label="Minimum price" className={selectCls} />
                  <span className="text-muted-foreground" aria-hidden>–</span>
                  <input name="max" type="number" min={0} inputMode="numeric" defaultValue={params.max ?? ""} placeholder="Max" aria-label="Maximum price" className={selectCls} />
                </div>
              </fieldset>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Location
                <select name="campus" defaultValue={params.campus ?? ""} className={selectCls}>
                  <option value="">All campuses</option>
                  {myCampus && <option value="near">Near me ({CAMPUS_LABELS[myCampus as Campus] ?? myCampus})</option>}
                  {Object.entries(CAMPUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Rating
                <select name="rating" defaultValue={params.rating ?? ""} className={selectCls}>
                  <option value="">Any rating</option>
                  {[4, 3, 2].map((r) => <option key={r} value={r}>{r}★ &amp; up</option>)}
                </select>
              </label>
              <label className="col-span-2 flex items-center gap-2 text-sm lg:col-span-1">
                <input type="checkbox" name="stock" value="1" defaultChecked={params.stock === "1"} className="size-4 accent-primary" />In stock only
              </label>
            </div>
          </details>

          <div className="flex gap-2">
            <button type="submit" className="h-9 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">Apply</button>
            <Link href="/marketplace/search" className="flex h-9 items-center rounded-lg border border-border px-3 text-sm text-muted-foreground hover:text-foreground">Reset</Link>
          </div>
        </form>

        <div className="min-w-0 flex-1">
          {activeFilters.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2" aria-label="Active filters">
              {activeFilters.map((f) => (
                <li key={f.key}>
                  <Link href={without(f.key)} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10">
                    {f.label}<X className="size-3" aria-label="Remove filter" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {stores.length > 0 && (
            <section className="mb-6" aria-labelledby="stores-title">
              <h2 id="stores-title" className="font-serif text-base font-semibold">Stores</h2>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {stores.map((s) => (
                  <Link key={s.id} href={storefrontHref(s.id)} className="flex w-56 shrink-0 items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/30 hover:shadow-md">
                    <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
                      {s.logo_url ? <Image src={s.logo_url} alt="" fill className="object-cover" sizes="40px" /> : <Store className="size-5 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.org_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.category ?? "Store"}</p>
                      <RatingSummary avg={Number(s.rating ?? 0)} count={s.rating_count ?? 0} />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="products-title">
            <h2 id="products-title" className="font-serif text-base font-semibold">
              Products <span className="text-sm font-normal text-muted-foreground">({products.length}{products.length === 60 ? "+" : ""})</span>
            </h2>
            {products.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No products match these filters. Try removing some.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
