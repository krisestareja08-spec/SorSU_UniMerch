/**
 * Who may shop on the marketplace. Plain accounts always may. A dashboard member may too when they
 * are a verified student / faculty / staff and every dashboard they belong to is a store dashboard
 * (organization seller, Supply Office or a branch) — they switch between buying and their dashboard.
 * Verification Admin and BAO accounts, and store logins that aren't a verified university member,
 * stay dashboard-only.
 *
 * No imports: the proxy (lib/supabase/proxy.ts) uses this too.
 */
export const SHOPPING_MODULES = ["seller", "supply_office", "cashier"]
const UNIVERSITY_MEMBERS = ["student", "faculty", "staff"]

type Profile = { is_identity_verified?: boolean | null; affiliation?: string | null } | null | undefined

export function canShopAsMember(profile: Profile, memberModules: string[]): boolean {
  if (memberModules.length === 0) return true
  if (!memberModules.every((m) => SHOPPING_MODULES.includes(m))) return false
  return !!profile?.is_identity_verified && UNIVERSITY_MEMBERS.includes(profile?.affiliation ?? "")
}

/** A store member who could shop once their identity is verified */
export function couldShopOnceVerified(profile: Profile, memberModules: string[]): boolean {
  return memberModules.length > 0 && memberModules.every((m) => SHOPPING_MODULES.includes(m))
    && !profile?.is_identity_verified && UNIVERSITY_MEMBERS.includes(profile?.affiliation ?? "")
}
