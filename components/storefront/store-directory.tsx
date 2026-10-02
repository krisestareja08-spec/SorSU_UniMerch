import Link from "next/link"
import Image from "next/image"
import { Package, Star, Store } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { storefrontHref } from "@/lib/storefront-theme"

type StoreRow = {
  id: string
  org_name: string
  category: string | null
  logo_url?: string | null
  rating?: number | null
  rating_count?: number | null
}

/** "Browse stores" — every active store as a card; clicking opens that seller's storefront. */
export async function StoreDirectory({ title = "Browse Stores" }: { title?: string }) {
  const supabase = await createClient()

  const full = await supabase
    .from("seller_profiles")
    .select("id, org_name, category, logo_url, rating, rating_count")
    .eq("status", "active")
    .order("org_name")
    .limit(120)
  const stores = ((full.error
    ? (await supabase.from("seller_profiles").select("id, org_name, category").eq("status", "active").order("org_name").limit(120)).data
    : full.data) ?? []) as StoreRow[]

  // Live product count per store
  const counts = new Map<string, number>()
  if (stores.length) {
    const { data } = await supabase.from("products").select("seller_id").eq("status", "approved").in("seller_id", stores.map((s) => s.id))
    for (const p of data ?? []) counts.set(p.seller_id as string, (counts.get(p.seller_id as string) ?? 0) + 1)
  }

  return (
    <section id="stores" className="scroll-mt-24">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-base font-semibold text-foreground sm:text-lg">{title}</h2>
        <span className="text-xs text-muted-foreground">{stores.length} store{stores.length === 1 ? "" : "s"}</span>
      </div>
      <div className="mb-4 mt-1.5 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />

      {stores.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No stores yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {stores.map((s) => {
            const products = counts.get(s.id) ?? 0
            const rating = Number(s.rating ?? 0)
            return (
              <Link
                key={s.id}
                href={storefrontHref(s.id)}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 ring-2 ring-gold/30 transition group-hover:ring-gold/60">
                  {s.logo_url
                    ? <Image src={s.logo_url} alt={`${s.org_name} logo`} fill className="object-cover" sizes="64px" />
                    : <Store className="size-7 text-primary" />}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground group-hover:text-primary">{s.org_name}</p>
                  {s.category && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{s.category}</p>}
                </div>
                <div className="mt-auto flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Package className="size-3" />{products}</span>
                  <span className="flex items-center gap-1">
                    <Star className="size-3 fill-gold text-gold" />{rating > 0 ? rating.toFixed(1) : "New"}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
