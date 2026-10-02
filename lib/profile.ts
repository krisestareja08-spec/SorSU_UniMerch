import type { Affiliation, Campus, UserRole, VerificationStatus } from "@/lib/roles"

export type Profile = {
  full_name: string | null
  role: UserRole
  affiliation: Affiliation
  verification_status: VerificationStatus
  is_identity_verified: boolean
  campus?: Campus | null
}

const AFFILIATION_VALUES: Affiliation[] = ["student", "faculty", "staff", "alumni", "external"]
const CAMPUS_VALUES: Campus[] = ["sorsogon_city_main", "bulan", "castilla", "magallanes", "sorsogon_city_baribag"]

function isAffiliation(value: unknown): value is Affiliation {
  return typeof value === "string" && AFFILIATION_VALUES.includes(value as Affiliation)
}

function isCampus(value: unknown): value is Campus {
  return typeof value === "string" && CAMPUS_VALUES.includes(value as Campus)
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

  // Roles don't come from (user-editable) metadata; dashboard access is membership-based.
  const role: UserRole = "buyer"
  const affiliation = isAffiliation(metadata.affiliation) ? metadata.affiliation : "external"
  // Verification is only ever granted by the Verification Admin (stored on the profiles row).
  // User metadata is editable by the user, so it is never trusted for verification.
  const verificationStatus = metadata.verification_status === "pending" ? "pending" : "unverified"
  const campus = isCampus(metadata.campus) ? metadata.campus : null

  return {
    full_name: fullName,
    role,
    affiliation,
    verification_status: verificationStatus,
    is_identity_verified: false,
    campus,
  }
}
