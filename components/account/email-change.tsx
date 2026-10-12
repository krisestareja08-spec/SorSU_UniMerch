"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Mail, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { changeLoginEmail } from "@/app/email-actions"
import { unwrap } from "@/lib/action-result"
import { cn } from "@/lib/utils"

/**
 * "Login email" with an Edit form. `instant`: store accounts (Seller, Supply Office and branches)
 * change it right away; everyone else confirms from the new address first.
 */
export function EmailChange({ currentEmail, instant, googleSignIn = false }: { currentEmail: string; instant: boolean; googleSignIn?: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.set("email", email)
      const result = unwrap(await changeLoginEmail(fd))
      if (result.mode === "instant") {
        // New token so the app shows the new email everywhere straight away
        await createClient().auth.refreshSession()
        setMsg({ ok: true, text: `Your login email is now ${result.email}. Use it the next time you sign in.` })
        router.refresh()
      } else {
        setMsg({ ok: true, text: `We sent a confirmation link to ${result.email}. Your login email changes once you click it.` })
      }
      setEditing(false)
      setEmail("")
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't change the email." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Login email</p>
          <p className="flex items-center gap-1.5 break-all text-sm font-medium"><Mail className="size-4 shrink-0 text-primary" />{currentEmail || "No email"}</p>
        </div>
        {!editing && (
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditing(true); setMsg(null) }}>
            <Pencil className="size-3.5" />Edit login email
          </Button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-email">New login email</Label>
            <Input id="new-email" type="email" inputMode="email" autoComplete="email" required placeholder="you@sorsu.edu.ph"
              value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            <p className="text-xs text-muted-foreground">
              {instant
                ? "Changes right away — you'll sign in with the new email from now on."
                : "We'll send a confirmation link to the new address. The change takes effect once you click it."}
              {googleSignIn && " You sign in with Google: afterwards, sign in with the new email and your password, or with a Google account that uses the new email."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(false); setEmail(""); setMsg(null) }} disabled={busy}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy || !email.trim()} className="gap-1.5">
              {busy && <Loader2 className="size-3.5 animate-spin" />}{instant ? "Change email" : "Send confirmation link"}
            </Button>
          </div>
        </form>
      )}

      {msg && <p className={cn("text-xs", msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
    </div>
  )
}
