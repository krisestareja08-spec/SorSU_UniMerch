import { createClient } from "@/lib/supabase/server"
import type { Product } from "@/components/marketplace/product-card"
import { withPriceRange } from "@/lib/variants"

type Supabase = Awaited<ReturnType<typeof createClient>>

export const SORTS = {
  newest: "Newest",
  popular: "Best selling",
  rating: "Top rated",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
} as const
export type SortKey = keyof typeof SORTS

export type ProductFilters = {
  q?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  /** Only stores on this campus ("near me") */
  campus?: string
  minRating?: number
  inStock?: boolean
  sort?: SortKey
  limit?: number
}

type Row = { id: string; name: string; price: number; image_url: string | null; badge: string; stock: number; seller_id: string; rating_avg?: number; rating_count?: number; sold_count?: number; price_max?: number | null }

/** Strips characters that would break a PostgREST `or()` filter. */
export function cleanTerm(q: string) {
  return q.trim().replace(/[,()%*]/g, " ").replace(/\s+/g, " ").slice(0, 80)
}

/**
 * Approved products matching the filters, with store names. Rating / popularity columns come
 * from scripts/26 and price_max from scripts/28; without them the query retries without rating
 * filters or sorts (and looks the price range up separately).
 */
export async function findProducts(supabase: Supabase, f: ProductFilters): Promise<Product[]> {
  let sellerScope: string[] | null = null
  if (f.campus) {
    const { data } = await supabase.from("seller_profiles").select("id").eq("campus", f.campus)
    sellerScope = (data ?? []).map((s) => s.id)
    if (sellerScope.length === 0) return []
  }

  const run = (extended: boolean) => {
    let q = supabase
      .from("products")
      .select(`id, name, price, image_url, badge, stock, seller_id${extended ? ", rating_avg, rating_count, sold_count, price_max" : ""}`)
      .eq("status", "approved")
    const term = f.q ? cleanTerm(f.q) : ""
    if (term) q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`)
    if (f.category) q = q.eq("category", f.category)
    if (f.minPrice != null) q = q.gte("price", f.minPrice)
    if (f.maxPrice != null) q = q.lte("price", f.maxPrice)
    if (f.inStock) q = q.gt("stock", 0)
    if (sellerScope) q = q.in("seller_id", sellerScope)
    if (extended && f.minRating) q = q.gte("rating_avg", f.minRating)
    const sort = f.sort ?? "newest"
    if (sort === "price_asc") q = q.order("price", { ascending: true })
    else if (sort === "price_desc") q = q.order("price", { ascending: false })
    else if (extended && sort === "rating") q = q.order("rating_avg", { ascending: false }).order("rating_count", { ascending: false })
    else if (extended && sort === "popular") q = q.order("sold_count", { ascending: false })
    return q.order("created_at", { ascending: false }).limit(f.limit ?? 60)
  }

  let { data, error } = await run(true)
  const extended = !error
  if (error) ({ data } = await run(false))
  const rows = (data ?? []) as unknown as Row[]

  const sellerIds = [...new Set(rows.map((p) => p.seller_id))]
  const { data: sellers } = sellerIds.length
    ? await supabase.from("seller_profiles").select("id, org_name, campus").in("id", sellerIds)
    : { data: [] as { id: string; org_name: string; campus: string | null }[] }
  const names = new Map((sellers ?? []).map((s) => [s.id, s.org_name]))
  const campuses = new Map((sellers ?? []).map((s) => [s.id, (s.campus as string | null) ?? null]))

  const products = rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    seller: names.get(p.seller_id) ?? "Campus Seller",
    sellerId: p.seller_id,
    campus: campuses.get(p.seller_id) ?? null,
    image: p.image_url ?? "/placeholder.jpg",
    badge: p.badge as Product["badge"],
    stock: p.stock,
    rating: Number(p.rating_avg ?? 0),
    ratingCount: p.rating_count ?? 0,
    sold: p.sold_count ?? 0,
    priceMax: p.price_max != null ? Number(p.price_max) : null,
  }))
  return extended ? products : withPriceRange(supabase, products)
}
