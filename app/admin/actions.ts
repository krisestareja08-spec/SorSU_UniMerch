"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const ASSIGNABLE_ROLES = ["buyer", "seller", "bao", "supply_office", "registrar", "admin"] as const

export async function updateUserRole(formData: FormData) {
  const userId = formData.get("user_id") as string
  const role = formData.get("role") as string
  if (!userId || !ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) {
    throw new Error("Invalid role assignment")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId)
  if (error) throw new Error(error.message)

  revalidatePath("/admin")
}
