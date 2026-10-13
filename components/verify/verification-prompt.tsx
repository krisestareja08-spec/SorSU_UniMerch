"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, ShieldCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import type { VerificationState } from "@/components/verify/verification-nav"

const REMIND_AFTER_MS = 24 * 60 * 60 * 1000
const remindKey = (userId: string) => `unimerch-verify-remind-${userId}`
const lastStateKey = (userId: string) => `unimerch-verify-state-${userId}`

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} }

/**
 * For buyers who haven't applied for verification: a pop-up inviting them to apply ("Apply now" /
 * "Remind me later" — asked again after a day). When someone's verification is approved, a one-time
 * toast tells them restricted items are unlocked.
 */
export function VerificationPrompt({ userId, state }: { userId: string; state: VerificationState }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const applyRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Toast only when this browser saw them unverified before (not for people verified long ago)
    const last = read(lastStateKey(userId))
    write(lastStateKey(userId), state)
    if (state === "verified") {
      if (last && last !== "verified") toast({ title: "You're verified!", description: "Restricted items for your role are now unlocked." })
      return
    }
    if (state !== "none") return
    const until = Number(read(remindKey(userId)) ?? 0)
    if (Date.now() < until) return
    // A moment after the page appears, so it doesn't feel like it's blocking the page
    const t = setTimeout(() => setOpen(true), 900)
    return () => clearTimeout(t)
  }, [state, userId])

  useEffect(() => {
    if (!open) return
    applyRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") remindLater() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remindLater only uses stable values
  }, [open])

  function remindLater() {
    write(remindKey(userId), String(Date.now() + REMIND_AFTER_MS))
    setOpen(false)
    toast({ variant: "info", title: "We'll remind you tomorrow", description: "You can apply anytime from the menu — look for “Apply for verification”." })
  }

  function applyNow() {
    // Asked again later if they leave the form without applying
    write(remindKey(userId), String(Date.now() + REMIND_AFTER_MS))
    setOpen(false)
    router.push("/verify")
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-70 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in sm:items-center"
      onClick={remindLater}>
      <div role="dialog" aria-modal="true" aria-labelledby="verify-prompt-title" aria-describedby="verify-prompt-desc"
        className="relative w-full max-w-md rounded-2xl bg-card p-6 text-card-foreground shadow-2xl animate-in fade-in slide-in-from-bottom-4"
        onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={remindLater} aria-label="Close"
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gold/15">
          <ShieldCheck className="size-6 text-primary dark:text-gold" />
        </div>
        <h2 id="verify-prompt-title" className="mt-4 font-serif text-xl font-semibold">Verify your university identity</h2>
        <p id="verify-prompt-desc" className="mt-2 text-sm text-muted-foreground">
          Students, faculty and staff can unlock restricted items — like official uniforms — by verifying with their School ID (and COR for students).
          It only takes a few minutes.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm">
          {["Buy restricted, role-based items", "Show a Verified badge to sellers", "Reviewed by the Verification Admin"].map((t) => (
            <li key={t} className="flex items-center gap-2"><BadgeCheck className="size-4 shrink-0 text-emerald-600" />{t}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="sm:flex-1" onClick={remindLater}>Remind me later</Button>
          <Button ref={applyRef} type="button" className="sm:flex-1" onClick={applyNow}>Apply now</Button>
        </div>
      </div>
    </div>
  )
}
