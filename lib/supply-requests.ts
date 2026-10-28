import { createClient } from "@/lib/supabase/server"
import { loadVariants } from "@/lib/variants"
import type { PickProduct, SupplyAttachment, SupplyItem, SupplyRequest } from "@/lib/supply-request-shape"

/**
 * Supply requests (scripts/31) for the requester (an organization or a Supply Office branch) and
 * for the Main Supply Office. Row-level security decides what each side can read.
 */

export const SUPPLY_SETUP = "Supply requests need the latest scripts/31_supply_office_branches.sql and scripts/32_performance.sql. Ask the admin to run them in Supabase."

type Row = Omit<SupplyRequest, "requester_name" | "items" | "attachments"> & { attachments: unknown; supply_request_items?: SupplyItem[] }

async function withNames(rows: Row[]): Promise<SupplyRequest[]> {
  const supabase = await createClient()
  const ids = [...new Set(rows.map((r) => r.requester_store_id))]
  const { data } = ids.length ? await supabase.from("seller_profiles").select("id, org_name").in("id", ids) : { data: [] }
  const names = new Map((data ?? []).map((s) => [s.id as string, s.org_name as string]))
  return rows.map(({ supply_request_items, attachments, ...r }) => ({
    ...r,
    requester_name: names.get(r.requester_store_id) ?? "Store",
    attachments: Array.isArray(attachments) ? (attachments as SupplyAttachment[]) : [],
    items: [...(supply_request_items ?? [])].sort((a, b) => a.position - b.position).map((i) => ({
      ...i, unit_price: i.unit_price == null ? null : Number(i.unit_price), royalty_amount: Number(i.royalty_amount ?? 0),
    })),
    items_total: r.items_total == null ? null : Number(r.items_total),
    royalty_total: r.royalty_total == null ? null : Number(r.royalty_total),
    delivery_fee: Number(r.delivery_fee ?? 0),
    total: r.total == null ? null : Number(r.total),
  }))
}

/** A store's own requests, or (no store) every request the Main office can see — newest first. */
export async function listSupplyRequests(storeId?: string): Promise<{ requests: SupplyRequest[]; error: string | null }> {
  const supabase = await createClient()
  let q = supabase.from("supply_requests").select("*, supply_request_items(*)").order("created_at", { ascending: false }).limit(300)
  if (storeId) q = q.eq("requester_store_id", storeId)
  const { data, error } = await q
  if (error) return { requests: [], error: /supply_request/.test(error.message) ? SUPPLY_SETUP : error.message }
  return { requests: await withNames((data ?? []) as unknown as Row[]), error: null }
}

/** One request with its items; private proposal documents get short-lived links. */
export async function getSupplyRequest(id: string): Promise<{ request: SupplyRequest | null; error: string | null }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { request: null, error: null }
  const supabase = await createClient()
  const { data, error } = await supabase.from("supply_requests").select("*, supply_request_items(*)").eq("id", id).maybeSingle()
  if (error) return { request: null, error: /supply_request/.test(error.message) ? SUPPLY_SETUP : error.message }
  if (!data) return { request: null, error: null }
  const [request] = await withNames([data as unknown as Row])
  request.attachments = await Promise.all(request.attachments.map(async (a) => {
    if (!a.path) return a
    const { data: signed } = await supabase.storage.from("supply-requests").createSignedUrl(a.path, 60 * 30)
    return { ...a, signedUrl: signed?.signedUrl ?? null }
  }))
  return { request, error: null }
}

async function toPickProducts(rows: { id: string; name: string; price: number; image_url: string | null; is_royalty_product?: boolean }[]): Promise<PickProduct[]> {
  const supabase = await createClient()
  const variants = (await loadVariants(supabase, rows.map((r) => r.id))) ?? new Map()
  return rows.map((p) => ({
    id: p.id, name: p.name, price: Number(p.price), image: p.image_url, logo: !!p.is_royalty_product,
    sizes: (variants.get(p.id) ?? []).map((v: { id: string; name: string; price: number }) => ({ id: v.id, name: v.name, price: Number(v.price) })),
  }))
}

/** The Main Supply Office's live products, to order from. */
export async function mainCatalog(): Promise<PickProduct[]> {
  const supabase = await createClient()
  const { data: mainStore } = await supabase.rpc("main_supply_store")
  if (!mainStore) return []
  const { data } = await supabase.from("products").select("id, name, price, image_url, is_royalty_product")
    .eq("seller_id", mainStore as string).eq("status", "approved").order("name").limit(500)
  return toPickProducts((data ?? []) as { id: string; name: string; price: number; image_url: string | null; is_royalty_product: boolean }[])
}

/** An organization's collaboration products (their stock is ordered from the Main office). */
export async function collabProducts(storeId: string): Promise<PickProduct[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("products").select("id, name, price, image_url, is_royalty_product")
    .eq("seller_id", storeId).eq("supply_office_collab", true).neq("status", "draft").order("name")
  if (error) return []
  return toPickProducts((data ?? []) as { id: string; name: string; price: number; image_url: string | null; is_royalty_product: boolean }[])
}
