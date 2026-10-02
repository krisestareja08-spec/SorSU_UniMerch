"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ManagementShell } from "@/components/management/management-shell"
import type { DashboardCtx } from "@/lib/modules"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Loader2, ShieldCheck, User } from "lucide-react"
import type { UserRole } from "@/lib/roles"

type Account = { role: UserRole; full_name: string | null; email: string; department: string | null; contact: string | null }

export function SellerSettingsPage({ ctx }: { ctx: DashboardCtx }) {
  const router = useRouter()
  const [account, setAccount] = useState<Account | null>(null)
  const [form, setForm] = useState({ full_name: "", department: "", contact: "" })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [pwMsg, setPwMsg] = useState("")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/auth/login"); return }
      const { data } = await supabase.from("profiles").select("role, full_name, department, contact").eq("id", user.id).maybeSingle()
      const acc: Account = { role: (data?.role as UserRole) ?? "seller", full_name: data?.full_name ?? null, email: user.email ?? "", department: data?.department ?? null, contact: data?.contact ?? null }
      setAccount(acc)
      setForm({ full_name: acc.full_name ?? "", department: acc.department ?? "", contact: acc.contact ?? "" })
    })
  }, [router])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from("profiles").update({ full_name: form.full_name, department: form.department, contact: form.contact }).eq("id", user.id)
    setAccount((a) => a ? { ...a, ...form } : a)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handlePasswordUpdate() {
    if (newPassword.length < 8) { setPwMsg("Password must be at least 8 characters."); return }
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwMsg(error ? error.message : "Password updated successfully.")
    if (!error) setNewPassword("")
  }

  if (!account) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Account Settings" description="Update your shop contact details and password." />
      <div className="mt-6 max-w-xl space-y-5">
        <Card className="border-primary/10">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-serif text-base"><User className="size-4 text-primary" />Contact Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1.5"><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
            <div className="flex flex-col gap-1.5"><Label>Department / Organisation</Label><Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} /></div>
            <div className="flex flex-col gap-1.5"><Label>Contact Number</Label><Input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} /></div>
            <Button disabled={saving} onClick={handleSave} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
              {saved ? "Saved" : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-serif text-base"><ShieldCheck className="size-4 text-gold" />Change Password</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-1.5"><Label>New Password</Label><Input type="password" placeholder="At least 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            {pwMsg && <p className={pwMsg.includes("success") ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{pwMsg}</p>}
            <Button onClick={handlePasswordUpdate} variant="outline">Update Password</Button>
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}

