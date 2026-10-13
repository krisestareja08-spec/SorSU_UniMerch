import { identityOnCatalog } from "@/lib/campus-catalog"

/**
 * Where a buyer stands with identity verification (profiles.verification_status / is_identity_verified):
 *   none — never applied · pending — under review · redo — declined, can reapply · verified — done
 *   update — applied/verified, but campus, college or course isn't on the official catalog yet
 * Plain module (not "use client"): the marketplace layout computes it on the server.
 */
export type VerificationState = "none" | "pending" | "redo" | "verified" | "update"

export function verificationState(p: {
  is_identity_verified?: boolean | null; verification_status?: string | null
  affiliation?: string | null; campus?: string | null; department?: string | null; course?: string | null
} | null): VerificationState {
  const applied = p?.is_identity_verified || p?.verification_status === "pending" || p?.verification_status === "rejected"
  // Already applied or verified, but their details predate the official catalog → ask them to update
  if (p && applied && !identityOnCatalog(p)) return "update"
  if (p?.is_identity_verified) return "verified"
  if (p?.verification_status === "pending") return "pending"
  if (p?.verification_status === "rejected") return "redo"
  return "none"
}
