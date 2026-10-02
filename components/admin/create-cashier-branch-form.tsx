"use client"

import { useState, useTransition } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createCashierBranch } from "@/app/admin/cashiers/actions"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"
import { CASHIER_SCOPE_LABELS, cashierBranchName, type CashierScope } from "@/lib/cashier-branches"

/** Verification Admin: create a Cashier branch for a campus (whole campus, one department, or centralized). */
export function CreateCashierBranchForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [campus, setCampus] = useState<Campus | "">("")
  const [scope, setScope] = useState<CashierScope>("campus")
  const [department, setDepartment] = useState("")
  const [adminMode, setAdminMode] = useState<"existing" | "new">("existing")

  const preview = campus ? cashierBranchName(campus, scope, department || "…") : null

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setDone(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    if (!campus) { setError("Choose the campus — every cashier branch needs its campus identity."); return }
    fd.set("campus", campus)
    fd.set("scope", scope)
    fd.set("admin_mode", adminMode)
    startTransition(async () => {
      try {
        await createCashierBranch(fd)
        setDone(`${preview} created. Its Main Admin can now open the Cashier dashboard.`)
        form.reset()
        setCampus("")
        setScope("campus")
        setDepartment("")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {done && <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="size-4" />{done}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="campus">Campus *</Label>
          <select id="campus" value={campus} onChange={(e) => setCampus(e.target.value as Campus)} required
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
            <option value="">Select campus</option>
            {Object.entries(CAMPUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scope">Serves *</Label>
          <select id="scope" value={scope} onChange={(e) => setScope(e.target.value as CashierScope)}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
            {Object.entries(CASHIER_SCOPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      {scope === "department" && (
        <div className="space-y-1.5">
          <Label htmlFor="department">Department *</Label>
          <Input id="department" name="department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. CICT" required />
        </div>
      )}
      {preview && <p className="text-sm text-muted-foreground">Branch name: <strong className="text-foreground">{preview}</strong></p>}

      <div className="space-y-1.5">
        <Label>Main Admin of this branch *</Label>
        <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {([["existing", "Existing user"], ["new", "Create new login"]] as const).map(([m, l]) => (
            <button key={m} type="button" onClick={() => setAdminMode(m)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${adminMode === m ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>
      {adminMode === "new" && (
        <div className="space-y-1.5">
          <Label htmlFor="admin_name">Full name *</Label>
          <Input id="admin_name" name="admin_name" placeholder="e.g. Ana Reyes" required />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">{adminMode === "existing" ? "Account email *" : "Login email *"}</Label>
        <Input id="email" name="email" type="email" placeholder="name@sorsu.edu.ph" required />
      </div>
      {adminMode === "new" && (
        <div className="space-y-1.5">
          <Label htmlFor="password">Temporary password *</Label>
          <Input id="password" name="password" type="password" minLength={8} placeholder="Minimum 8 characters" required />
        </div>
      )}

      <Button type="submit" disabled={pending} className="gap-2">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Create cashier branch
      </Button>
    </form>
  )
}
