"use client"

import { CAMPUS_LABELS } from "@/lib/roles"
import { IDENTITY_CAMPUSES, STORE_CAMPUSES, collegesFor, programsFor } from "@/lib/campus-catalog"
import { cn } from "@/lib/utils"

export type CampusCollegeProgram = { campus: string; college: string; program: string }

const selectClass =
  "mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"

/**
 * Campus → College → Course/program dropdowns from the official catalog (lib/campus-catalog.ts).
 *  • mode "identity" (people): Baribag Extension listed under Main; the program is required for students.
 *  • mode "store" (sellers / branches): Baribag is part of Main; no program; college optional.
 * Choosing a campus clears a college from another campus, and so on down the chain.
 */
export function CampusCollegeProgramFields({
  value, onChange, mode = "identity", affiliation = "student", disabled = false, idPrefix = "ccp", collegeOptional = false,
}: {
  value: CampusCollegeProgram
  onChange: (v: CampusCollegeProgram) => void
  mode?: "identity" | "store"
  affiliation?: string
  disabled?: boolean
  idPrefix?: string
  /** Stores: "Whole campus / no college" allowed */
  collegeOptional?: boolean
}) {
  const campuses = mode === "store" ? STORE_CAMPUSES : IDENTITY_CAMPUSES
  const colleges = collegesFor(value.campus, { forStores: mode === "store" })
  const programs = programsFor(value.college)
  const wantsProgram = mode === "identity" && affiliation !== "external"
  const programRequired = wantsProgram && affiliation === "student"

  return (
    <div className={cn("grid gap-4", wantsProgram ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      <div>
        <label htmlFor={`${idPrefix}-campus`} className="text-sm font-medium">Campus</label>
        <select id={`${idPrefix}-campus`} className={selectClass} disabled={disabled} value={value.campus}
          onChange={(e) => onChange({ campus: e.target.value, college: "", program: "" })}>
          <option value="">Select campus</option>
          {campuses.map((c) => <option key={c} value={c}>{CAMPUS_LABELS[c]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-college`} className="text-sm font-medium">
          College / department{collegeOptional && <span className="font-normal text-muted-foreground"> (optional)</span>}
        </label>
        <select id={`${idPrefix}-college`} className={selectClass} disabled={disabled || !value.campus} value={value.college}
          onChange={(e) => onChange({ ...value, college: e.target.value, program: "" })}>
          <option value="">{!value.campus ? "Choose a campus first" : collegeOptional ? "Whole campus" : "Select college"}</option>
          {colleges.map((c) => <option key={c.code} value={c.code}>{c.abbr} — {c.name}</option>)}
        </select>
      </div>
      {wantsProgram && (
        <div>
          <label htmlFor={`${idPrefix}-program`} className="text-sm font-medium">
            Course / program{!programRequired && <span className="font-normal text-muted-foreground"> (optional)</span>}
          </label>
          <select id={`${idPrefix}-program`} className={selectClass} disabled={disabled || !value.college} value={value.program}
            onChange={(e) => onChange({ ...value, program: e.target.value })}>
            <option value="">{!value.college ? "Choose a college first" : programRequired ? "Select course / program" : "None"}</option>
            {programs.map((p) => <option key={p.code} value={p.code}>{p.abbr} — {p.name}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
