/**
 * Profile rules shared by the browser and the server.
 *  • Everyone: the full name must be a real, precise name — not a dummy.
 *  • Verified users: full name, I.D. number, course and department are strict — changing any of
 *    them sends the account back to the Verification Admin for re-verification.
 */

export const STRICT_FIELDS = ["full_name", "student_employee_id", "course", "department"] as const
export type StrictField = (typeof STRICT_FIELDS)[number]

export const STRICT_FIELD_LABELS: Record<StrictField, string> = {
  full_name: "Full name",
  student_employee_id: "I.D. number",
  course: "Course / program",
  department: "Department / college",
}

const DUMMY_WORDS = new Set([
  "test", "tester", "testing", "dummy", "fake", "sample", "user", "guest", "admin", "anonymous", "anon",
  "asdf", "asd", "qwe", "qwerty", "abc", "xyz", "xxx", "aaa", "na", "n/a", "none", "null", "unknown",
  "john doe", "jane doe", "lorem", "ipsum", "hello", "hi", "me", "name", "noname",
])

/** Returns an error message when the name looks like a dummy, otherwise null. */
export function validateFullName(raw: string | null | undefined): string | null {
  const name = (raw ?? "").trim().replace(/\s+/g, " ")
  if (!name) return "Enter your full name."
  if (name.length < 5 || name.length > 80) return "Enter your complete real name (first and last name)."
  if (!/^[\p{L}][\p{L}.'\- ]*[\p{L}.]$/u.test(name)) return "Your name may only contain letters, spaces, periods, apostrophes and hyphens."

  const words = name.split(" ").filter((w) => w.replace(/[.'-]/g, "").length > 0)
  if (words.length < 2) return "Enter both your first and last name."
  const lettersOnly = name.toLowerCase().replace(/[^\p{L} ]/gu, "")
  const dummyWord = words.some((w) => DUMMY_WORDS.has(w.toLowerCase().replace(/[.'-]/g, "")))
  if (DUMMY_WORDS.has(lettersOnly) || (dummyWord && words.length <= 2)) {
    return "That looks like a placeholder name. Use your real name — dummy accounts can be banned."
  }
  if (/(.)\1{2,}/i.test(name.replace(/\s/g, ""))) return "That doesn't look like a real name. Dummy accounts can be banned."
  if (words.some((w) => w.replace(/[.'-]/g, "").length >= 3 && !/[aeiouy]/i.test(w))) {
    return "That doesn't look like a real name. Dummy accounts can be banned."
  }
  return null
}

export function normalizeName(raw: string) {
  return raw.trim().replace(/\s+/g, " ")
}

export type ProfileInput = {
  full_name: string
  student_employee_id: string
  course: string
  department: string
  campus: string
  contact: string
  birthday: string
}

/** Strict fields whose value differs between the saved profile and the edit. */
export function changedStrictFields(before: Partial<ProfileInput>, after: Partial<ProfileInput>): StrictField[] {
  const norm = (v: string | null | undefined) => (v ?? "").trim().replace(/\s+/g, " ")
  return STRICT_FIELDS.filter((f) => norm(before[f]) !== norm(after[f]))
}
