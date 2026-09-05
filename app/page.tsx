import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { roleHome } from "@/lib/roles"
import { profileFromUser } from "@/lib/profile"

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const profileRole = error || !data ? profileFromUser(user).role : (data.role ?? "buyer")
  redirect(roleHome(profileRole))
}
