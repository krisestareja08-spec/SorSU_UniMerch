import Link from "next/link"
import Image from "next/image"
import { Search, Store } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ProductCard, type Product } from "@/components/marketplace/product-card"
import { storefrontHref } from "@/lib/storefront-theme"

/** Marketplace search: products (name, description, category) and stores (organization name). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams
  const term = q.trim().replace(/[,()%*]/g, " ").replace(/\s+/g, " ").slice(0, 80)
  const supabase = await createClient()

  let products: Product[] = []
  let stores: { id: string; org_name: string; category: string | null; logo_url?: string | null }[] = []

  if (term) {
    const like = `%${term}%`
    const [{ data: productRows }, storeRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, price, image_url, badge, stock, seller_id")
        .eq("status", "approved")
        .or(`name.ilike.${like},description.ilike.${like},category.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase.from("seller_profiles").select("id, org_name, category, logo_url, status").ilike("org_name", like).eq("status", "active").limit(12),
    ])
    let storeRows = storeRes.data as typeof stores | null
    if (storeRes.error) {
      storeRows = (await supabase.from("seller_profiles").select("id, org_name, category, status").ilike("org_name", like).eq("status", "active").limit(12)).data
    }
    stores = storeRows ?? []

    const sellerIds = [...new Set((productRows ?? []).map((p) => p.seller_id as string))]
    const { data: sellers } = sellerIds.length
      ? await supabase.from("seller_profiles").select("id, org_name").in("id", sellerIds)
      : { data: [] as { id: string; org_name: string }[] }
    const names = new Map((sellers ?? []).map((s) => [s.id, s.org_name]))
    products = (productRows ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      seller: names.get(p.seller_id) ?? "Campus Seller",
      sellerId: p.seller_id,
      image: p.image_url ?? "/placeholder.jpg",
      badge: p.badge as Product["badge"],
      stock: p.stock,
    }))
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <form action="/marketplace/search" role="search" className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input name="q" type="search" defaultValue={q} autoFocus={!q} placeholder="Search campus goods, orgs, merch…" aria-label="Search"
          className="h-10 w-full rounded-full border border-input bg-background pl-9 pr-4 text-sm" />
      </form>

      {!term ? (
        <p className="mt-8 text-sm text-muted-foreground">Type what you&apos;re looking for — a product, category or organization.</p>
      ) : (
        <>
          <h1 className="mt-6 font-serif text-xl font-semibold">Results for “{term}”</h1>
          <p className="text-sm text-muted-foreground">{products.length} product{products.length === 1 ? "" : "s"} · {stores.length} store{stores.length === 1 ? "" : "s"}</p>

          {stores.length > 0 && (
            <section className="mt-6">
              <h2 className="font-serif text-base font-semibold">Stores</h2>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {stores.map((s) => (
                  <Link key={s.id} href={storefrontHref(s.id)} className="flex w-56 shrink-0 items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/30 hover:shadow-md">
                    <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
                      {s.logo_url ? <Image src={s.logo_url} alt="" fill className="object-cover" sizes="40px" /> : <Store className="size-5 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.org_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.category ?? "Store"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <h2 className="font-serif text-base font-semibold">Products</h2>
            {products.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No products match “{term}”.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
