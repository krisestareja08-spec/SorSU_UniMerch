import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { profileFromUser } from "@/lib/profile"
import { type Affiliation, type UserRole, type VerificationStatus } from "@/lib/roles"
import { AppHeader } from "@/components/app-header"
import { VerificationStatusBadge } from "@/components/verification-status-badge"
import { VerifyForm } from "@/components/verify/verify-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ShieldCheck, Info, BadgeCheck, Clock } from "lucide-react"

export default async function VerifyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, affiliation, verification_status, is_identity_verified, student_employee_id, department, course, campus, contact, birthday")
    .eq("id", user.id)
    .maybeSingle()

  const resolvedProfile = error || !profile ? profileFromUser(user) : {
    full_name: profile.full_name ?? null,
    role: (profile.role ?? "buyer") as UserRole,
    affiliation: (profile.affiliation ?? "external") as Affiliation,
    verification_status: (profile.verification_status ?? "unverified") as VerificationStatus,
    is_identity_verified: profile.is_identity_verified ?? false,
  }
  const studentEmployeeId = (!error && profile?.student_employee_id) || null
  const department = (!error && profile?.department) || null
  const campus = (!error && profile?.campus) || null
  const course = (!error && profile?.course) || null
  const contact = (!error && profile?.contact) || null
  const birthday = (!error && profile?.birthday) || null

  const { data: latestRequest } = await supabase
    .from("verification_requests")
    .select("id, status, review_reason, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const affiliation = resolvedProfile.affiliation
  const status = resolvedProfile.verification_status
  const canResubmit = !latestRequest || ["rejected", "needs_resubmission"].includes(latestRequest.status)
  const isPendingReview = latestRequest && ["pending", "under_review"].includes(latestRequest.status)

  return (
    <div className="min-h-screen bg-background">
      <AppHeader fullName={resolvedProfile.full_name ?? null} email={user.email ?? ""} />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href="/marketplace/account">
            <ArrowLeft className="size-4" />
            Back to profile
          </Link>
        </Button>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-balance font-serif text-3xl font-semibold tracking-tight">Verify your identity</h1>
            <VerificationStatusBadge status={status} />
          </div>
          <p className="text-pretty text-muted-foreground">
            Students submit their I.D. and Certificate of Registration (COR); faculty and staff submit their I.D. only.
            The Verification Admin will confirm your university affiliation. Restricted items unlock once approved.
          </p>
        </div>

        {resolvedProfile.is_identity_verified || status === "approved" ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <BadgeCheck className="size-5 text-primary" />
                You&apos;re verified
              </CardTitle>
              <CardDescription>Your identity has been confirmed. Restricted items are unlocked.</CardDescription>
            </CardHeader>
          </Card>
        ) : isPendingReview ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <Clock className="size-5 text-primary" />
                Submission under review
              </CardTitle>
              <CardDescription>
                The Admin is reviewing your document. You&apos;ll be notified once a decision is made.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <ShieldCheck className="size-5 text-primary" />
                {latestRequest?.status === "rejected" || latestRequest?.status === "needs_resubmission"
                  ? "Resubmit your document"
                  : "Submit your document"}
              </CardTitle>
              <CardDescription>
                Uploads are stored privately and only visible to Admin staff reviewing your request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latestRequest?.review_reason && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <p>
                    <span className="font-medium text-destructive">Reviewer note:</span> {latestRequest.review_reason}
                  </p>
                </div>
              )}
              {canResubmit && (
                <VerifyForm
                  userId={user.id}
                  defaultAffiliation={affiliation}
                  defaultFullName={resolvedProfile.full_name}
                  defaultStudentId={studentEmployeeId}
                  defaultDepartment={department}
                  defaultCampus={campus}
                  defaultCourse={course}
                  defaultContact={contact}
                  defaultBirthday={birthday}
                />
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
