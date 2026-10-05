"use client"

import { useEffect, useState } from "react"
import { BadgeCheck, Loader2, Phone, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { PHONE_OTP_ENABLED } from "@/lib/features"

const RESEND_SECONDS = 60

/** '09171234567' / '+63 917…' → '+639171234567', or null if it isn't a PH mobile number. */
function toE164(input: string) {
  const d = input.replace(/\D/g, "")
  const local = d.startsWith("63") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d
  return /^9\d{9}$/.test(local) ? `+63${local}` : null
}

/** '+639171234567' → '09171234567' (how numbers are shown and stored on profiles) */
function toLocal(e164: string) {
  return `0${e164.replace(/\D/g, "").slice(2)}`
}

function friendlyError(message: string) {
  const m = message.toLowerCase()
  if (m.includes("provider") || (m.includes("sms") && m.includes("disabled")) || m.includes("phone signups are disabled"))
    return "SMS verification isn't set up yet. An admin must enable Phone sign-in and an SMS provider in Supabase."
  if (m.includes("already") && (m.includes("registered") || m.includes("exists"))) return "This number is already linked to another account."
  if (m.includes("expired") || m.includes("invalid")) return "That code is wrong or has expired. Request a new one."
  if (m.includes("rate") || m.includes("too many") || m.includes("seconds")) return "Too many attempts. Wait a minute and try again."
  return message
}

/**
 * Add or change the account's phone number. With PHONE_OTP_ENABLED, Supabase Auth texts a 6-digit
 * code to the new number and profiles.contact is updated only after it's confirmed
 * (scripts/25_phone_verification.sql enforces this). While it's off, the number saves directly.
 */
export function PhoneVerification({ onVerified, compact = false }: { onVerified?: (contact: string) => void; compact?: boolean }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [current, setCurrent] = useState<{ contact: string; verified: boolean } | null>(null)
  const [editing, setEditing] = useState(false)
  const [number, setNumber] = useState("")
  const [pending, setPending] = useState<string | null>(null) // E.164 number a code was sent to
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from("profiles").select("contact, contact_verified").eq("id", user.id).maybeSingle()
      // contact_verified arrives with scripts/25; before that, compare with the confirmed auth phone
      const contact = (data?.contact as string | null) ?? ""
      const authPhone = user.phone_confirmed_at && user.phone ? toLocal(user.phone) : null
      setCurrent({ contact, verified: Boolean((data as { contact_verified?: boolean } | null)?.contact_verified) || (!!contact && contact === authPhone) })
    })
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendCode(e?: React.FormEvent, resendTo?: string) {
    e?.preventDefault()
    setError(null)
    setNotice(null)
    const phone = resendTo ?? toE164(number)
    if (!phone) { setError("Enter a valid Philippine mobile number, e.g. 0917 123 4567."); return }
    if (toLocal(phone) === current?.contact) { setError("That's already your number."); return }
    setBusy(true)
    if (!PHONE_OTP_ENABLED) {
      // SMS codes are switched off for now (lib/features.ts): save the number directly
      await saveContact(toLocal(phone), "Phone number saved.")
      setBusy(false)
      return
    }
    const { error: err } = await createClient().auth.updateUser({ phone })
    setBusy(false)
    if (err) { setError(friendlyError(err.message)); return }
    setPending(phone)
    setCode("")
    setCooldown(RESEND_SECONDS)
    setNotice(`We texted a 6-digit code to ${toLocal(phone)}.`)
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    if (!pending || !userId) return
    setError(null)
    setBusy(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.verifyOtp({ phone: pending, token: code.trim(), type: "phone_change" })
    if (err) { setBusy(false); setError(friendlyError(err.message)); return }
    await saveContact(toLocal(pending), "Phone number verified and saved.")
    setBusy(false)
  }

  async function saveContact(contact: string, message: string) {
    if (!userId) return
    const { error: saveErr } = await createClient().from("profiles").update({ contact }).eq("id", userId)
    if (saveErr) { setError(saveErr.message); return }
    setCurrent({ contact, verified: PHONE_OTP_ENABLED })
    setPending(null)
    setEditing(false)
    setNumber("")
    setNotice(message)
    onVerified?.(contact)
  }

  if (!current) return <div className="h-14 animate-pulse rounded-xl bg-muted" />

  return (
    <div className="space-y-3">
      {!editing && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {!compact && <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8"><Phone className="size-4 text-primary" /></div>}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{current.contact || "No phone number"}</p>
              {current.contact && (current.verified
                ? <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"><BadgeCheck className="size-3.5" />Verified by SMS</p>
                : PHONE_OTP_ENABLED
                  ? <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><ShieldAlert className="size-3.5" />Not verified</p>
                  : <p className="text-xs text-muted-foreground">SMS verification coming soon</p>)}
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(true); setError(null); setNotice(null); setNumber(current.verified ? "" : current.contact) }}>
            {!current.contact ? "Add number" : current.verified || !PHONE_OTP_ENABLED ? "Change number" : "Verify number"}
          </Button>
        </div>
      )}

      {editing && !pending && (
        <form onSubmit={sendCode} className="space-y-2">
          <label htmlFor="new-phone" className="text-xs font-medium text-muted-foreground">Mobile number</label>
          <div className="flex gap-2">
            <Input id="new-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="09XX XXX XXXX" value={number} onChange={(e) => setNumber(e.target.value)} />
            <Button type="submit" disabled={busy || !number.trim()} className="shrink-0">
              {busy ? <Loader2 className="size-4 animate-spin" /> : PHONE_OTP_ENABLED ? "Send code" : "Save"}
            </Button>
          </div>
          <button type="button" onClick={() => { setEditing(false); setError(null) }} className="text-xs text-muted-foreground hover:underline">Cancel</button>
        </form>
      )}

      {pending && (
        <form onSubmit={confirm} className="space-y-2">
          <label htmlFor="otp" className="text-xs font-medium text-muted-foreground">6-digit code sent to {toLocal(pending)}</label>
          <div className="flex gap-2">
            <Input id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="123456"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="tracking-[0.3em]" />
            <Button type="submit" disabled={busy || code.length !== 6} className="shrink-0">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Verify"}
            </Button>
          </div>
          <div className="flex gap-4 text-xs">
            <button type="button" disabled={cooldown > 0 || busy} onClick={() => sendCode(undefined, pending)}
              className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
            <button type="button" onClick={() => { setPending(null); setCode(""); setError(null); setNotice(null) }} className="text-muted-foreground hover:underline">Use a different number</button>
          </div>
        </form>
      )}

      {notice && <p className="text-xs text-emerald-700 dark:text-emerald-400" role="status">{notice}</p>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  )
}
