import type { Affiliation, UserRole, VerificationStatus } from "@/lib/roles"

export type Profile = {
  full_name: string | null
  role: UserRole
  affiliation: Affiliation
  verification_status: VerificationStatus
  is_identity_verified: boolean
}

const USER_ROLE_VALUES: UserRole[] = ["buyer", "seller", "bao", "supply_office", "registrar", "admin"]
const AFFILIATION_VALUES: Affiliation[] = ["student", "faculty", "staff", "alumni", "external"]
const VERIFICATION_VALUES: VerificationStatus[] = ["unverified", "pending", "approved", "rejected"]

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLE_VALUES.includes(value as UserRole)
}

function isAffiliation(value: unknown): value is Affiliation {
  return typeof value === "string" && AFFILIATION_VALUES.includes(value as Affiliation)
}

function isVerificationStatus(value: unknown): value is VerificationStatus {
  return typeof value === "string" && VERIFICATION_VALUES.includes(value as VerificationStatus)
}

export function profileFromUser(user: {
  id?: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}): Profile {
  const metadata = user.user_metadata ?? {}
  const fullName =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    user.email?.split("@")[0] ||
    null

  const role = isUserRole(metadata.role) ? metadata.role : "buyer"
  const affiliation = isAffiliation(metadata.affiliation) ? metadata.affiliation : "external"
  const verificationStatus = isVerificationStatus(metadata.verification_status)
    ? metadata.verification_status
    : "unverified"

  return {
    full_name: fullName,
    role,
    affiliation,
    verification_status: verificationStatus,
    is_identity_verified: Boolean(metadata.is_identity_verified),
  }
}
