"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * "Forgot password?" from the login page: emails a reset link. The link signs the person in
 * through /auth/callback and opens /auth/update-password to choose a new password.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    const { error: err } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    })
    setBusy(false)
    // Same message whether or not the email has an account, so it can't be used to look up accounts
    if (err && /rate|too many/i.test(err.message)) setError("Too many requests. Please wait a minute and try again.")
    else setSent(true)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <Image src="/sorsu-seal.png" alt="Sorsogon State University seal" width={56} height={56} className="mx-auto rounded-full ring-1 ring-border" />
        {sent ? (
          <div className="mt-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <MailCheck className="size-7" aria-hidden />
            </div>
            <h1 className="mt-6 font-serif text-2xl font-semibold tracking-tight">Check your email</h1>
            <p className="mt-3 text-pretty text-sm text-muted-foreground">
              If an account uses <span className="font-medium text-foreground">{email.trim()}</span>, we sent a link to reset its password. The link works once and expires soon.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-8 text-center font-serif text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">Enter your account email and we&apos;ll send you a reset link.</p>
            <form onSubmit={submit} className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@sorsu.edu.ph" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
              <Button type="submit" size="lg" disabled={busy || !email.trim()}>
                {busy && <Loader2 className="size-4 animate-spin" />}Send reset link
              </Button>
            </form>
          </>
        )}
        <Link href="/auth/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />Back to sign in
        </Link>
      </div>
    </main>
  )
}
