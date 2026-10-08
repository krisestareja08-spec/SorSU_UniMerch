import Image from "next/image"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TERMS_UPDATED, hasAcceptedTerms, safeNext } from "@/lib/legal"
import { AcceptTermsForm } from "./accept-terms-form"

/**
 * Asked once before using UniMerch when the account hasn't agreed to the current Terms and
 * Conditions / Privacy Policy: Google sign-ins (no sign-up form) and accounts from before the
 * terms existed or changed. lib/supabase/proxy.ts sends people here.
 */
export default async function AcceptTermsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  if (hasAcceptedTerms(user.user_metadata)) redirect(next)

  const returning = typeof user.user_metadata?.terms_version === "string"

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <Image src="/sorsu-seal.png" alt="Sorsogon State University seal" width={56} height={56} className="mx-auto rounded-full ring-1 ring-border" />
        <h1 className="mt-6 text-center font-serif text-2xl font-semibold tracking-tight">
          {returning ? "We've updated our terms" : "Before you continue"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {returning
            ? `Our Terms and Conditions and Privacy Policy were updated on ${TERMS_UPDATED}. Please review and agree to keep using UniMerch.`
            : "Please review and agree to UniMerch's Terms and Conditions and Privacy Policy to start using your account."}
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground">Signed in as {user.email}</p>
        <AcceptTermsForm next={next} />
      </div>
    </main>
  )
}
