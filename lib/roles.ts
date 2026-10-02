/**
 * Legacy `profiles.role` column. It no longer grants access: every person is a user, and
 * management dashboards (modules) are assigned through dashboard membership — see lib/modules.ts.
 */
export type UserRole = "buyer" | "seller" | "bao" | "supply_office" | "cashier" | "admin"

export type Affiliation = "student" | "faculty" | "staff" | "alumni" | "external"

export type Campus =
  | "sorsogon_city_main"
  | "bulan"
  | "castilla"
  | "magallanes"
  | "sorsogon_city_baribag"

export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected"

export const AFFILIATION_LABELS: Record<Affiliation, string> = {
  student:  "Student",
  faculty:  "Faculty",
  staff:    "Staff / Non-teaching",
  alumni:   "Alumni",
  external: "General public",
}

/** Campus identity — required for all verified members (students, staff, sellers). Not applicable to guest/external accounts. */
export const CAMPUS_LABELS: Record<Campus, string> = {
  sorsogon_city_main:     "Sorsogon City Main Campus",
  bulan:                  "Bulan Campus",
  castilla:               "Castilla Campus",
  magallanes:             "Magallanes Campus",
  sorsogon_city_baribag:  "Sorsogon City Campus Extension \u2013 Baribag",
}
