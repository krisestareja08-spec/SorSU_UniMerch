import { CAMPUS_LABELS, type Campus } from "@/lib/roles"
import { collegeLabel } from "@/lib/campus-catalog"

/** What a Supply Office branch serves. Centralized branches still belong to a campus location. */
export type CashierScope = "campus" | "department" | "centralized"

export const CASHIER_SCOPE_LABELS: Record<CashierScope, string> = {
  campus: "Whole campus branch",
  department: "One department",
  centralized: "Centralized (university-wide)",
}

/** Short campus name, e.g. "Bulan Campus" → used in branch names. */
function campusShort(campus: string | null | undefined) {
  return CAMPUS_LABELS[campus as Campus] ?? "Unknown campus"
}

export function cashierBranchName(campus: Campus, scope: CashierScope, department?: string | null) {
  const where = campusShort(campus)
  if (scope === "department") return `Supply Office — ${collegeLabel(department, { short: true }) ?? department} (${where})`
  if (scope === "centralized") return `Supply Office — Centralized (${where})`
  return `Supply Office — ${where}`
}
