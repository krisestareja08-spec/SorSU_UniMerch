"use server"

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function createSellerAccount(formData: FormData) {
  // Verify caller is registrar or admin
  const supabase = await createClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) throw new Error("Not authenticated")

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle()
  if (!callerProfile || !["registrar", "admin"].includes(callerProfile.role)) {
    throw new Error("Unauthorized")
  }

  const orgName  = formData.get("org_name") as string
  const email    = formData.get("email") as string
  const password = formData.get("password") as string
  const description = formData.get("description") as string
  const category = formData.get("category") as string

  if (!orgName || !email || !password || password.length < 8) {
    throw new Error("All fields are required and password must be at least 8 characters.")
  }

  const serviceUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceUrl || !serviceKey) throw new Error("Missing service role configuration.")

  const adminSupabase = createAdminClient(serviceUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Create auth user
  const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: orgName,
      role: "seller",
      affiliation: "external",
      is_identity_verified: true,
      verification_status: "approved",
    },
  })
  if (createError || !newUser.user) {
    throw new Error(createError?.message ?? "Failed to create account.")
  }

  const userId = newUser.user.id

  // Upsert profile row
  await adminSupabase.from("profiles").upsert(
    { id: userId, full_name: orgName, role: "seller", affiliation: "external", is_identity_verified: true, verification_status: "approved" },
    { onConflict: "id" }
  )

  // Insert seller profile
  await supabase.from("seller_profiles").insert({
    id: userId,
    org_name: orgName,
    description,
    category,
    created_by: caller.id,
    status: "active",
  })

  redirect("/registrar?seller_created=1")
}
