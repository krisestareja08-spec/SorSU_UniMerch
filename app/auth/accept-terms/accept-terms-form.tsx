"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { resetTheme } from "@/lib/theme"
import { termsAcceptance } from "@/lib/legal"

export function AcceptTermsForm({ next }: { next: string }) {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    if (!agreed) return
    setBusy("accept")
    setError(null)
    const { error: err } = await createClient().auth.updateUser({ data: termsAcceptance() })
    if (err) { setError(err.message); setBusy(null); return }
    router.replace(next)
    router.refresh()
  }

  // Declining signs them out: the account can't be used without agreeing
  async function decline() {
    setBusy("decline")
    await createClient().auth.signOut()
    resetTheme()
    router.replace("/auth/login")
    router.refresh()
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/terms" target="_blank" className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm font-medium hover:border-primary/40 hover:bg-muted/40">
          <FileText className="size-4 text-primary" />Terms and Conditions
        </Link>
        <Link href="/privacy" target="_blank" className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm font-medium hover:border-primary/40 hover:bg-muted/40">
          <ShieldCheck className="size-4 text-primary" />Privacy Policy
        </Link>
      </div>
      <label className="mt-4 flex items-start gap-2.5 text-sm text-muted-foreground">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 shrink-0 rounded accent-primary" />
        <span>I have read and agree to the Terms and Conditions and Privacy Policy.</span>
      </label>
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
      <Button className="mt-4 w-full" size="lg" disabled={!agreed || busy !== null} onClick={accept}>
        {busy === "accept" && <Loader2 className="size-4 animate-spin" />}Agree and continue
      </Button>
      <Button variant="ghost" className="mt-2 w-full text-muted-foreground" disabled={busy !== null} onClick={decline}>
        {busy === "decline" && <Loader2 className="size-4 animate-spin" />}Decline and sign out
      </Button>
    </div>
  )
}
