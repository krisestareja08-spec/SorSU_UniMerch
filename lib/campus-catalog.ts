import { AFFILIATION_LABELS, CAMPUS_LABELS, type Affiliation, type Campus } from "@/lib/roles"

/**
 * SorSU's official Campus → College → Program catalog — the one source for identity (profiles,
 * verification), seller identity, product restrictions and buyer filters.
 *
 * Stored values (profiles.department / profiles.course / seller_profiles.department / product tokens)
 * are the codes below: lowercase "campus.short", so they can never be mistaken for old free text.
 *
 * Baribag Extension is part of the Main campus: it is shown separately only for a student's identity
 * (its CEA programs); for sellers, restrictions and campus filters it counts as Main (effectiveCampus).
 */

export type College = { code: string; campus: Campus; abbr: string; name: string }
export type Program = { code: string; college: string; abbr: string; name: string }

const CAMPUS_KEY: Record<Campus, string> = {
  sorsogon_city_main: "main",
  sorsogon_city_baribag: "baribag",
  bulan: "bulan",
  castilla: "castilla",
  magallanes: "magallanes",
}

// [campus, college short, abbr, name, [program short, abbr, name][]]
type Row = [Campus, string, string, string, [string, string, string][]]
const DATA: Row[] = [
  ["sorsogon_city_main", "coted", "CoTEd", "College of Teacher Education", [
    ["beed", "BEEd", "Bachelor of Elementary Education"],
    ["bcaed", "BCAEd", "Bachelor of Culture and Arts Education"],
    ["bped", "BPEd", "Bachelor of Physical Education"],
    ["bsed-english", "BSEd English", "Bachelor of Secondary Education – Major in English"],
    ["bsed-math", "BSEd Math", "Bachelor of Secondary Education – Major in Mathematics"],
    ["bsed-science", "BSEd Science", "Bachelor of Secondary Education – Major in Science"],
    ["bsed-filipino", "BSEd Filipino", "Bachelor of Secondary Education – Major in Filipino"],
    ["bsed-socstud", "BSEd Social Studies", "Bachelor of Secondary Education – Major in Social Studies"],
    ["bs-midwifery", "BS Midwifery", "Bachelor of Science in Midwifery"],
  ]],
  ["sorsogon_city_main", "chs", "CHS", "College of Health Sciences", [
    ["bsn", "BSN", "Bachelor of Science in Nursing"],
  ]],
  ["sorsogon_city_main", "cot", "CoT", "College of Technology", [
    ["btvte", "BTVTE", "Bachelor of Technical-Vocational Teacher Education"],
    ["bt-drafting", "BT Drafting", "Bachelor of Technology – Major in Architectural Drafting"],
    ["bt-automotive", "BT Automotive", "Bachelor of Technology – Major in Automotive Technology"],
    ["bt-civil", "BT Civil", "Bachelor of Technology – Major in Civil Technology"],
    ["bt-electrical", "BT Electrical", "Bachelor of Technology – Major in Electrical Technology"],
    ["bt-electronics", "BT Electronics", "Bachelor of Technology – Major in Electronics Technology"],
    ["bt-garment", "BT Garment", "Bachelor of Technology – Major in Garment Technology"],
    ["bt-mechanical", "BT Mechanical", "Bachelor of Technology – Major in Mechanical Technology"],
    ["bt-welding", "BT Welding", "Bachelor of Technology – Major in Welding & Fabrication"],
  ]],
  ["sorsogon_city_main", "cbm", "CBM", "College of Business and Management", [
    ["bsa", "BSA", "Bachelor of Science in Accountancy"],
    ["bs-entrep", "BS Entrep", "Bachelor of Science in Entrepreneurship"],
    ["bstm", "BSTM", "Bachelor of Science in Tourism Management"],
    ["bshm", "BSHM", "Bachelor of Science in Hospitality Management"],
  ]],
  ["sorsogon_city_main", "cs", "CS", "College of Science", [
    ["bs-bio", "BS Biology", "Bachelor of Science in Biology"],
  ]],
  ["sorsogon_city_main", "sgs", "SGS", "School of Graduate Studies", [
    ["dpa", "DPA", "Doctor of Public Administration"],
    ["edd-elm", "Ed.D. ELM", "Doctor of Education – Major in Educational Leadership and Management"],
    ["phd-langed", "Ph.D. Language Ed", "Doctor of Philosophy – Major in Language Education"],
    ["phd-filipino", "Ph.D. Filipino", "Doctor of Philosophy – Major in Filipino"],
    ["phd-mathed", "Ph.D. Math Ed", "Doctor of Philosophy – Major in Mathematics Education"],
    ["maed-math", "MAEd Math", "Master of Arts in Education – Major in Mathematics"],
    ["maed-english", "MAEd English", "Master of Arts in Education – Major in English"],
    ["maed-filipino", "MAEd Filipino", "Master of Arts in Education – Major in Filipino"],
    ["maed-science", "MAEd Science Ed", "Master of Arts in Education – Major in Science Education"],
    ["mat-tech", "MAT Technology Ed", "Master of Arts in Teaching – Major in Technology Education"],
    ["mat-the", "MAT THE", "Master of Arts in Teaching – Major in Technology and Home Economics"],
    ["mpa", "MPA", "Master of Public Administration"],
    ["mam", "MAM", "Master of Arts in Management"],
  ]],
  ["sorsogon_city_baribag", "cea", "CEA", "College of Engineering and Architecture", [
    ["bs-archi", "BS Archi", "Bachelor of Science in Architecture"],
    ["bsce", "BSCE", "Bachelor of Science in Civil Engineering"],
    ["bsee", "BSEE", "Bachelor of Science in Electrical Engineering"],
    ["bsece", "BSECE", "Bachelor of Science in Electronics Engineering"],
    ["bsme", "BSME", "Bachelor of Science in Mechanical Engineering"],
  ]],
  ["bulan", "cict", "CICT", "College of Information and Communications Technology", [
    ["bscs", "BSCS", "Bachelor of Science in Computer Science"],
    ["bsit", "BSIT", "Bachelor of Science in Information Technology"],
    ["bsis", "BSIS", "Bachelor of Science in Information Systems"],
    ["bsais", "BSAIS", "Bachelor of Science in Accounting Information System"],
  ]],
  ["bulan", "cbme", "CBME", "College of Business Management and Education", [
    ["bsa", "BSA", "Bachelor of Science in Accountancy"],
    ["bpa", "BPA", "Bachelor in Public Administration"],
    ["bsed", "BSEd", "Bachelor of Secondary Education"],
  ]],
  ["castilla", "ca", "CA", "College of Agriculture", [
    ["bsa-crop", "BSA Crop Science", "Bachelor of Science in Agriculture – Major in Crop Science"],
    ["bsa-animal", "BSA Animal Science", "Bachelor of Science in Agriculture – Major in Animal Science"],
    ["bsa-aged", "BSA Agri Education", "Bachelor of Science in Agriculture – Major in Agricultural Education"],
    ["bsab", "BSAB", "Bachelor of Science in Agribusiness"],
    ["bsabe", "BSABE", "Bachelor of Science in Agricultural and Biosystems Engineering"],
  ]],
  ["magallanes", "cfms", "CFMS", "College of Fisheries and Marine Sciences", [
    ["bsfi", "BSFi", "Bachelor of Science in Fisheries"],
    ["bs-marbio", "BS Marine Biology", "Bachelor of Science in Marine Biology"],
    ["bs-entrep-fish", "BS Entrep (Fisheries Business)", "Bachelor of Science in Entrepreneurship (Fisheries Business)"],
  ]],
  ["magallanes", "coed", "CoEd", "College of Education", [
    ["beed", "BEEd", "Bachelor of Elementary Education"],
    ["bsed-science", "BSEd Sciences", "Bachelor of Secondary Education – Major in Sciences"],
  ]],
]

export const COLLEGES: College[] = DATA.map(([campus, short, abbr, name]) => ({ code: `${CAMPUS_KEY[campus]}.${short}`, campus, abbr, name }))
export const PROGRAMS: Program[] = DATA.flatMap(([campus, short, , , programs]) =>
  programs.map(([p, abbr, name]) => ({ code: `${CAMPUS_KEY[campus]}.${p}`, college: `${CAMPUS_KEY[campus]}.${short}`, abbr, name })))

const collegeByCode = new Map(COLLEGES.map((c) => [c.code, c]))
const programByCode = new Map(PROGRAMS.map((p) => [p.code, p]))

/** Campuses in the order people pick them; Baribag shown under Main (student identity only). */
export const IDENTITY_CAMPUSES: Campus[] = ["sorsogon_city_main", "sorsogon_city_baribag", "bulan", "castilla", "magallanes"]
/** Campuses for sellers, restrictions and filters — Baribag is part of Main here. */
export const STORE_CAMPUSES: Campus[] = ["sorsogon_city_main", "bulan", "castilla", "magallanes"]

/** Baribag counts as the Main campus for sellers, restrictions and filters. */
export function effectiveCampus(campus: string | null | undefined): string | null {
  if (!campus) return null
  return campus === "sorsogon_city_baribag" ? "sorsogon_city_main" : campus
}

/** Colleges of a campus. `forStores`: Main also lists Baribag's CEA (Baribag is part of Main). */
export function collegesFor(campus: string | null | undefined, { forStores = false } = {}): College[] {
  if (!campus) return []
  const c = forStores ? effectiveCampus(campus) : campus
  return COLLEGES.filter((x) => x.campus === c || (forStores && c === "sorsogon_city_main" && x.campus === "sorsogon_city_baribag"))
}

export function programsFor(college: string | null | undefined): Program[] {
  return college ? PROGRAMS.filter((p) => p.college === college) : []
}

export const isCollegeCode = (v: string | null | undefined): v is string => !!v && collegeByCode.has(v)
export const isProgramCode = (v: string | null | undefined): v is string => !!v && programByCode.has(v)
export const getCollege = (code: string | null | undefined) => (code ? collegeByCode.get(code) : undefined)
export const getProgram = (code: string | null | undefined) => (code ? programByCode.get(code) : undefined)

/** "College of Information and Communications Technology (CICT)" — old free text is returned as is. */
export function collegeLabel(code: string | null | undefined, { short = false } = {}) {
  const c = getCollege(code)
  return c ? (short ? c.abbr : `${c.name} (${c.abbr})`) : code ?? null
}

/** "Bachelor of Science in Information Technology (BSIT)" — old free text is returned as is. */
export function programLabel(code: string | null | undefined, { short = false } = {}) {
  const p = getProgram(code)
  return p ? (short ? p.abbr : `${p.name} (${p.abbr})`) : code ?? null
}

/** Is this person's identity on the official catalog? (University members only.) */
export function identityOnCatalog(p: { affiliation?: string | null; campus?: string | null; department?: string | null; course?: string | null }) {
  if (!p.affiliation || !["student", "faculty", "staff"].includes(p.affiliation)) return true
  if (!p.campus || !(p.campus in CAMPUS_LABELS)) return false
  const college = getCollege(p.department)
  if (!college || college.campus !== p.campus) return false
  if (p.affiliation === "student") {
    const program = getProgram(p.course)
    return !!program && program.college === college.code
  }
  return true
}

/** Checks a campus / college / program choice; returns an error message or null. */
export function validateIdentity(affiliation: string, campus: string, college: string, program: string): string | null {
  if (!["student", "faculty", "staff"].includes(affiliation)) return null
  if (!campus || !(campus in CAMPUS_LABELS)) return "Select your campus."
  const c = getCollege(college)
  if (!c || c.campus !== campus) return "Select your college from the list."
  if (affiliation === "student") {
    const p = getProgram(program)
    if (!p || p.college !== c.code) return "Select your course / program from the list."
  } else if (program && getProgram(program)?.college !== c.code) {
    return "Select a course / program from your college, or leave it empty."
  }
  return null
}

// ── Product restrictions ────────────────────────────────────────────────────
// products.allowed_roles holds role tokens (student | faculty | staff | guest) and optional scope
// tokens: "campus:<campus>", "college:<code>", "program:<code>". A buyer must match a role AND, when
// scope tokens exist, be verified with a matching campus / college / program (see viewer_role_allowed).

export const ROLE_TOKENS = ["student", "faculty", "staff", "guest"] as const
export type RoleToken = (typeof ROLE_TOKENS)[number]
export const ROLE_TOKEN_LABELS: Record<RoleToken, string> = {
  student: "Verified Student",
  faculty: "Verified Faculty (teaching)",
  staff: "Verified Staff (non-teaching)",
  guest: "Guest (not verified)",
}

/**
 * Keeps only valid tokens and removes broader places that a narrower pick replaces: choosing a
 * college of a campus narrows "the whole campus" to that college, and choosing programs of a college
 * narrows it to those programs. (A buyer may buy when they match ANY remaining place.)
 * Baribag campus tokens become Main.
 */
export function parseAllowed(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map(String) : []
  const roles = new Set<string>(), campuses = new Set<string>(), colleges = new Set<string>(), programs = new Set<string>()
  for (const t of list) {
    if ((ROLE_TOKENS as readonly string[]).includes(t)) roles.add(t)
    else if (t.startsWith("campus:")) {
      const c = effectiveCampus(t.slice(7))
      if (c && STORE_CAMPUSES.includes(c as Campus)) campuses.add(c)
    } else if (t.startsWith("college:") && isCollegeCode(t.slice(8))) colleges.add(t.slice(8))
    else if (t.startsWith("program:") && isProgramCode(t.slice(8))) programs.add(t.slice(8))
  }
  for (const p of programs) colleges.delete(getProgram(p)!.college)
  for (const p of programs) campuses.delete(effectiveCampus(getCollege(getProgram(p)!.college)!.campus)!)
  for (const c of colleges) campuses.delete(effectiveCampus(getCollege(c)!.campus)!)
  return [
    ...roles,
    ...[...campuses].map((c) => `campus:${c}`),
    ...[...colleges].map((c) => `college:${c}`),
    ...[...programs].map((p) => `program:${p}`),
  ]
}

/** "Verified Student · Bulan Campus · CICT · BSIT" — readable list of who may buy. */
export function describeAllowed(tokens: string[] | null | undefined): string {
  const t = tokens ?? []
  const roles = t.filter((x) => (ROLE_TOKENS as readonly string[]).includes(x))
    .map((r) => (r === "guest" ? "Guest" : `Verified ${AFFILIATION_LABELS[r as Affiliation] ?? r}`))
  const scopes = t.filter((x) => x.includes(":")).map((x) => {
    const [kind, value] = [x.slice(0, x.indexOf(":")), x.slice(x.indexOf(":") + 1)]
    if (kind === "campus") return CAMPUS_LABELS[value as Campus] ?? value
    if (kind === "college") return collegeLabel(value, { short: true }) ?? value
    return programLabel(value, { short: true }) ?? value
  })
  return [roles.join(" / "), scopes.join(", ")].filter(Boolean).join(" · ") || "—"
}
