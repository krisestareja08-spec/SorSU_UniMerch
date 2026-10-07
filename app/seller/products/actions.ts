"use server"

import { attempt } from "@/lib/action-result"

import { assertDashboard } from "@/lib/dashboards"
import { MODULES, type ModuleKey } from "@/lib/modules"
import { revalidatePath } from "next/cache"
import { computeRoyalty } from "@/lib/access"
import { getGlobalRoyaltyPercentage } from "@/lib/bao-settings"
import { parsePaymentModes } from "@/lib/product-pricing"
import { loadVariants, parseVariantInputs, variantName, variantRow } from "@/lib/variants"

const NEEDS_SCRIPT_28 = "Sizes with their own price and stock need scripts/28_product_variants.sql. Ask the admin to run it in Supabase."

const STORE_MODULES: ModuleKey[] = ["seller", "cashier", "supply_office"]

/** Products belong to the dashboard's store — never to the member who happens to add them. */
async function storeContext(moduleRaw: unknown) {
  const mod = (STORE_MODULES.includes(moduleRaw as ModuleKey) ? moduleRaw : "seller") as ModuleKey
  const { supabase, storeId } = await assertDashboard(mod, "products")
  if (!storeId) throw new Error("This dashboard has no store.")
  return { supabase, storeId, path: `${MODULES[mod].basePath}/products` }
}

async function addProductImpl(formData: FormData) {
  const { supabase, storeId, path } = await storeContext(formData.get("module"))

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
  const price = variants.length ? Math.min(...variants.map((v) => v.price)) : parseFloat(formData.get("price") as string)
  const stock = variants.length ? variants.reduce((n, v) => n + v.stock, 0) : parseInt(formData.get("stock") as string, 10)
  const badge = formData.get("badge") as string
  const images = (formData.get("images") as string | null)?.split(",").map((u) => u.trim()).filter(Boolean) ?? []
  const sku = formData.get("sku") as string | null
  const tags = (formData.get("tags") as string | null)?.split(",").map((t) => t.trim()).filter(Boolean) ?? []
  const variations = variants.map((v) => variantName(v.size, v.color))
  const paymentModes = parsePaymentModes(JSON.parse((formData.get("payment_modes") as string | null) ?? "[]"))
  const draft = formData.get("draft") === "true"
  const isRestricted = formData.get("is_restricted") === "true"
  const allowedRolesRaw = formData.get("allowed_roles") as string | null
  const allowedRoles = isRestricted && allowedRolesRaw ? JSON.parse(allowedRolesRaw) as string[] : []
  const hasLogo = formData.get("has_logo") === "true"

  if (!name?.trim()) throw new Error("Product name is required.")
  if (isNaN(price) || price < 0) throw new Error("Enter a valid price.")
  if (isNaN(stock) || stock < 0) throw new Error("Enter a valid stock quantity.")
  if (images.length === 0) throw new Error("At least one product image is required.")
  if (isRestricted && allowedRoles.length === 0) throw new Error("Select who can buy this restricted product.")

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
  }
  let { data: created, error } = await supabase.from("products").insert({ ...row, payment_modes: paymentModes }).select("id").single()
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
  const { supabase, storeId, path } = await storeContext(module)
  const variants = parseVariantInputs(JSON.parse(variantsJson || "[]"))
  if (variants.length === 0) throw new Error("Add at least one size.")

  const { data: product } = await supabase.from("products").select("id, seller_id").eq("id", productId).maybeSingle()
  if (!product || product.seller_id !== storeId) throw new Error("Product not found in your store.")

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
    const { error } = v.id && current.some((c) => c.id === v.id)
      ? await supabase.from("product_variants").update(row).eq("id", v.id).eq("product_id", productId)
      : await supabase.from("product_variants").insert(row)
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? `"${row.name}" is listed twice.` : error.message)
  }
  revalidatePath(path)
  revalidatePath(`/marketplace/product/${productId}`)
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
export async function deleteProduct(...args: Parameters<typeof deleteProductImpl>) {
  return attempt(() => deleteProductImpl(...args))
}
export async function publishDraft(...args: Parameters<typeof publishDraftImpl>) {
  return attempt(() => publishDraftImpl(...args))
}
export async function saveVariants(...args: Parameters<typeof saveVariantsImpl>) {
  return attempt(() => saveVariantsImpl(...args))
}
