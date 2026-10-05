import Link from "next/link"
import { redirect } from "next/navigation"
import { BadgeCheck, Bell, ChevronRight, Clock, KeyRound, Mail, Moon, Phone, ShieldCheck, UserRound } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ThemeSwitch } from "@/components/theme-select"
import { NotificationPreferences } from "@/components/notifications/notification-preferences"
import { BrowserAlertsToggle } from "@/components/notifications/browser-alerts-toggle"
import { PhoneVerification } from "@/components/account/phone-verification"
import { PasswordChange } from "@/components/account/password-change"
import { createClient } from "@/lib/supabase/server"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"
import { PHONE_OTP_ENABLED } from "@/lib/features"

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-base"><Icon className="size-4 text-primary" /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">{children}</CardContent>
    </Card>
  )
}

function Row({ icon: Icon, label, desc, children }: { icon?: React.ElementType; label: string; desc?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8"><Icon className="size-4 text-primary" /></div>}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ data: profile }, { data: request }] = await Promise.all([
    supabase.from("profiles").select("affiliation, is_identity_verified").eq("id", user.id).maybeSingle(),
    supabase.from("verification_requests").select("status, review_reason").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ])
  const verified = !!profile?.is_identity_verified
  const pending = request?.status === "pending" || request?.status === "under_review"
  const redo = request?.status === "rejected" || request?.status === "needs_resubmission"
  const affiliation = AFFILIATION_LABELS[(profile?.affiliation ?? "external") as Affiliation] ?? "Guest"
  const signInMethod = (user.app_metadata?.providers as string[] | undefined)?.includes("google") ? "Google" : "Email & password"

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Account security, verification, notifications and appearance.</p>
        <div className="mt-3 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
      </div>

      <nav aria-label="Settings sections" className="mb-4 flex gap-2 overflow-x-auto pb-1 text-xs">
        {[["#security", "Account & Security"], ["#verification", "Verification"], ["#notifications", "Notifications"], ["#appearance", "Appearance"]].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-full border border-border bg-card px-3 py-1 font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground">{label}</a>
        ))}
      </nav>

      <div className="space-y-4">
        <Section id="security" title="Account & Security" icon={KeyRound}>
          <Row icon={Mail} label={user.email ?? "No email"} desc={`Sign-in: ${signInMethod}`} />
          <div className="py-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Phone className="size-4 text-primary" />Phone number</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Sellers use it to reach you about orders.{PHONE_OTP_ENABLED ? " Adding or changing it requires a 6-digit code sent by SMS." : ""}
            </p>
            <PhoneVerification />
          </div>
          <div className="py-3">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium"><KeyRound className="size-4 text-primary" />Change password</p>
            <PasswordChange />
          </div>
          <Row icon={UserRound} label="Profile details" desc="Name, I.D. number, course, campus">
            <Link href="/marketplace/account" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Edit profile<ChevronRight className="size-3.5" /></Link>
          </Row>
        </Section>

        <Section id="verification" title="Verification" icon={ShieldCheck}>
          <Row
            icon={verified ? BadgeCheck : pending ? Clock : ShieldCheck}
            label={verified ? `Verified ${affiliation}` : pending ? "Verification under review" : redo ? "Verification not approved" : "Not verified"}
            desc={verified
              ? "Your affiliation is confirmed. Restricted items for your role are unlocked."
              : pending ? "The Verification Admin is reviewing your documents."
              : redo ? (request?.review_reason ? `Reviewer note: ${request.review_reason}` : "You can reapply with updated documents.")
              : "Students: upload your I.D. and COR. Faculty & staff: upload your I.D. to unlock restricted items."}
          >
            {!verified && !pending && (
              <Button asChild size="sm"><Link href="/verify">{redo ? "Reapply" : "Apply for verification"}</Link></Button>
            )}
          </Row>
        </Section>

        <Section id="notifications" title="Notifications" icon={Bell}>
          <NotificationPreferences />
          <BrowserAlertsToggle />
          <Row label="Notification inbox" desc="Every order, message and account alert">
            <Link href="/marketplace/notifications" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Open<ChevronRight className="size-3.5" /></Link>
          </Row>
        </Section>

        <Section id="appearance" title="Appearance" icon={Moon}>
          <Row label="Dark mode" desc="UniMerch opens in light mode each time you sign in. Turn this on to switch to dark.">
            <ThemeSwitch />
          </Row>
        </Section>
      </div>
    </div>
  )
}
