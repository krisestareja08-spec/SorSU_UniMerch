"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

/**
 * New password + confirmation. Saving signs the account out everywhere else (a changed password
 * usually means the old one shouldn't work anywhere). afterSave: where to go once it's saved.
 */
export function PasswordChange({ afterSave }: { afterSave?: string }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setMsg({ ok: false, text: "Password must be at least 8 characters." }); return }
    if (password !== confirm) { setMsg({ ok: false, text: "The passwords don't match." }); return }
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) await supabase.auth.signOut({ scope: "others" }).catch(() => {})
    setBusy(false)
    if (error) {
      setMsg({ ok: false, text: /different from the old|same password/i.test(error.message) ? "Choose a password you haven't used before." : error.message })
      return
    }
    setPassword(""); setConfirm("")
    if (afterSave) {
      toast({ title: "Password updated", variant: "success" })
      router.replace(afterSave)
      router.refresh()
    } else setMsg({ ok: true, text: "Password updated. Other devices were signed out." })
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-pw">New password</Label>
          <Input id="new-pw" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-pw">Confirm password</Label>
          <Input id="confirm-pw" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
      </div>
      {msg && <p className={cn("text-xs", msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <Button type="submit" size="sm" disabled={busy || !password}>
        {busy && <Loader2 className="size-4 animate-spin" />}Update password
      </Button>
    </form>
  )
}
