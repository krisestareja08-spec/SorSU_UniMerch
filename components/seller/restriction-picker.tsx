"use client"

import { CAMPUS_LABELS } from "@/lib/roles"
import {
  ROLE_TOKENS, ROLE_TOKEN_LABELS, STORE_CAMPUSES, collegesFor, describeAllowed, effectiveCampus, getCollege, getProgram,
  parseAllowed, programsFor,
} from "@/lib/campus-catalog"
import { cn } from "@/lib/utils"

const chip = (on: boolean) =>
  cn("rounded-lg border px-2.5 py-1.5 text-xs transition-colors", on ? "border-primary bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground hover:bg-muted")

/**
 * Who may buy a restricted product: roles (Verified Student / Faculty / Staff, Guest) and, optionally,
 * campuses → colleges → programs from the official catalog. Picking a college narrows its campus to
 * that college; picking programs narrows the college to those programs. Saved as products.allowed_roles.
 */
export function RestrictionPicker({ restricted, onRestrictedChange, tokens, onChange }: {
  restricted: boolean
  onRestrictedChange: (v: boolean) => void
  tokens: string[]
  onChange: (tokens: string[]) => void
}) {
  // Working selection (broader picks stay visible while the seller narrows them down)
  const has = (t: string) => tokens.includes(t)
  const toggle = (t: string) => onChange(has(t) ? tokens.filter((x) => x !== t) : [...tokens, t])

  const campuses = STORE_CAMPUSES.filter((c) => has(`campus:${c}`)
    || tokens.some((t) => t.startsWith("college:") && effectiveCampus(getCollege(t.slice(8))?.campus) === c)
    || tokens.some((t) => t.startsWith("program:") && effectiveCampus(getCollege(getProgram(t.slice(8))?.college)?.campus) === c))
  const colleges = campuses.flatMap((c) => collegesFor(c, { forStores: true }))
  const pickedColleges = colleges.filter((c) => has(`college:${c.code}`)
    || tokens.some((t) => t.startsWith("program:") && getProgram(t.slice(8))?.college === c.code))

  const toggleCampus = (c: string) => {
    if (campuses.includes(c as never)) {
      // Removing a campus removes everything picked under it
      onChange(tokens.filter((t) => !(t === `campus:${c}`
        || (t.startsWith("college:") && effectiveCampus(getCollege(t.slice(8))?.campus) === c)
        || (t.startsWith("program:") && effectiveCampus(getCollege(getProgram(t.slice(8))?.college)?.campus) === c))))
    } else onChange([...tokens, `campus:${c}`])
  }
  const toggleCollege = (code: string) => {
    if (pickedColleges.some((c) => c.code === code)) {
      onChange(tokens.filter((t) => t !== `college:${code}` && !(t.startsWith("program:") && getProgram(t.slice(8))?.college === code)))
    } else onChange([...tokens, `college:${code}`])
  }

  const saved = parseAllowed(tokens)
  const hasRole = saved.some((t) => !t.includes(":"))

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input type="checkbox" className="size-4 accent-primary" checked={restricted} onChange={(e) => onRestrictedChange(e.target.checked)} />
        Restrict who can buy this product
      </label>
      {restricted && (
        <>
          <fieldset>
            <legend className="text-xs font-medium text-muted-foreground">Who</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {ROLE_TOKENS.map((r) => (
                <button key={r} type="button" aria-pressed={has(r)} onClick={() => toggle(r)} className={chip(has(r))}>{ROLE_TOKEN_LABELS[r]}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-medium text-muted-foreground">Only from (optional) — campus</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {STORE_CAMPUSES.map((c) => (
                <button key={c} type="button" aria-pressed={campuses.includes(c)} onClick={() => toggleCampus(c)} className={chip(campuses.includes(c))}>
                  {CAMPUS_LABELS[c]}
                </button>
              ))}
            </div>
          </fieldset>

          {colleges.length > 0 && (
            <fieldset>
              <legend className="text-xs font-medium text-muted-foreground">Narrow to colleges (optional)</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {colleges.map((c) => {
                  const on = pickedColleges.some((x) => x.code === c.code)
                  return <button key={c.code} type="button" aria-pressed={on} title={c.name} onClick={() => toggleCollege(c.code)} className={chip(on)}>{c.abbr}</button>
                })}
              </div>
            </fieldset>
          )}

          {pickedColleges.length > 0 && (
            <fieldset>
              <legend className="text-xs font-medium text-muted-foreground">Narrow to programs (optional)</legend>
              <div className="mt-1.5 space-y-2">
                {pickedColleges.map((c) => (
                  <div key={c.code} className="flex flex-wrap items-center gap-2">
                    <span className="w-14 shrink-0 text-[11px] font-semibold text-muted-foreground">{c.abbr}</span>
                    {programsFor(c.code).map((p) => (
                      <button key={p.code} type="button" aria-pressed={has(`program:${p.code}`)} title={p.name}
                        onClick={() => toggle(`program:${p.code}`)} className={chip(has(`program:${p.code}`))}>{p.abbr}</button>
                    ))}
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          <p className={cn("rounded-lg px-2.5 py-2 text-xs", hasRole ? "bg-card text-foreground" : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300")}>
            {hasRole ? <>Can buy: <strong>{describeAllowed(saved)}</strong></> : "Choose at least one group under Who."}
            {hasRole && saved.some((t) => t.includes(":")) && <span className="mt-0.5 block text-muted-foreground">Campus, college and program limits apply to verified university members.</span>}
          </p>
        </>
      )}
    </div>
  )
}
