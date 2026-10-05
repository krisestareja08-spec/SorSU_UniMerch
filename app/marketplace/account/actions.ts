"use server"

import { revalidatePath } from "next/cache"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { CAMPUS_LABELS } from "@/lib/roles"
import {
  STRICT_FIELD_LABELS, changedStrictFields, normalizeName, validateFullName,
  type ProfileInput, type StrictField,
} from "@/lib/profile-rules"

export type SaveProfileResult =
  | { ok: true; reverification: boolean }
  | { ok: false; error: string }
  | { ok: false; needsConfirmation: true; fields: string[] }

/**
 * Saves the signed-in user's profile.
 *  • Everyone: real full name (no dummy names), valid campus / contact / I.D. number.
 *  • Verified users: changing full name, I.D. number, course or department removes the verified
 *    status and sends a re-verification request to the Verification Admin (after confirmation).
 */
export async function saveMyProfile(input: ProfileInput, confirmReverification = false): Promise<SaveProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Please sign in again." }

  const { data: current } = await supabase
    .from("profiles")
    .select("full_name, student_employee_id, course, department, campus, contact, birthday, affiliation, is_identity_verified, verification_status, account_status")
    .eq("id", user.id)
    .maybeSingle()
  if (current?.account_status === "banned" || current?.account_status === "suspended") {
    return { ok: false, error: "Your account is restricted. Contact the Verification Admin." }
  }

  // ── Validation ───────────────────────────────────────────────────────────
  const next: ProfileInput = {
    full_name: normalizeName(input.full_name ?? ""),
    student_employee_id: (input.student_employee_id ?? "").trim(),
    course: normalizeName(input.course ?? ""),
    department: normalizeName(input.department ?? ""),
    campus: (input.campus ?? "").trim(),
    // The number only changes through SMS verification (components/account/phone-verification.tsx)
    contact: current?.contact ?? "",
    birthday: (input.birthday ?? "").trim(),
  }
  const nameError = validateFullName(next.full_name)
  if (nameError) return { ok: false, error: nameError }
  if (next.campus && !(next.campus in CAMPUS_LABELS)) return { ok: false, error: "Select your campus from the list." }
  if (next.student_employee_id && !/^[0-9][0-9-]{3,19}$/.test(next.student_employee_id)) return { ok: false, error: "Your I.D. number may only contain digits and hyphens." }
  if (next.birthday && Number.isNaN(Date.parse(next.birthday))) return { ok: false, error: "Enter a valid birthday." }

  if (next.student_employee_id && next.student_employee_id !== (current?.student_employee_id ?? "")) {
    const { data: taken } = await supabase.rpc("id_number_taken", { p_id: next.student_employee_id })
    if (taken === true) return { ok: false, error: "This I.D. number is already used by another account. Each person may only have one account." }
  }

  const before: Partial<ProfileInput> = {
    full_name: current?.full_name ?? "", student_employee_id: current?.student_employee_id ?? "",
    course: current?.course ?? "", department: current?.department ?? "",
  }
  const strictChanges: StrictField[] = changedStrictFields(before, next)
  const verified = !!current?.is_identity_verified

  const row = {
    full_name: next.full_name,
    student_employee_id: next.student_employee_id || null,
    course: next.course || null,
    department: next.department || null,
    campus: next.campus || null,
    contact: next.contact || null,
    birthday: next.birthday || null,
  }

  // ── Verified user changing identity fields → re-verification ─────────────
  if (verified && strictChanges.length > 0) {
    const labels = strictChanges.map((f) => STRICT_FIELD_LABELS[f])
    if (!confirmReverification) return { ok: false, needsConfirmation: true, fields: labels }

    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false, error: "Server is missing its service configuration." }
    const service = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: lastApproved } = await service
      .from("verification_requests")
      .select("document_url, cor_url")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error: updateError } = await service
      .from("profiles")
      .update({ ...row, is_identity_verified: false, verification_status: "pending" })
      .eq("id", user.id)
    if (updateError) return { ok: false, error: updateError.message }

    const { error: requestError } = await service.from("verification_requests").insert({
      user_id: user.id,
      full_name: row.full_name,
      student_employee_id: row.student_employee_id ?? "",
      department: row.department,
      course: row.course,
      claimed_affiliation: current?.affiliation && current.affiliation !== "external" ? current.affiliation : "student",
      document_type: "school_id",
      document_url: lastApproved?.document_url ?? null,
      cor_url: lastApproved?.cor_url ?? null,
      status: "pending",
      note: `Re-verification: changed ${labels.join(", ")}`,
    })
    if (requestError) return { ok: false, error: requestError.message }

    revalidatePath("/marketplace/account")
    return { ok: true, reverification: true }
  }

  const { error } = await supabase.from("profiles").update(row).eq("id", user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/marketplace/account")
  revalidatePath("/marketplace/checkout")
  return { ok: true, reverification: false }
}
