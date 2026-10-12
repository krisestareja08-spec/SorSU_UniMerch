import { cache } from "react"
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

/**
 * The signed-in auth user, or null. Cached for the request: the layout, the page and any server
 * components share one call to the Auth server instead of each making their own.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

type ProfileRow = {
  full_name: string | null
  role: string | null
  affiliation: string | null
  verification_status: string | null
  is_identity_verified: boolean | null
  campus: string | null
  account_status: string | null
}

/** The user's profiles row (one query per request, shared by every caller). */
export const getProfileRow = cache(async (userId: string): Promise<ProfileRow | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role, affiliation, verification_status, is_identity_verified, campus, account_status")
    .eq("id", userId)
    .maybeSingle()
  return error ? null : (data as ProfileRow | null)
})

function toProfile(data: ProfileRow): Profile {
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
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const row = await getProfileRow(user.id)
  if (row?.account_status === "banned") redirect("/auth/restricted")
  const profile = row ? toProfile(row) : profileFromUser(user)

  // Self-heal accounts whose profiles row never got synced (e.g. seeded/demo users) so
  // downstream lookups — including the seller storefront — see consistent data.
  if (!row) {
    const supabase = await createClient()
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
export async function redirectIfBanned(userId: string) {
  const row = await getProfileRow(userId)
  if (row?.account_status === "banned") redirect("/auth/restricted")
}
