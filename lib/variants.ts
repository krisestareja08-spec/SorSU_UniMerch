import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Product variants (scripts/28_product_variants.sql): each size (and optional colour) is its own
 * purchasable option with its own price, stock, SKU and image. The cart, checkout and orders always
 * point at one variant. products.price / price_max / stock are kept in sync by the database.
 */
export type Variant = {
  id: string
  name: string
  size: string | null
  color: string | null
  price: number
  stock: number
  sku: string | null
  imageUrl: string | null
}

/** What the seller enters for one size. */
export type VariantInput = {
  id?: string
  size: string
  color?: string | null
  price: number
  stock: number
  sku?: string | null
  imageUrl?: string | null
}

export const VARIANT_COLUMNS = "id, product_id, name, size, color, price, stock, sku, image_url, position"

/** "M", or "M / Maroon" when a colour is given. */
export function variantName(size: string, color?: string | null) {
  const s = size.trim()
  const c = (color ?? "").trim()
  return c ? `${s} / ${c}` : s
}

type Row = { id: string; product_id: string; name: string; size: string | null; color: string | null; price: number; stock: number; sku: string | null; image_url: string | null; position: number }

export function toVariant(r: Row): Variant {
  return { id: r.id, name: r.name, size: r.size, color: r.color, price: Number(r.price), stock: Number(r.stock), sku: r.sku, imageUrl: r.image_url }
}

/**
 * Variants for these products, grouped by product id (sorted as the seller listed them).
 * Returns null when the variants table doesn't exist yet (scripts/28 not run).
 */
export async function loadVariants(supabase: SupabaseClient, productIds: string[]): Promise<Map<string, Variant[]> | null> {
  const ids = [...new Set(productIds)].filter(Boolean)
  const out = new Map<string, Variant[]>()
  if (ids.length === 0) return out
  const { data, error } = await supabase
    .from("product_variants")
    .select(VARIANT_COLUMNS)
    .in("product_id", ids)
    .order("position")
    .order("created_at")
  if (error) return null
  for (const r of (data ?? []) as Row[]) out.set(r.product_id, [...(out.get(r.product_id) ?? []), toVariant(r)])
  return out
}

/** Adds priceMax (highest variant price) to product cards; a no-op before scripts/28. */
export async function withPriceRange<T extends { id: string }>(supabase: SupabaseClient, products: T[]): Promise<(T & { priceMax?: number | null })[]> {
  if (products.length === 0) return products
  const { data, error } = await supabase.from("products").select("id, price_max").in("id", products.map((p) => p.id))
  if (error) return products
  const max = new Map((data ?? []).map((r: { id: string; price_max: number | null }) => [r.id, r.price_max != null ? Number(r.price_max) : null]))
  return products.map((p) => ({ ...p, priceMax: max.get(p.id) ?? null }))
}

const peso = (n: number) => `₱${n.toLocaleString()}`

/** "₱250" or "₱250 – ₱320" across the variants (or the product price when it has none). */
export function priceRangeLabel(basePrice: number, variants: Variant[] | undefined, priceMax?: number | null) {
  const prices = variants?.length ? variants.map((v) => v.price) : [basePrice, Number(priceMax ?? basePrice)]
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? peso(min) : `${peso(min)} – ${peso(max)}`
}

/** Server side: the seller's variant rows from the form, cleaned and checked (throws a readable message). */
export function parseVariantInputs(raw: unknown): VariantInput[] {
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  return list.map((r: Record<string, unknown>, i) => {
    const size = String(r?.size ?? "").trim().slice(0, 40)
    const color = String(r?.color ?? "").trim().slice(0, 40) || null
    if (!size) throw new Error(`Variant ${i + 1} needs a size.`)
    const name = variantName(size, color)
    if (seen.has(name.toLowerCase())) throw new Error(`"${name}" is listed twice.`)
    seen.add(name.toLowerCase())
    const price = Number(r?.price)
    const stock = Number(r?.stock)
    if (!Number.isFinite(price) || price < 0) throw new Error(`Enter a valid price for ${name}.`)
    if (!Number.isInteger(stock) || stock < 0) throw new Error(`Enter a valid stock for ${name}.`)
    return {
      id: typeof r?.id === "string" ? r.id : undefined,
      size, color, price: Math.round(price * 100) / 100, stock,
      sku: String(r?.sku ?? "").trim().slice(0, 60) || null,
      imageUrl: typeof r?.imageUrl === "string" && r.imageUrl ? r.imageUrl : null,
    }
  })
}

/** Database row for one variant. */
export function variantRow(productId: string, v: VariantInput, position: number) {
  return {
    product_id: productId, name: variantName(v.size, v.color), size: v.size, color: v.color ?? null,
    price: v.price, stock: v.stock, sku: v.sku ?? null, image_url: v.imageUrl ?? null, position, updated_at: new Date().toISOString(),
  }
}
