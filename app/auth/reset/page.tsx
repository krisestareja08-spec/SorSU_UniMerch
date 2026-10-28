"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

type Problem = "expired" | "failed"

/** What the reset email's link brought: the sign-in (in the #fragment), a code, or an error */
function readLink() {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  // Keep the sign-in out of the address bar and the history
  window.history.replaceState(null, "", window.location.pathname)
  return {
    accessToken: hash.get("access_token"),
    refreshToken: hash.get("refresh_token"),
    code: query.get("code"),
    expired: /expired|invalid/i.test(hash.get("error_description") ?? query.get("error_description") ?? "") || hash.get("error_code") === "otp_expired",
  }
}

/**
 * Where the password-reset email's link lands (sent by /auth/forgot-password). Signs the person in
 * with the link, then opens /auth/update-password. Works in any browser, so it doesn't matter which
 * one the email app opens.
 */
export default function ResetLinkPage() {
  const router = useRouter()
  const [problem, setProblem] = useState<Problem | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return // the link can only be used once
    started.current = true
    const link = readLink()
    ;(async (): Promise<Problem | null> => {
      if (link.accessToken && link.refreshToken) {
        const { error } = await createClient().auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
        if (error) return "expired"
        router.replace("/auth/update-password")
        return null
      }
      // A link from before this page existed: the server exchanges its code
      if (link.code) {
        window.location.replace(`/auth/callback?code=${encodeURIComponent(link.code)}&next=/auth/update-password`)
        return null
      }
      return link.expired ? "expired" : "failed"
    })().then((p) => { if (p) setProblem(p) }, () => setProblem("failed"))
  }, [router])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <Image src="/sorsu-seal.png" alt="Sorsogon State University seal" width={56} height={56} className="mx-auto rounded-full ring-1 ring-border" />
        {!problem ? (
          <p role="status" className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />Opening your reset link…
          </p>
        ) : (
          <>
            <div className="mx-auto mt-8 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-7" aria-hidden />
            </div>
            <h1 className="mt-6 font-serif text-2xl font-semibold tracking-tight">
              {problem === "expired" ? "This reset link has expired" : "This reset link didn't work"}
            </h1>
            <p className="mt-3 text-pretty text-sm text-muted-foreground">
              {problem === "expired"
                ? "Reset links work once and only for a short time. Send yourself a new one."
                : "Open the newest reset email, or send yourself a new link."}
            </p>
            <Button asChild size="lg" className="mt-6 w-full"><Link href="/auth/forgot-password">Send a new link</Link></Button>
            <Link href="/auth/login" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">Back to sign in</Link>
          </>
        )}
      </div>
    </main>
  )
}
