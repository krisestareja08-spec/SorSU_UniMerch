import { createClient } from "@/lib/supabase/server"
import type { Product } from "@/components/marketplace/product-card"
import { ACCENTS, DEFAULT_THEME, storefrontHref, type StorefrontTheme } from "@/lib/storefront-theme"

export { ACCENTS, DEFAULT_THEME, storefrontHref } from "@/lib/storefront-theme"
export type { StorefrontAccent, StorefrontLayout, StorefrontTheme } from "@/lib/storefront-theme"

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Seller Storefront module — ONE storefront structure for every seller.
 * A storefront is derived from the seller's store record (`seller_profiles`, id = sellerId),
 * which is created together with the seller (organization / office store), so every seller
 * automatically has a public page at /seller/{sellerId} with no manual setup.
 */

export const STOREFRONT_PAGE_SIZE = 24

export type Storefront = {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  bannerUrl: string | null
  rating: number
  ratingCount: number
  joinedAt: string
  campus: string | null
  orgCategory: string | null
  gcashNumber: string | null
  pickupLocation: string | null
  pickupNotes: string | null
  theme: StorefrontTheme
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isSellerId(value: string) {
  return UUID.test(value)
}

function parseTheme(raw: unknown): StorefrontTheme {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<StorefrontTheme>
  return {
    accent: t.accent && t.accent in ACCENTS ? t.accent : DEFAULT_THEME.accent,
    layout: t.layout === "list" ? "list" : "grid",
    showBanner: t.showBanner !== false,
    tagline: typeof t.tagline === "string" && t.tagline.trim() ? t.tagline.trim() : null,
  }
}

type StoreRow = {
  id: string
  org_name: string | null
  description: string | null
  campus: string | null
  category: string | null
  gcash_number: string | null
  rating: number | null
  rating_count: number | null
  created_at: string
  status: string | null
  logo_url?: string | null
  banner_url?: string | null
  theme?: unknown
  pickup_location?: string | null
  pickup_notes?: string | null
}

/** Loads a seller's public storefront, or null if the seller doesn't exist or is suspended. */
export async function getStorefront(supabase: Supabase, sellerId: string): Promise<Storefront | null> {
  if (!isSellerId(sellerId)) return null

  const base = "id, org_name, description, campus, category, gcash_number, rating, rating_count, created_at, status"
  // Branding columns come from scripts/11_storefront.sql — fall back gracefully if not run yet.
  let { data, error } = await supabase.from("seller_profiles").select(`${base}, logo_url, banner_url, theme`).eq("id", sellerId).maybeSingle()
  if (error) ({ data, error } = await supabase.from("seller_profiles").select(base).eq("id", sellerId).maybeSingle())
  const row = data as StoreRow | null
  if (!row || (row.status && row.status !== "active")) return null
  const { data: pickup } = await supabase.from("seller_profiles").select("pickup_location, pickup_notes").eq("id", sellerId).maybeSingle()

  return {
    id: row.id,
    name: row.org_name?.trim() || "Campus Seller",
    description: row.description,
    logoUrl: row.logo_url ?? null,
    bannerUrl: row.banner_url ?? null,
    rating: Number(row.rating ?? 0),
    ratingCount: row.rating_count ?? 0,
    joinedAt: row.created_at,
    campus: row.campus,
    orgCategory: row.category,
    gcashNumber: row.gcash_number,
    pickupLocation: (pickup as { pickup_location?: string | null } | null)?.pickup_location ?? null,
    pickupNotes: (pickup as { pickup_notes?: string | null } | null)?.pickup_notes ?? null,
    theme: parseTheme(row.theme),
  }
}

export type StorefrontProduct = Product & { category: string }

/** Only this seller's approved products; paginated + optional category filter so it scales. */
export async function getStorefrontProducts(
  supabase: Supabase,
  storefront: Pick<Storefront, "id" | "name">,
  { category, page = 1 }: { category?: string | null; page?: number },
) {
  const from = (page - 1) * STOREFRONT_PAGE_SIZE
  let query = supabase
    .from("products")
    .select("id, name, price, final_price, is_royalty_product, image_url, badge, stock, category", { count: "exact" })
    .eq("seller_id", storefront.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(from, from + STOREFRONT_PAGE_SIZE - 1)
  if (category) query = query.eq("category", category)

  const { data, count } = await query
  const products: StorefrontProduct[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    seller: storefront.name,
    sellerId: storefront.id,
    image: p.image_url ?? "/placeholder.jpg",
    badge: p.badge as Product["badge"],
    stock: p.stock,
    category: p.category,
  }))
  return { products, total: count ?? products.length }
}

/** The seller's own categories (from their approved products) with product counts. */
export async function getStorefrontCategories(supabase: Supabase, sellerId: string) {
  const { data } = await supabase.from("products").select("category").eq("seller_id", sellerId).eq("status", "approved")
  const counts = new Map<string, number>()
  for (const { category } of data ?? []) if (category) counts.set(category, (counts.get(category) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }))
}

/**
 * If the signed-in user manages this storefront (member of its dashboard), the link to edit it
 * in their dashboard; otherwise null. Sellers can never edit other sellers' storefronts.
 */
export async function manageStorefrontHref(supabase: Supabase, sellerId: string, userId: string | null) {
  if (!userId) return null
  const { data } = await supabase
    .from("dashboards")
    .select("id, module, dashboard_members!inner(user_id)")
    .eq("store_id", sellerId)
    .eq("dashboard_members.user_id", userId)
    .limit(1)
  const dash = (data ?? [])[0] as { id: string; module: string } | undefined
  if (!dash) return null
  if (dash.module === "cashier") return `/dashboards/switch?id=${dash.id}&next=/cashier/shop`
  if (dash.module === "supply_office") return "/supply-office/shop"
  return `/dashboards/switch?id=${dash.id}&next=/seller/shop`
}
