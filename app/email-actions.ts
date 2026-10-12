"use server"

import { headers } from "next/headers"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { attempt } from "@/lib/action-result"
import { createClient } from "@/lib/supabase/server"
import { getMemberships } from "@/lib/dashboards"
import { INSTANT_EMAIL_MODULES } from "@/lib/modules"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Change the signed-in account's login email.
 *  • Seller / Supply Office / Supply Office branch accounts: changed immediately.
 *  • Everyone else: Supabase emails a confirmation link to the new address; it changes once clicked.
 * Every change is recorded in the Verification Admin's Activity Logs (trigger in scripts/32).
 */
async function changeLoginEmailImpl(formData: FormData): Promise<{ mode: "instant" | "confirm"; email: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) throw new Error("Enter a valid email address.")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Please sign in again.")
  if (email === user.email?.toLowerCase()) throw new Error("That's already your login email.")

  const { data: profile } = await supabase.from("profiles").select("account_status").eq("id", user.id).maybeSingle()
  if (profile?.account_status === "banned" || profile?.account_status === "suspended") {
    throw new Error("Your account is restricted. Contact the Verification Admin.")
  }

  const taken = (msg: string) => /already|registered|exists|duplicate/i.test(msg)

  const memberships = await getMemberships(supabase, user.id)
  if (memberships.some((m) => INSTANT_EMAIL_MODULES.includes(m.module))) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Email changes aren't configured on the server (missing service role key).")
    const admin = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error } = await admin.auth.admin.updateUserById(user.id, { email, email_confirm: true })
    if (error) throw new Error(taken(error.message) ? "That email is already used by another account." : error.message)
    return { mode: "instant", email }
  }

  const origin = (await headers()).get("origin") ?? ""
  const { error } = await supabase.auth.updateUser(
    { email },
    origin ? { emailRedirectTo: `${origin}/auth/callback?next=/marketplace/settings` } : undefined,
  )
  if (error) {
    if (taken(error.message)) throw new Error("That email is already used by another account.")
    if (/rate|too many/i.test(error.message)) throw new Error("Too many attempts. Please wait a few minutes and try again.")
    throw new Error(error.message)
  }
  return { mode: "confirm", email }
}

export async function changeLoginEmail(...args: Parameters<typeof changeLoginEmailImpl>) {
  return attempt(() => changeLoginEmailImpl(...args))
}
