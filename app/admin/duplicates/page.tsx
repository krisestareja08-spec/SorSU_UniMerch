import Link from "next/link"
import { requireDashboard } from "@/lib/dashboards"
import { createClient } from "@/lib/supabase/server"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { AlertOctagon, CheckCircle2, UserX } from "lucide-react"
import { findDuplicateGroups } from "@/lib/admin"
import { updateAccountStatus } from "../verification-actions"
import { cn } from "@/lib/utils"

export default async function DuplicatesPage() {
  const ctx = await requireDashboard("verification", "duplicates")
  const supabase = await createClient()
  const groups = await findDuplicateGroups(supabase).catch(() => [])

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading
        title="Duplicate Detection"
        description="Accounts that signed up or applied with the same I.D. number. The system allows only one account per I.D. number — keep the genuine account and suspend the rest."
      />

      <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">
        Enforcement: sign-up and the verification form reject an I.D. number that is already in use, and a second
        account with the same I.D. can never be approved in the Verification Queue.
      </div>

      <div className="mt-5 space-y-4">
        {groups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-500/60" />
            No duplicate I.D. numbers found.
          </div>
        )}
        {groups.map((g) => (
          <div key={g.idNumber} className="rounded-2xl border border-destructive/20 bg-card p-4">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <AlertOctagon className="size-4 text-destructive" />
              I.D. number {g.idNumber}
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">{g.accounts.length} accounts</span>
            </p>
            <ul className="mt-3 divide-y divide-border">
              {g.accounts.map((a) => (
                <li key={a.userId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <Link href={`/admin/users/${a.userId}`} className="font-medium text-foreground hover:text-primary hover:underline">{a.name ?? "Unnamed user"}</Link>
                    <p className="text-xs text-muted-foreground">
                      {a.source === "profile" ? "On profile" : "In verification request"} ·{" "}
                      <span className={cn("capitalize", a.verified && "font-semibold text-emerald-600")}>{a.verified ? "verified" : a.status.replace(/_/g, " ")}</span>
                    </p>
                  </div>
                  <form action={updateAccountStatus} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={a.userId} />
                    <input type="hidden" name="status" value="suspended" />
                    <input type="hidden" name="reason" value={`Duplicate I.D. number ${g.idNumber}`} />
                    <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">
                      <UserX className="size-3" /> Suspend
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ManagementShell>
  )
}
