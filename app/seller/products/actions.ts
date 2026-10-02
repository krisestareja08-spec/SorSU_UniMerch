"use server"

import { assertDashboard } from "@/lib/dashboards"
import { MODULES, type ModuleKey } from "@/lib/modules"
import { revalidatePath } from "next/cache"
import { computeRoyalty } from "@/lib/access"
import { getGlobalRoyaltyPercentage } from "@/lib/bao-settings"

const STORE_MODULES: ModuleKey[] = ["seller", "cashier", "supply_office"]

/** Products belong to the dashboard's store — never to the member who happens to add them. */
async function storeContext(moduleRaw: unknown) {
  const mod = (STORE_MODULES.includes(moduleRaw as ModuleKey) ? moduleRaw : "seller") as ModuleKey
  const { supabase, storeId } = await assertDashboard(mod, "products")
  if (!storeId) throw new Error("This dashboard has no store.")
  return { supabase, storeId, path: `${MODULES[mod].basePath}/products` }
}

export async function addProduct(formData: FormData) {
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
  const price = parseFloat(formData.get("price") as string)
  const stock = parseInt(formData.get("stock") as string, 10)
  const badge = formData.get("badge") as string
  const images = (formData.get("images") as string | null)?.split(",").map((u) => u.trim()).filter(Boolean) ?? []
  const sku = formData.get("sku") as string | null
  const tags = (formData.get("tags") as string | null)?.split(",").map((t) => t.trim()).filter(Boolean) ?? []
  const variationsRaw = formData.get("variations") as string | null
  const variations = variationsRaw ? JSON.parse(variationsRaw) : []
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

  const { error } = await supabase.from("products").insert({
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
  })

  if (error) throw new Error(error.message)
  revalidatePath(path)
}

export async function deleteProduct(productId: string, module: ModuleKey = "seller") {
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

export async function publishDraft(productId: string, module: ModuleKey = "seller") {
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
