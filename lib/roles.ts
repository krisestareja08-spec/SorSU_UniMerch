export type UserRole = "buyer" | "seller" | "bao" | "supply_office" | "registrar" | "admin"

export type Affiliation = "student" | "faculty" | "staff" | "alumni" | "external"

export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected"

export const ROLE_LABELS: Record<UserRole, string> = {
  buyer:         "Buyer",
  seller:        "Organisation Seller",
  bao:           "BAO Admin",
  supply_office: "Supply Office",
  registrar:     "Registrar",
  admin:         "BAO Admin",   // admin is an alias for bao
}

export const AFFILIATION_LABELS: Record<Affiliation, string> = {
  student:  "Student",
  faculty:  "Faculty",
  staff:    "Staff / Non-teaching",
  alumni:   "Alumni",
  external: "General public",
}

/**
 * The marketplace is the universal home page for ALL roles.
 * Role-specific dashboards are accessed via sidebar navigation.
 */
export function roleHome(role?: string | null): string {
  return "/marketplace"
}

/** Returns the role-specific dashboard path (for sidebar links). */
export function roleDashboard(role?: string | null): string {
  switch (role) {
    case "seller":        return "/seller"
    case "bao":
    case "admin":         return "/bao"
    case "supply_office": return "/supply-office"
    case "registrar":     return "/registrar"
    case "cashier":       return "/cashier"
    default:              return "/dashboard"
  }
}

/** True if the role has management dashboard access. */
export function isStaffRole(role?: string | null): boolean {
  return ["bao", "admin", "supply_office", "registrar", "seller"].includes(role ?? "")
}
