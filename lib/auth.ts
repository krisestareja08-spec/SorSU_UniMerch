import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/roles"
import type { Profile } from "@/lib/profile"
import { profileFromUser } from "@/lib/profile"

export type { Profile } from "@/lib/profile"

export type SessionUser = {
  id: string
  email: string
  profile: Profile
}

async function getProfileFromDatabase(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role, affiliation, verification_status, is_identity_verified, campus")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) return null

  return {
    full_name: data.full_name ?? null,
    role: (typeof data.role === "string" && ["buyer", "seller", "bao", "supply_office", "cashier", "admin"].includes(data.role) ? data.role : "buyer") as UserRole,
    affiliation: (typeof data.affiliation === "string" && ["student", "faculty", "staff", "alumni", "external"].includes(data.affiliation) ? data.affiliation : "external") as Profile["affiliation"],
    verification_status: (typeof data.verification_status === "string" && ["unverified", "pending", "approved", "rejected"].includes(data.verification_status) ? data.verification_status : "unverified") as Profile["verification_status"],
    is_identity_verified: Boolean(data.is_identity_verified),
    campus: (data.campus ?? null) as Profile["campus"],
  } satisfies Profile
}

/**
 * Fetch the signed-in user + profile, redirecting to login if unauthenticated.
 * Management pages use requireDashboard() (lib/dashboards.ts) instead — access comes from
 * dashboard membership, not from a role on the user.
 */
export async function requireUser(): Promise<SessionUser> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  await redirectIfBanned(supabase, user.id)
  const dbProfile = await getProfileFromDatabase(supabase, user.id)
  const profile = dbProfile ?? profileFromUser(user)

  // Self-heal accounts whose profiles row never got synced (e.g. seeded/demo users) so
  // downstream lookups — including the seller storefront — see consistent data.
  if (!dbProfile) {
    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: profile.full_name,
      role: "buyer",
      affiliation: profile.affiliation,
      verification_status: profile.verification_status,
      is_identity_verified: profile.is_identity_verified,
      campus: profile.campus,
    }, { onConflict: "id" }).then(() => {}, () => {})
  }

  return { id: user.id, email: user.email ?? "", profile }
}

/** Banned accounts (e.g. confirmed dummy accounts) are locked out of the whole app. */
export async function redirectIfBanned(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("account_status").eq("id", userId).maybeSingle()
  if (data?.account_status === "banned") redirect("/auth/restricted")
}
