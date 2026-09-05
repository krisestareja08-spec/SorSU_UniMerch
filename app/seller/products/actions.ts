"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function addProduct(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const category = formData.get("category") as string
  const price = parseFloat(formData.get("price") as string)
  const stock = parseInt(formData.get("stock") as string, 10)
  const badge = formData.get("badge") as string
  const imageUrl = formData.get("image_url") as string | null
  const sku = formData.get("sku") as string | null
  const tags = (formData.get("tags") as string | null)?.split(",").map((t) => t.trim()).filter(Boolean) ?? []
  const variationsRaw = formData.get("variations") as string | null
  const variations = variationsRaw ? JSON.parse(variationsRaw) : []

  const { error } = await supabase.from("products").insert({
    seller_id: user.id,
    name, description, category, price, stock, badge,
    image_url: imageUrl || null,
    sku: sku || null,
    tags,
    variations,
    status: "pending",
  })

  if (error) throw new Error(error.message)
  revalidatePath("/seller/products")
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("seller_id", user.id)
    .eq("status", "pending")

  if (error) throw new Error(error.message)
  revalidatePath("/seller/products")
}
