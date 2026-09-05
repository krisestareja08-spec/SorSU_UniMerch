"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { User, PackageSearch, Settings, LogOut, ChevronRight, Edit2, Check, Loader2, Camera } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Profile = { full_name: string; affiliation: string; student_employee_id: string; department: string; contact: string; birthday: string; email: string; avatar_url: string | null }

export default function AccountPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Profile>>({})
  const [tab, setTab] = useState<"profile" | "security">("profile")
  const [newPassword, setNewPassword] = useState("")
  const [pwMsg, setPwMsg] = useState("")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/auth/login"); return }
      const { data } = await supabase.from("profiles").select("full_name, affiliation, student_employee_id, department, contact, birthday, avatar_url").eq("id", user.id).maybeSingle()
      setProfile({ full_name: data?.full_name ?? "", affiliation: data?.affiliation ?? "student", student_employee_id: data?.student_employee_id ?? "", department: data?.department ?? "", contact: data?.contact ?? "", birthday: data?.birthday ?? "", email: user.email ?? "", avatar_url: data?.avatar_url ?? null })
    })
  }, [router])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from("profiles").update({ full_name: form.full_name, department: form.department, contact: form.contact, birthday: form.birthday || null, student_employee_id: form.student_employee_id }).eq("id", user.id)
    setProfile((p) => ({ ...p!, ...form }))
    setEditing(false)
    setSaving(false)
  }

  async function handlePasswordUpdate() {
    if (newPassword.length < 8) { setPwMsg("Password must be at least 8 characters."); return }
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwMsg(error ? error.message : "Password updated successfully.")
    if (!error) setNewPassword("")
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const initials = (profile?.full_name ?? "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      {/* Profile header */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl bg-linear-to-br from-primary to-primary/80 px-5 py-6 shadow-md">
        <div className="relative flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-xl font-bold text-primary-foreground ring-2 ring-gold/40">
          {profile?.avatar_url ? <Image src={profile.avatar_url} alt="" fill className="rounded-full object-cover" /> : initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-lg font-semibold text-primary-foreground">{profile?.full_name || "Loading…"}</p>
          <p className="text-sm text-primary-foreground/70 capitalize">{profile?.affiliation} {profile?.department ? `· ${profile.department}` : ""}</p>
          <p className="mt-0.5 text-xs text-gold/80">{profile?.email}</p>
        </div>
        <button onClick={() => { setForm(profile ?? {}); setEditing(true) }} className="shrink-0 rounded-lg p-2 text-primary-foreground/70 hover:bg-primary-foreground/10">
          <Edit2 className="size-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {(["profile", "security"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors", tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t === "profile" ? "Profile" : "Account & Security"}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        editing ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-serif text-base font-semibold">Edit Profile</h2>
            {[
              { label: "Full Name", key: "full_name" as const },
              { label: "Department / College", key: "department" as const },
              { label: "Contact Number", key: "contact" as const },
              { label: "Student / Employee ID (8 digits)", key: "student_employee_id" as const },
            ].map(({ label, key }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input id={key} value={form[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="birthday">Birthday</Label>
              <Input id="birthday" type="date" value={form.birthday ?? ""} onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
              <Button disabled={saving} className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {[
              { label: "My Orders", icon: PackageSearch, href: "/marketplace/orders", desc: "Track and review past orders" },
              { label: "Settings", icon: Settings, href: "/marketplace/settings", desc: "Preferences and notifications" },
            ].map(({ label, icon: Icon, href, desc }) => (
              <Link key={label} href={href} className="flex items-center gap-4 rounded-xl border border-primary/10 bg-card p-4 shadow-sm transition-all hover:border-primary/25 hover:bg-muted/40 hover:shadow-md active:scale-[0.99]">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8"><Icon className="size-4 text-primary" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
              </Link>
            ))}
            <button onClick={handleSignOut} className="flex w-full items-center gap-4 rounded-xl border border-destructive/20 bg-card p-4 shadow-sm transition-all hover:border-destructive/40 hover:bg-destructive/5 hover:shadow-md active:scale-[0.99]">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10"><LogOut className="size-4 text-destructive" /></div>
              <div className="flex-1 min-w-0 text-left"><p className="text-sm font-medium text-destructive">Sign Out</p><p className="text-xs text-muted-foreground">Sign out of your account</p></div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
            </button>
          </div>
        )
      ) : (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-serif text-base font-semibold">Change Password</h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-pw">New Password</Label>
            <Input id="new-pw" type="password" placeholder="At least 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          {pwMsg && <p className={cn("text-xs", pwMsg.includes("success") ? "text-emerald-600" : "text-destructive")}>{pwMsg}</p>}
          <Button onClick={handlePasswordUpdate} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">Update Password</Button>
        </div>
      )}
    </div>
  )
}

const NAV_ITEMS_STUB = [] // removed stub
