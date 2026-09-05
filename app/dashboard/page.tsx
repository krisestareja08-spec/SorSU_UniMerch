import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AFFILIATION_LABELS, roleDashboard } from "@/lib/roles"
import { profileFromUser } from "@/lib/profile"
import { AppHeader } from "@/components/app-header"
import { VerificationStatusBadge } from "@/components/verification-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BadgeCheck, ShoppingBag, ShieldCheck, ArrowRight } from "lucide-react"
import type { Affiliation, UserRole, VerificationStatus } from "@/lib/roles"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, affiliation, verification_status, is_identity_verified")
    .eq("id", user.id)
    .maybeSingle()

  const resolved = error || !profile ? profileFromUser(user) : {
    full_name:            profile.full_name ?? null,
    role:                 (profile.role ?? "buyer") as UserRole,
    affiliation:          (profile.affiliation ?? "external") as Affiliation,
    verification_status:  (profile.verification_status ?? "unverified") as VerificationStatus,
    is_identity_verified: profile.is_identity_verified ?? false,
  }

  // Non-buyers go to their own dashboard
  if (resolved.role !== "buyer") redirect(roleDashboard(resolved.role))

  const { affiliation, verification_status: status, is_identity_verified: verified } = resolved
  const isUniversityMember = affiliation !== "external"
  const needsVerification  = isUniversityMember && !verified

  return (
    <div className="min-h-screen bg-background">
      <AppHeader fullName={resolved.full_name} role={resolved.role} email={user.email ?? ""} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Welcome, {resolved.full_name?.split(" ")[0] || "member"} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            {AFFILIATION_LABELS[affiliation]} · SorSU UniMerch Marketplace
          </p>
          <div className="mt-3 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
        </div>

        {/* Verification status card */}
        <Card className="overflow-hidden border-primary/10 shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <ShieldCheck className="size-5 text-primary" />
                Identity Verification
              </CardTitle>
              <CardDescription>
                {verified
                  ? "Your university identity is verified. You can access all restricted items."
                  : isUniversityMember
                  ? "Verify your identity with your COR or School ID to unlock restricted, role-based items."
                  : "You can browse and buy regular items freely. Restricted items require a verified university affiliation."}
              </CardDescription>
            </div>
            <VerificationStatusBadge status={status} className="shrink-0" />
          </CardHeader>
          {verified && (
            <CardContent className="flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
              <BadgeCheck className="size-4 text-primary" />
              Verified as {AFFILIATION_LABELS[affiliation]} — restricted items are unlocked.
            </CardContent>
          )}
          {needsVerification && (
            <CardContent className="border-t border-border pt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/verify">
                  {status === "rejected" ? "Re-submit documents" : "Verify my identity"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          )}
        </Card>

        {/* CTA cards */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Card className="border-primary/10 transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-base">
                <ShoppingBag className="size-5 text-gold" />
                Browse the Marketplace
              </CardTitle>
              <CardDescription>
                Shop campus goods, uniforms, merch, and event tickets from accredited organizations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/marketplace">
                  Open Marketplace <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/10 transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-base">
                <BadgeCheck className="size-5 text-gold" />
                My Orders
              </CardTitle>
              <CardDescription>
                Track your purchases, view order status, and manage your transaction history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/marketplace/orders">
                  View My Orders <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
