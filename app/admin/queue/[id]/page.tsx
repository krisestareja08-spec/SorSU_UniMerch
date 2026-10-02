import Link from "next/link"
import { notFound } from "next/navigation"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Button } from "@/components/ui/button"
import { ProfileDetails, DocumentPreview } from "@/components/admin/profile-details"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { decideVerification } from "../../verification-actions"
import { findDuplicateGroups, formatDateTime, profilesById, signedDocUrl, type AdminProfile } from "@/lib/admin"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"

export default async function VerificationRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireDashboard("verification", "queue")
  const supabase = await createClient()

  const { data: request } = await supabase
    .from("verification_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!request) notFound()

  const [people, idUrl, corUrl, duplicates] = await Promise.all([
    profilesById(supabase, [request.user_id]),
    signedDocUrl(supabase, request.document_url),
    signedDocUrl(supabase, request.cor_url),
    findDuplicateGroups(supabase).catch(() => []),
  ])
  const applicant: AdminProfile = people.get(request.user_id) ?? {
    id: request.user_id, full_name: request.full_name, role: "buyer", affiliation: null, student_employee_id: request.student_employee_id,
    department: request.department, campus: null, contact: null, birthday: null, account_status: null,
    is_identity_verified: false, verification_status: request.status, avatar_url: null, created_at: null,
  }
  const duplicate = duplicates.find((d) => d.idNumber === request.student_employee_id?.trim())
  const others = duplicate?.accounts.filter((a) => a.userId !== request.user_id) ?? []
  const isOpen = ["pending", "under_review"].includes(request.status)
  const isStudent = request.claimed_affiliation === "student"

  return (
    <ManagementShell ctx={ctx}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href="/admin/queue"><ArrowLeft className="size-4" />Back to queue</Link>
      </Button>
      <PageHeading
        title={`Verification request — ${request.full_name}`}
        description={`Applying as ${AFFILIATION_LABELS[request.claimed_affiliation as Affiliation] ?? request.claimed_affiliation} · submitted ${formatDateTime(request.created_at)} · status: ${request.status.replace(/_/g, " ")}`}
      />

      {others.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            I.D. number <strong>{request.student_employee_id}</strong> is also used by{" "}
            {others.map((o, i) => (
              <span key={o.userId}>{i > 0 && ", "}<Link href={`/admin/users/${o.userId}`} className="underline">{o.name ?? "another account"}</Link>{o.verified && " (verified)"}</span>
            ))}
            . Only one account per I.D. number can be verified.
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <ProfileDetails profile={applicant} />
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <p className="mb-2 font-semibold text-foreground">Submitted on this request</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Name on request</dt><dd>{request.full_name}</dd>
              <dt className="text-muted-foreground">I.D. number</dt><dd>{request.student_employee_id}</dd>
              <dt className="text-muted-foreground">Department</dt><dd>{request.department || "—"}</dd>
              <dt className="text-muted-foreground">Course</dt><dd>{request.course || "—"}</dd>
              <dt className="text-muted-foreground">Applying as</dt><dd>{AFFILIATION_LABELS[request.claimed_affiliation as Affiliation] ?? request.claimed_affiliation}</dd>
              {request.note && (<><dt className="text-muted-foreground">Note</dt><dd className="font-medium text-amber-700">{request.note}</dd></>)}
              {request.review_reason && (<><dt className="text-muted-foreground">Reviewer note</dt><dd>{request.review_reason}</dd></>)}
            </dl>
          </div>
        </div>

        <div className="space-y-5">
          <DocumentPreview label={isStudent ? "School I.D." : "School / employee I.D."} url={idUrl} path={request.document_url} />
          {(isStudent || request.cor_url) && (
            <DocumentPreview label="Certificate of Registration (COR)" url={corUrl} path={request.cor_url} />
          )}
        </div>
      </div>

      {isOpen && (
        <form action={decideVerification} className="sticky bottom-20 mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-lg lg:bottom-4">
          <input type="hidden" name="request_id" value={request.id} />
          <input type="hidden" name="return_to" value="/admin/queue" />
          <input
            type="text"
            name="reason"
            placeholder="Reason / note to the user (optional)"
            className="h-9 min-w-48 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <button name="decision" value="approved" className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
            Approve
          </button>
          <button name="decision" value="rejected" className="h-9 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90">
            Decline
          </button>
          <button name="decision" value="needs_resubmission" className="h-9 rounded-lg border border-input bg-background px-4 text-sm font-semibold hover:bg-muted">
            Ask to resubmit
          </button>
        </form>
      )}
    </ManagementShell>
  )
}
