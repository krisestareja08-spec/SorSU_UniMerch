import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { profileFromUser } from "@/lib/profile"
import { type Affiliation, type UserRole, type VerificationStatus } from "@/lib/roles"
import { AppHeader } from "@/components/app-header"
import { VerificationStatusBadge } from "@/components/verification-status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ShieldCheck, Info } from "lucide-react"

export default async function VerifyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, affiliation, verification_status, is_identity_verified")
    .eq("id", user.id)
    .maybeSingle()

  const resolvedProfile = error || !profile ? profileFromUser(user) : {
    full_name: profile.full_name ?? null,
    role: (profile.role ?? "buyer") as UserRole,
    affiliation: (profile.affiliation ?? "external") as Affiliation,
    verification_status: (profile.verification_status ?? "unverified") as VerificationStatus,
    is_identity_verified: profile.is_identity_verified ?? false,
  }

  const role = resolvedProfile.role
  const affiliation = resolvedProfile.affiliation
  const status = resolvedProfile.verification_status

  return (
    <div className="min-h-screen bg-background">
      <AppHeader fullName={resolvedProfile.full_name ?? null} role={role} email={user.email ?? ""} />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </Button>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-balance font-serif text-3xl font-semibold tracking-tight">Verify your identity</h1>
            <VerificationStatusBadge status={status} />
          </div>
          <p className="text-pretty text-muted-foreground">
            Verification is temporarily paused while the replacement verification service is being prepared.
          </p>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <ShieldCheck className="size-5 text-primary" />
              Verification temporarily bypassed
            </CardTitle>
            <CardDescription>
              You can access regular and restricted marketplace items without submitting a document for now.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>Verification is disabled for now. No document upload or Supabase verification request is required.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
