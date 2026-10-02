import { CAMPUS_LABELS, type Campus } from "@/lib/roles"

/** What a cashier branch serves. Centralized branches still belong to a campus location. */
export type CashierScope = "campus" | "department" | "centralized"

export const CASHIER_SCOPE_LABELS: Record<CashierScope, string> = {
  campus: "Whole campus branch",
  department: "One department",
  centralized: "Centralized (university-wide)",
}

/** Short campus name, e.g. "Bulan Campus" → used in branch names. */
export function campusShort(campus: string | null | undefined) {
  return CAMPUS_LABELS[campus as Campus] ?? "Unknown campus"
}

export function cashierBranchName(campus: Campus, scope: CashierScope, department?: string | null) {
  const where = campusShort(campus)
  if (scope === "department") return `Cashier — ${department} (${where})`
  if (scope === "centralized") return `Cashier — Centralized (${where})`
  return `Cashier — ${where}`
}
