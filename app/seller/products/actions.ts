"use server"

import { attempt } from "@/lib/action-result"

import { assertDashboard } from "@/lib/dashboards"
import { MODULES, type ModuleKey } from "@/lib/modules"
import { revalidatePath } from "next/cache"
import { computeRoyalty } from "@/lib/access"
import { getGlobalRoyaltyPercentage } from "@/lib/bao-settings"
import { parsePaymentModes } from "@/lib/product-pricing"
import { loadVariants, parseVariantInputs, variantName, variantRow } from "@/lib/variants"
import { parseAllowed } from "@/lib/campus-catalog"

const NEEDS_SCRIPT_28 = "Sizes with their own price and stock need scripts/28_product_variants.sql. Ask the admin to run it in Supabase."

const STORE_MODULES: ModuleKey[] = ["seller", "cashier", "supply_office"]

/** Products belong to the dashboard's store — never to the member who happens to add them. */
async function storeContext(moduleRaw: unknown) {
  const mod = (STORE_MODULES.includes(moduleRaw as ModuleKey) ? moduleRaw : "seller") as ModuleKey
  const { supabase, storeId } = await assertDashboard(mod, "products")
  if (!storeId) throw new Error("This dashboard has no store.")
  return { supabase, storeId, mod, path: `${MODULES[mod].basePath}/products` }
}

async function addProductImpl(formData: FormData) {
  const { supabase, storeId, mod, path } = await storeContext(formData.get("module"))

  // The store must be active before listing products.
  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("status")
    .eq("id", storeId)
    .maybeSingle()
  if (sellerProfile && sellerProfile.status !== "active") {
    throw new Error("Your storefront must be active before you can list products.")
  }

  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const category = formData.get("category") as string
  // Sizes: each is its own variant (price, stock, SKU, image); the product shows the range and total
  const variants = parseVariantInputs(JSON.parse((formData.get("variants") as string | null) ?? "[]"))
  // Supply Office branches get their stock from the Main Supply Office (restock requests), and so do
  // organizations' collaboration products (paid supply orders): start at 0
  const branch = mod === "cashier" || (mod === "seller" && formData.get("has_logo") === "true" && formData.get("supply_office_collab") === "true")
  if (branch) for (const v of variants) v.stock = 0
  const price = variants.length ? Math.min(...variants.map((v) => v.price)) : parseFloat(formData.get("price") as string)
  const stock = branch ? 0 : variants.length ? variants.reduce((n, v) => n + v.stock, 0) : parseInt(formData.get("stock") as string, 10)
  const badge = formData.get("badge") as string
  const images = (formData.get("images") as string | null)?.split(",").map((u) => u.trim()).filter(Boolean) ?? []
  const sku = formData.get("sku") as string | null
  const tags = (formData.get("tags") as string | null)?.split(",").map((t) => t.trim()).filter(Boolean) ?? []
  const variations = variants.map((v) => variantName(v.size, v.color))
  const paymentModes = parsePaymentModes(JSON.parse((formData.get("payment_modes") as string | null) ?? "[]"))
  const draft = formData.get("draft") === "true"
  const isRestricted = formData.get("is_restricted") === "true"
  const allowedRolesRaw = formData.get("allowed_roles") as string | null
  // Roles + optional campus / college / program tokens, checked against the catalog
  const allowedRoles = isRestricted && allowedRolesRaw ? parseAllowed(JSON.parse(allowedRolesRaw)) : []
  const hasLogo = formData.get("has_logo") === "true"
  // Organization sellers' logo products made with the Main Supply Office: the Supply Office pays the royalty
  const supplyOfficeCollab = mod === "seller" && hasLogo && formData.get("supply_office_collab") === "true"

  if (!name?.trim()) throw new Error("Product name is required.")
  if (isNaN(price) || price < 0) throw new Error("Enter a valid price.")
  if (isNaN(stock) || stock < 0) throw new Error("Enter a valid stock quantity.")
  if (images.length === 0) throw new Error("At least one product image is required.")
  if (isRestricted && !allowedRoles.some((t) => !t.includes(":"))) throw new Error("Select who can buy this restricted product.")

  const royaltyPercentage = hasLogo ? await getGlobalRoyaltyPercentage() : 0
  const { royaltyAmount, finalPrice, isRoyaltyProduct } = computeRoyalty(price, hasLogo, royaltyPercentage)

  const row = {
    seller_id: storeId,
    name, description, category, price, stock, badge,
    image_url: images[0],
    images,
    sku: sku || null,
    tags,
    variations,
    is_restricted: isRestricted,
    allowed_roles: allowedRoles,
    has_logo: hasLogo,
    royalty_percentage: royaltyPercentage,
    royalty_amount: royaltyAmount,
    final_price: finalPrice,
    is_royalty_product: isRoyaltyProduct,
    status: draft ? "draft" : "pending",
    ...(supplyOfficeCollab ? { supply_office_collab: true } : {}),
  }
  let { data: created, error } = await supabase.from("products").insert({ ...row, payment_modes: paymentModes }).select("id").single()
  if (error && /supply_office_collab/.test(error.message)) {
    throw new Error("Supply Office collaborations need scripts/32_performance.sql. Ask the admin to run it in Supabase.")
  }
  if (error && /payment_modes/.test(error.message)) {
    if (paymentModes.length < 2) throw new Error("Payment modes need scripts/27_variant_prices_payment_modes.sql. Ask the admin to run it in Supabase.")
    ;({ data: created, error } = await supabase.from("products").insert(row).select("id").single()) // database without scripts/27 yet
  }
  if (error || !created) throw new Error(error?.message ?? "Couldn't save the product.")

  if (variants.length) {
    const { error: variantError } = await supabase.from("product_variants").insert(variants.map((v, i) => variantRow(created.id, v, i)))
    if (variantError) {
      // Don't leave a product without its sizes behind
      await supabase.from("products").delete().eq("id", created.id)
      throw new Error(/product_variants/.test(variantError.message) ? NEEDS_SCRIPT_28 : variantError.message)
    }
  }
  revalidatePath(path)
}

/**
 * Replaces a product's sizes with the seller's edited list: changed sizes are updated, new ones added,
 * removed ones deleted. The database keeps the product's price range, total stock and size list in sync.
 */
async function saveVariantsImpl(productId: string, module: ModuleKey, variantsJson: string) {
  const { supabase, storeId, path, mod } = await storeContext(module)
  const variants = parseVariantInputs(JSON.parse(variantsJson || "[]"))
  if (variants.length === 0) throw new Error("Add at least one size.")

  const { data: product } = await supabase.from("products").select("*").eq("id", productId).maybeSingle()
  if (!product || product.seller_id !== storeId) throw new Error("Product not found in your store.")
  // Branch and collaboration products: stock only comes from the Main Supply Office
  const lockStock = mod === "cashier" || !!product.supply_office_collab

  const existing = await loadVariants(supabase, [productId])
  if (!existing) throw new Error(NEEDS_SCRIPT_28)
  const current = existing.get(productId) ?? []
  const keepIds = new Set(variants.map((v) => v.id).filter(Boolean))

  const removed = current.filter((v) => !keepIds.has(v.id)).map((v) => v.id)
  if (removed.length) {
    const { error } = await supabase.from("product_variants").delete().in("id", removed)
    if (error) throw new Error(error.message)
  }
  for (const [i, v] of variants.entries()) {
    const row = variantRow(productId, v, i)
    // Branches and collaboration products can't change stock here: it comes from the Main Supply Office
    if (lockStock) row.stock = current.find((c) => c.id === v.id)?.stock ?? 0
    const { error } = v.id && current.some((c) => c.id === v.id)
      ? await supabase.from("product_variants").update(row).eq("id", v.id).eq("product_id", productId)
      : await supabase.from("product_variants").insert(row)
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? `"${row.name}" is listed twice.` : error.message)
  }
  revalidatePath(path)
  revalidatePath(`/marketplace/product/${productId}`)
}

/** Fields that change what a buyer is shown or allowed: editing them on a live product needs BAO again. */
const REVIEWED_FIELDS = ["name", "description", "category", "images", "has_logo", "supply_office_collab", "is_restricted", "allowed_roles"] as const

const same = (a: unknown, b: unknown) => {
  const norm = (v: unknown) => Array.isArray(v) ? JSON.stringify([...v].map(String).sort()) : JSON.stringify(v ?? null)
  return norm(a) === norm(b)
}

/**
 * Edit a product's details. Badge, payment options, SKU, tags and (without sizes) price save straight
 * to the live listing. Changing what BAO reviewed — name, description, category, photos, logo/royalty
 * or restriction — sends an approved product back to BAO (it leaves the marketplace until approved).
 * Editing a rejected or pulled product resubmits it to BAO.
 */
async function updateProductImpl(formData: FormData) {
  const { supabase, storeId, mod, path } = await storeContext(formData.get("module"))
  const productId = String(formData.get("product_id") ?? "")
  const { data: current } = await supabase.from("products").select("*").eq("id", productId).eq("seller_id", storeId).maybeSingle()
  if (!current) throw new Error("Product not found in your store.")

  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const category = String(formData.get("category") ?? "")
  const badge = String(formData.get("badge") ?? "Available")
  const images = String(formData.get("images") ?? "").split(",").map((u) => u.trim()).filter(Boolean)
  const sku = String(formData.get("sku") ?? "").trim() || null
  const tags = String(formData.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean)
  const paymentModes = parsePaymentModes(JSON.parse((formData.get("payment_modes") as string | null) ?? "[]"))
  const isRestricted = formData.get("is_restricted") === "true"
  const allowedRoles = isRestricted ? parseAllowed(JSON.parse((formData.get("allowed_roles") as string | null) ?? "[]")) : []
  const hasLogo = formData.get("has_logo") === "true"
  const supplyOfficeCollab = mod === "seller" && hasLogo && formData.get("supply_office_collab") === "true"

  if (!name) throw new Error("Product name is required.")
  if (!category) throw new Error("Please select a category.")
  if (!["Available", "Pre-Order", "Interest Check", "Sold Out"].includes(badge)) throw new Error("Choose a valid availability.")
  if (images.length === 0) throw new Error("At least one product image is required.")
  if (isRestricted && !allowedRoles.some((t) => !t.includes(":"))) throw new Error("Select who can buy this restricted product.")

  // With sizes, prices live on each size (Sizes & Prices); otherwise the product has one price
  const variants = await loadVariants(supabase, [productId])
  const hasSizes = (variants?.get(productId)?.length ?? 0) > 0
  let price = Number(current.price)
  if (!hasSizes && formData.get("price") != null) {
    price = parseFloat(formData.get("price") as string)
    if (isNaN(price) || price < 0) throw new Error("Enter a valid price.")
  }

  // Royalty follows the logo choice: a product that newly uses the logo takes today's BAO rate
  const royaltyPercentage = !hasLogo ? 0
    : current.is_royalty_product ? Number(current.royalty_percentage) : await getGlobalRoyaltyPercentage()
  const { royaltyAmount, finalPrice, isRoyaltyProduct } = computeRoyalty(price, hasLogo, royaltyPercentage)

  const next = {
    name, description, category, images, has_logo: hasLogo, supply_office_collab: supplyOfficeCollab,
    is_restricted: isRestricted, allowed_roles: allowedRoles,
  }
  const reviewedChange = REVIEWED_FIELDS.some((f) => !same(next[f], current[f] ?? (f === "supply_office_collab" ? false : null)))
  const resubmit = current.status === "rejected" || current.status === "pulled"
  const status = (current.status === "approved" && reviewedChange) || resubmit ? "pending" : current.status

  const row = {
    ...next,
    image_url: images[0],
    badge, sku, tags, price,
    royalty_percentage: royaltyPercentage,
    royalty_amount: royaltyAmount,
    final_price: supplyOfficeCollab ? price : finalPrice,
    is_royalty_product: isRoyaltyProduct,
    status,
    ...(status === "pending" && current.status !== "pending"
      ? { bao_comment: null, ...(current.status === "pulled" ? { pulled_reason: null, pulled_at: null, pulled_by: null } : {}) }
      : {}),
    updated_at: new Date().toISOString(),
  }
  // Database before scripts/32 has no collaboration column: don't send it
  if (current.supply_office_collab === undefined) delete (row as Partial<typeof row>).supply_office_collab

  let { error } = await supabase.from("products").update({ ...row, payment_modes: paymentModes }).eq("id", productId).eq("seller_id", storeId)
  if (error && /payment_modes/.test(error.message)) {
    ;({ error } = await supabase.from("products").update(row).eq("id", productId).eq("seller_id", storeId)) // database without scripts/27 yet
  }
  if (error && /supply_office_collab/.test(error.message)) {
    throw new Error("Supply Office collaborations need scripts/32_performance.sql. Ask the admin to run it in Supabase.")
  }
  if (error && /updated_at/.test(error.message)) {
    const { updated_at: _u, ...withoutStamp } = row
    ;({ error } = await supabase.from("products").update(withoutStamp).eq("id", productId).eq("seller_id", storeId))
  }
  if (error) throw new Error(error.message)

  revalidatePath(path)
  revalidatePath(`/marketplace/product/${productId}`)
  revalidatePath("/marketplace", "layout")
  return { status, sentForReview: status === "pending" && current.status !== "pending" }
}

async function deleteProductImpl(productId: string, module: ModuleKey = "seller") {
  const { supabase, storeId, path } = await storeContext(module)

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("seller_id", storeId)
    .in("status", ["pending", "draft"])

  if (error) throw new Error(error.message)
  revalidatePath(path)
}

async function publishDraftImpl(productId: string, module: ModuleKey = "seller") {
  const { supabase, storeId, path } = await storeContext(module)
  // Drafts made from supply orders may not have a photo yet
  const { data: draft } = await supabase.from("products").select("images, image_url").eq("id", productId).eq("seller_id", storeId).maybeSingle()
  if (draft && !draft.image_url && !(Array.isArray(draft.images) && draft.images.length)) {
    throw new Error("Add at least one photo (Edit) before submitting it for review.")
  }

  const { error } = await supabase
    .from("products")
    .update({ status: "pending" })
    .eq("id", productId)
    .eq("seller_id", storeId)
    .eq("status", "draft")

  if (error) throw new Error(error.message)
  revalidatePath(path)
}

// ── Exported actions: return ActionResult (lib/action-result.ts) instead of throwing ──
export async function addProduct(...args: Parameters<typeof addProductImpl>) {
  return attempt(() => addProductImpl(...args))
}
export async function updateProduct(...args: Parameters<typeof updateProductImpl>) {
  return attempt(() => updateProductImpl(...args))
}
export async function deleteProduct(...args: Parameters<typeof deleteProductImpl>) {
  return attempt(() => deleteProductImpl(...args))
}
export async function publishDraft(...args: Parameters<typeof publishDraftImpl>) {
  return attempt(() => publishDraftImpl(...args))
}
export async function saveVariants(...args: Parameters<typeof saveVariantsImpl>) {
  return attempt(() => saveVariantsImpl(...args))
}
