import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { roleHome, type UserRole } from "@/lib/roles"
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
    .select("full_name, role, affiliation, verification_status, is_identity_verified")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) return null

  return {
    full_name: data.full_name ?? null,
    role: (typeof data.role === "string" && ["buyer", "seller", "bao", "supply_office", "registrar", "admin"].includes(data.role) ? data.role : "buyer") as UserRole,
    affiliation: (typeof data.affiliation === "string" && ["student", "faculty", "staff", "alumni", "external"].includes(data.affiliation) ? data.affiliation : "external") as Profile["affiliation"],
    verification_status: (typeof data.verification_status === "string" && ["unverified", "pending", "approved", "rejected"].includes(data.verification_status) ? data.verification_status : "unverified") as Profile["verification_status"],
    is_identity_verified: Boolean(data.is_identity_verified),
  } satisfies Profile
}

/**
 * Fetch the signed-in user + profile, redirecting to login if unauthenticated.
 * If `allowed` roles are provided, users outside that set are redirected to
 * their own role home (prevents cross-module access).
 */
export async function requireUser(allowed?: UserRole[]): Promise<SessionUser> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const profile = (await getProfileFromDatabase(supabase, user.id)) ?? profileFromUser(user)

  if (allowed && !allowed.includes(profile.role)) {
    redirect(roleHome(profile.role))
  }

  return { id: user.id, email: user.email ?? "", profile }
}
