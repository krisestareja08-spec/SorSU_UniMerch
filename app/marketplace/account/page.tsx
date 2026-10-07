"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { AlertTriangle, Lock, PackageSearch, Settings, LogOut, ChevronRight, Edit2, Check, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { resetTheme } from "@/lib/theme"
import { PHONE_OTP_ENABLED } from "@/lib/features"
import { VerifiedBadge } from "@/components/verified-badge"
import { PhoneVerification } from "@/components/account/phone-verification"
import { Bone, LoadingRegion } from "@/components/skeletons"
import { CAMPUS_LABELS, type Campus } from "@/lib/roles"
import { STRICT_FIELD_LABELS, validateFullName } from "@/lib/profile-rules"
import { saveMyProfile } from "./actions"
import { PenaltyCharges } from "@/components/account/penalty-charges"

type Profile = { full_name: string; affiliation: string; student_employee_id: string; course: string; department: string; campus: string; contact: string; birthday: string; email: string; avatar_url: string | null; account_status: string }
type EditableKey = "full_name" | "student_employee_id" | "course" | "department" | "campus" | "birthday"
type VerifyInfo = { verified: boolean; status: string | null; reason: string | null }

export default function AccountPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Profile>>({})
  const [verify, setVerify] = useState<VerifyInfo>({ verified: false, status: null, reason: null })
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [confirmFields, setConfirmFields] = useState<string[] | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/auth/login"); return }
      const { data } = await supabase.from("profiles").select("full_name, affiliation, student_employee_id, course, department, contact, birthday, avatar_url, is_identity_verified, campus, account_status").eq("id", user.id).maybeSingle()
      // Details typed at sign-up live in auth metadata until the profile is saved once.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>
      const str = (v: unknown) => (typeof v === "string" ? v : "")
      const { data: vr } = await supabase.from("verification_requests").select("status, review_reason").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
      setVerify({ verified: !!data?.is_identity_verified, status: vr?.status ?? null, reason: vr?.review_reason ?? null })
      setProfile({
        full_name: data?.full_name || str(meta.full_name),
        affiliation: data?.affiliation ?? "external",
        student_employee_id: data?.student_employee_id || str(meta.student_employee_id) || str(meta.student_or_employee_id),
        course: data?.course || str(meta.course),
        department: data?.department || str(meta.department),
        campus: data?.campus || str(meta.campus),
        contact: data?.contact ?? "",
        birthday: data?.birthday ?? "",
        email: user.email ?? "",
        avatar_url: data?.avatar_url ?? null,
        account_status: data?.account_status ?? "active",
      })
    })
  }, [router])

  async function handleSave(confirmReverification = false) {
    if (!profile) return
    setSaveError(null)
    setSaveNotice(null)
    const nameError = validateFullName(form.full_name)
    if (nameError) { setSaveError(nameError); return }
    setSaving(true)
    const result = await saveMyProfile({
      full_name: form.full_name ?? "",
      student_employee_id: form.student_employee_id ?? "",
      course: form.course ?? "",
      department: form.department ?? "",
      campus: form.campus ?? "",
      contact: form.contact ?? "",
      birthday: form.birthday ?? "",
    }, confirmReverification)
    setSaving(false)
    if (!result.ok) {
      if ("needsConfirmation" in result) { setConfirmFields(result.fields); return }
      setSaveError(result.error)
      return
    }
    setConfirmFields(null)
    setProfile((p) => ({ ...p!, ...(form as Partial<Profile>) }))
    if (result.reverification) {
      setVerify({ verified: false, status: "pending", reason: null })
      setSaveNotice("Saved. Your verified status was removed and a re-verification request was sent to the Verification Admin.")
    } else {
      setSaveNotice("Profile saved.")
    }
    setEditing(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    resetTheme()
    router.push("/auth/login")
    router.refresh()
  }

  const initials = (profile?.full_name ?? "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

  if (!profile) {
    return (
      <LoadingRegion label="Loading your account" className="mx-auto max-w-2xl space-y-3 px-4 py-6 sm:px-6">
        <Bone className="h-28 w-full rounded-2xl" />
        <Bone className="h-56 w-full rounded-xl" />
        <Bone className="h-16 w-full rounded-xl" />
        <Bone className="h-16 w-full rounded-xl" />
      </LoadingRegion>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      {/* Profile header */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl bg-linear-to-br from-primary to-primary/80 px-5 py-6 shadow-md">
        <div className="relative flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-xl font-bold text-primary-foreground ring-2 ring-gold/40">
          {profile?.avatar_url ? <Image src={profile.avatar_url} alt="" fill className="rounded-full object-cover" /> : initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-lg font-semibold text-primary-foreground">{profile?.full_name || "Loading…"}</p>
          <VerifiedBadge verified={verify.verified} affiliation={profile?.affiliation} className="mt-1" />
          {profile?.department && <p className="mt-1 text-sm text-primary-foreground/70">{profile.department}</p>}
          <p className="mt-0.5 text-xs text-gold/80">{profile?.email}</p>
        </div>
        <button onClick={() => { setForm(profile ?? {}); setEditing(true); setSaveNotice(null) }} className="shrink-0 rounded-lg p-2 text-primary-foreground/70 hover:bg-primary-foreground/10">
          <Edit2 className="size-4" />
        </button>
      </div>

      {editing ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-serif text-base font-semibold">Edit Profile</h2>
            {verify.verified ? (
              <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  <strong>You are verified.</strong> Changing your full name, I.D. number, course or department removes your verified
                  status and sends your profile back to the Verification Admin for re-verification. Restricted items stay locked until you are approved again.
                </p>
              </div>
            ) : (
              <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                Use your real, complete name. Dummy or fake accounts can be reported by sellers and banned by the Verification Admin.
              </p>
            )}
            {saveError && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{saveError}</p>}
            {([
              { label: "Full name", key: "full_name", placeholder: "First and last name, as on your I.D." },
              { label: "Student / Employee I.D. number", key: "student_employee_id", placeholder: "e.g. 20210123" },
              { label: "Course / program", key: "course", placeholder: "e.g. BS Information Technology" },
              { label: "Department / college", key: "department", placeholder: "e.g. CICT" },
            ] as { label: string; key: EditableKey; placeholder: string }[]).map(({ label, key, placeholder }) => {
              const strict = key in STRICT_FIELD_LABELS
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label htmlFor={key} className="flex items-center gap-1.5">
                    {label}
                    {strict && verify.verified && <span className="inline-flex items-center gap-0.5 text-[10px] font-normal text-amber-700 dark:text-amber-300"><Lock className="size-3" />re-verification required</span>}
                  </Label>
                  <Input id={key} placeholder={placeholder} value={form[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                </div>
              )
            })}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campus">Campus</Label>
              <select id="campus" value={form.campus ?? ""} onChange={(e) => setForm((f) => ({ ...f, campus: e.target.value }))}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">Select campus</option>
                {Object.entries(CAMPUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">Contact number</p>
              {PHONE_OTP_ENABLED && <p className="text-xs text-muted-foreground">Changing your number requires a code sent to it by SMS.</p>}
              <PhoneVerification compact onVerified={(contact) => { setProfile((p) => (p ? { ...p, contact } : p)); setForm((f) => ({ ...f, contact })) }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="birthday">Birthday</Label>
              <Input id="birthday" type="date" value={form.birthday ?? ""} onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setEditing(false); setSaveError(null) }}>Cancel</Button>
              <Button disabled={saving} className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => handleSave(false)}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {saveNotice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">{saveNotice}</p>}
            {profile && profile.account_status !== "active" && <AccountStatusNotice status={profile.account_status} />}
            {profile && <PersonalInfoCard profile={profile} verified={verify.verified} onEdit={() => { setForm(profile); setEditing(true); setSaveNotice(null) }} />}
            <PenaltyCharges />
            {[
              { label: "My Orders", icon: PackageSearch, href: "/marketplace/orders", desc: "Track and review past orders" },
              { label: "Settings", icon: Settings, href: "/marketplace/settings", desc: "Account & security, verification, notifications and appearance" },
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
      )}

      {confirmFields && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmFields(null)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="reverify-title" className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="reverify-title" className="flex items-center gap-2 font-serif text-lg font-semibold"><AlertTriangle className="size-5 text-amber-600" />Re-verification required</h2>
            <p className="mt-2 text-sm text-muted-foreground">You changed: <strong className="text-foreground">{confirmFields.join(", ")}</strong>.</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Your <strong>verified badge will be removed</strong> right away.</li>
              <li>Restricted items stay locked until the Verification Admin approves you again.</li>
              <li>Your uploaded I.D. / COR will be sent with the request; the admin may ask you to resubmit.</li>
            </ul>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmFields(null)}>Keep my details</Button>
              <Button disabled={saving} className="flex-1 gap-2 bg-amber-600 text-white hover:bg-amber-700" onClick={() => handleSave(true)}>
                {saving && <Loader2 className="size-4 animate-spin" />}Save &amp; re-verify
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PersonalInfoCard({ profile, verified, onEdit }: { profile: Profile; verified: boolean; onEdit: () => void }) {
  const rows: [string, string, boolean][] = [
    ["Full name", profile.full_name, true],
    ["I.D. number", profile.student_employee_id, true],
    ["Course / program", profile.course, true],
    ["Department / college", profile.department, true],
    ["Campus", CAMPUS_LABELS[profile.campus as Campus] ?? profile.campus, false],
    ["Contact number", profile.contact, false],
    ["Birthday", profile.birthday, false],
    ["Email", profile.email, false],
  ]
  const missing = rows.filter(([label, value]) => !value && label !== "Birthday").length
  return (
    <div className="rounded-xl border border-primary/10 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Personal information</p>
        <button onClick={onEdit} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Edit2 className="size-3.5" />Edit</button>
      </div>
      {missing > 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Complete your profile — sellers see these details on your orders.</p>}
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([label, value, strict]) => (
          <div key={label}>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">{label}{strict && verified && <Lock className="size-3" aria-label="Changing this requires re-verification" />}</dt>
            <dd className={cn("font-medium", value ? "text-foreground" : "text-amber-700 dark:text-amber-300")}>{value || "Not set"}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function AccountStatusNotice({ status }: { status: string }) {
  const text: Record<string, string> = {
    flagged: "Your account was flagged for review by a seller report. Make sure your profile uses your real details.",
    suspended: "Your account is suspended. You can't place orders. Contact the Verification Admin.",
    banned: "Your account is banned for violating marketplace rules (e.g. a dummy account).",
  }
  return (
    <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />{text[status] ?? `Account status: ${status}`}
    </div>
  )
}
