"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function PasswordChange() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setMsg({ ok: false, text: "Password must be at least 8 characters." }); return }
    if (password !== confirm) { setMsg({ ok: false, text: "The passwords don't match." }); return }
    setBusy(true)
    const { error } = await createClient().auth.updateUser({ password })
    setBusy(false)
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Password updated." })
    if (!error) { setPassword(""); setConfirm("") }
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
