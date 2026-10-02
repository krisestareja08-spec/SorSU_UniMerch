import { createClient } from "@/lib/supabase/server"
import { assertDashboard } from "@/lib/dashboards"

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Server-side guard for Verification Admin actions: member of the Verification Admin dashboard with `perm`. */
export async function requireAdminActor(perm: string | null = null) {
  const { supabase, userId } = await assertDashboard("verification", perm)
  return { supabase, actorId: userId }
}

/** Writes an entry to the Activity Log. Best-effort — never blocks the action itself. */
export async function logAudit(
  supabase: Supabase,
  actorId: string,
  entry: { requestId?: string; userId?: string; action: string; reason?: string | null },
) {
  await supabase.from("verification_audit_log").insert({
    request_id: entry.requestId ?? null,
    user_id: entry.userId ?? null,
    actor_id: actorId,
    action: entry.action,
    reason: entry.reason ?? null,
  }).then(() => {}, () => {})
}

export const ACTION_LABELS: Record<string, string> = {
  verification_approved: "Approved verification",
  verification_rejected: "Declined verification",
  verification_needs_resubmission: "Requested resubmission",
  verification_under_review: "Marked under review",
  account_active: "Reactivated account",
  account_suspended: "Suspended account",
  account_flagged: "Flagged account",
  account_banned: "Banned account",
  account_deleted: "Deleted account",
  report_dismissed: "Dismissed account report",
  product_pulled: "Pulled out product",
  store_flagged: "Flagged store for a violation",
  product_restored: "Restored product",
  report_acknowledged: "Acknowledged sales report",
  report_flagged: "Flagged sales report",
  stock_adjusted: "Adjusted stock",
  sales_report_submitted: "Submitted sales report",
  seller_created: "Created organization",
  cashier_branch_created: "Created cashier branch",
  member_added: "Added dashboard member",
  member_removed: "Removed dashboard member",
  member_permissions: "Changed member permissions",
  main_admin_changed: "Changed Main Admin",
  seller_active: "Activated storefront",
  seller_suspended: "Suspended storefront",
  identity_change_approved: "Approved identity change",
  identity_change_rejected: "Declined identity change",
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

/** Signed, short-lived link to a private verification document (null if missing). */
export async function signedDocUrl(supabase: Supabase, path: string | null) {
  if (!path) return null
  const { data } = await supabase.storage.from("verification-docs").createSignedUrl(path, 60 * 10)
  return data?.signedUrl ?? null
}

export type AdminProfile = {
  id: string
  full_name: string | null
  role: string
  affiliation: string | null
  student_employee_id: string | null
  department: string | null
  course?: string | null
  campus: string | null
  contact: string | null
  birthday: string | null
  account_status: string | null
  is_identity_verified: boolean | null
  verification_status: string | null
  avatar_url: string | null
  created_at: string | null
}

export const PROFILE_COLUMNS =
  "id, full_name, role, affiliation, student_employee_id, department, campus, contact, birthday, account_status, is_identity_verified, verification_status, avatar_url, created_at"

/** Loads profiles by id into a map (missing columns/tables degrade to an empty map). */
export async function profilesById(supabase: Supabase, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((i): i is string => !!i))]
  if (!unique.length) return new Map<string, AdminProfile>()
  const withCourse = await supabase.from("profiles").select(`${PROFILE_COLUMNS}, course`).in("id", unique)
  const rows = withCourse.error
    ? (await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", unique)).data // before scripts/12
    : withCourse.data
  return new Map(((rows ?? []) as AdminProfile[]).map((p) => [p.id, p]))
}

export type DuplicateGroup = {
  idNumber: string
  accounts: { userId: string; name: string | null; source: "profile" | "request"; status: string; verified: boolean }[]
}

/**
 * One account per I.D. number: groups every account that uses the same I.D. number,
 * either on its profile or in a verification request.
 */
export async function findDuplicateGroups(supabase: Supabase): Promise<DuplicateGroup[]> {
  const [{ data: profiles }, { data: requests }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, student_employee_id, is_identity_verified, account_status").not("student_employee_id", "is", null),
    supabase.from("verification_requests").select("user_id, full_name, student_employee_id, status"),
  ])

  const groups = new Map<string, DuplicateGroup["accounts"]>()
  const add = (idNumber: string | null, acc: DuplicateGroup["accounts"][number]) => {
    const key = idNumber?.trim()
    if (!key) return
    const list = groups.get(key) ?? []
    const existing = list.find((a) => a.userId === acc.userId)
    if (existing) {
      existing.verified ||= acc.verified
      return
    }
    list.push(acc)
    groups.set(key, list)
  }

  for (const p of profiles ?? []) {
    add(p.student_employee_id, { userId: p.id, name: p.full_name, source: "profile", status: p.account_status ?? "active", verified: !!p.is_identity_verified })
  }
  for (const r of requests ?? []) {
    add(r.student_employee_id, { userId: r.user_id, name: r.full_name, source: "request", status: r.status, verified: r.status === "approved" })
  }

  return [...groups.entries()]
    .filter(([, accounts]) => accounts.length > 1)
    .map(([idNumber, accounts]) => ({ idNumber, accounts }))
}
