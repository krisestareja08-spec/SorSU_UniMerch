/**
 * Terms and Conditions + Privacy Policy acceptance.
 *
 * Acceptance is stored on the account (Supabase auth user_metadata: terms_version + terms_accepted_at).
 * New accounts accept with a checkbox on the sign-up form; Google sign-ins and older accounts are
 * asked once on /auth/accept-terms (lib/supabase/proxy.ts sends them there). Raise TERMS_VERSION
 * whenever the Terms or Privacy Policy change in a way people must agree to again.
 */
export const TERMS_VERSION = "2026-10-08"
export const TERMS_UPDATED = "October 8, 2026"

export function hasAcceptedTerms(meta: Record<string, unknown> | null | undefined) {
  return meta?.terms_version === TERMS_VERSION
}

/** What gets saved on the account when someone agrees. */
export function termsAcceptance() {
  return { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() }
}

/** Only same-site paths are allowed as "continue to" targets. */
export function safeNext(next: string | null | undefined, fallback = "/") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback
}
