"use client"

import Image from "@/components/ui/smart-image"
import Link from "next/link"
import { use, useState } from "react"
import { AlertTriangle, ArrowLeft, Loader2, MailCheck } from "lucide-react"
import { createEmailLinkClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** Why sending failed, in words people can act on */
function sendError(message: string) {
  if (/rate|too many|security purposes/i.test(message)) return "Too many reset emails were asked for. Please wait a few minutes and try again."
  if (/invalid.*email|email.*invalid/i.test(message)) return "That doesn't look like an email address."
  return "The reset email couldn't be sent right now. Please try again in a few minutes."
}

/**
 * "Forgot password?" from the login page: emails a reset link. The link opens /auth/reset, which
 * signs the person in and opens /auth/update-password to choose a new password. ?expired=1: they
 * came back from a link that no longer works.
 */
export default function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const expired = use(searchParams).expired === "1"
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    const { error: err } = await createEmailLinkClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    setBusy(false)
    // Supabase answers the same whether or not the email has an account, so errors are safe to show
    if (err) setError(sendError(err.message))
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
              If an account uses <span className="font-medium text-foreground">{email.trim()}</span>, we sent it a link to reset the password.
              It works once and expires in an hour.
            </p>
            <p className="mt-3 text-pretty text-xs text-muted-foreground">Not there after a few minutes? Check your spam folder.</p>
            <button type="button" onClick={() => setSent(false)} className="mt-4 text-sm font-medium text-primary hover:underline">Use a different email</button>
          </div>
        ) : (
          <>
            <h1 className="mt-8 text-center font-serif text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">Enter your account email and we&apos;ll send you a reset link.</p>
            {expired && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />That reset link has expired or was already used. Send yourself a new one.
              </p>
            )}
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
