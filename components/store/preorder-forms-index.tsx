"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ClipboardList, Plus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const day = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })

export type FormSummary = {
  id: string; title: string; products: string[]
  records: number; waiting: number; ready: number; claimed: number; units: number; amount: number; updatedAt: string
}
/** A buyer row, for searching across every form */
export type FormRecord = {
  key: string; formId: string; formTitle: string; buyerName: string; course: string | null; contact: string | null; sizes: string
  claimed: boolean; stage: "waitlist" | "ready" | "claimed"
}

/** The shop's pre-order forms (live waitlists), a Create form button, and a search across all records. */
export function PreorderFormsIndex({ forms, records, unassigned, basePath }: {
  forms: FormSummary[]; records: FormRecord[]; unassigned: string[]; basePath: string
}) {
  const [query, setQuery] = useState("")
  const [show, setShow] = useState<"all" | "open" | "done">("all")
  const q = query.trim().toLowerCase()

  // Buyers matching the search, across all forms
  const matches = useMemo(() => !q ? [] : records.filter((r) =>
    [r.buyerName, r.contact, r.course, r.sizes].some((v) => v?.toLowerCase().includes(q))).slice(0, 50), [q, records])

  const visible = forms.filter((f) => {
    if (show === "open" && f.waiting + f.ready === 0) return false
    if (show === "done" && (f.records === 0 || f.waiting + f.ready > 0)) return false
    if (!q) return true
    return f.title.toLowerCase().includes(q) || f.products.some((p) => p.toLowerCase().includes(q)) || matches.some((m) => m.formId === f.id)
  })

  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild className="gap-2 sm:order-last"><Link href={`${basePath}/preorders/new`}><Plus className="size-4" />Create form</Link></Button>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search"
            placeholder="Search a form, product, buyer name, course or contact number"
            aria-label="Search pre-order forms and records"
            className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-9 text-sm" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
          )}
        </div>
        <div role="group" aria-label="Show forms" className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {([["all", "All"], ["open", "Has buyers waiting"], ["done", "All picked up"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setShow(v)} aria-pressed={show === v}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", show === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
      </div>

      {unassigned.length > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">
          <span className="font-semibold">Not in a form yet:</span> {unassigned.join(", ")}. Add them to a form so their buyers are recorded.
        </p>
      )}

      {/* Records found by the search */}
      {q && matches.length > 0 && (
        <section aria-labelledby="matches" className="rounded-2xl border border-border bg-card">
          <h2 id="matches" className="border-b border-border px-4 py-2.5 text-sm font-semibold">Records found ({matches.length}{matches.length === 50 ? "+" : ""})</h2>
          <ul className="divide-y divide-border">
            {matches.map((r) => (
              <li key={r.key}>
                <Link href={`${basePath}/preorders/${r.formId}?q=${encodeURIComponent(r.buyerName)}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-muted/40">
                  <span className="min-w-0">
                    <span className="font-medium">{r.buyerName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{r.formTitle} · {r.sizes}</span>
                  </span>
                  <StageBadge stage={r.stage} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The forms */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <ClipboardList className="mx-auto mb-2 size-8 text-muted-foreground/40" />
          {forms.length === 0 ? (
            <>
              <p>No forms yet. Create one, e.g. &ldquo;School Uniform&rdquo; with Polo / Blouse and Pants / Skirt. Buyers who paid half or in full are listed in queue order.</p>
              <Button asChild size="sm" className="mt-3 gap-2"><Link href={`${basePath}/preorders/new`}><Plus className="size-4" />Create form</Link></Button>
            </>
          ) : "No forms match your search."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((f) => (
            <Link key={f.id} href={`${basePath}/preorders/${f.id}${q && !f.title.toLowerCase().includes(q) ? `?q=${encodeURIComponent(query.trim())}` : ""}`}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:shadow-sm">
              <p className="font-serif text-base font-semibold leading-tight">{f.title}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{f.products.join(" · ")}</p>
              <p className="text-xs text-muted-foreground">{f.records} buyer{f.records === 1 ? "" : "s"} · {f.units} unit{f.units === 1 ? "" : "s"} · {peso(f.amount)} paid</p>
              <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">{f.waiting} waiting</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{f.ready} ready</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{f.claimed} claimed</span>
                <span className="text-muted-foreground">· Updated {day(f.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function StageBadge({ stage }: { stage: "waitlist" | "ready" | "claimed" }) {
  const [label, tone] = stage === "claimed" ? ["Claimed", "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"]
    : stage === "ready" ? ["Ready for pick up", "bg-primary/10 text-primary"] : ["Waitlist", "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"]
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>{label}</span>
}

export function StatusBadges({ claimed, purchasedAt, claimedAt }: { claimed: boolean; purchasedAt?: string | null; claimedAt?: string | null }) {
  return (
    <span className="flex flex-wrap gap-1">
      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">
        Purchased{purchasedAt ? ` ${new Date(purchasedAt).toLocaleDateString("en-PH", { month: "numeric", day: "numeric" })}` : ""}
      </span>
      {claimed && (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          Claimed{claimedAt ? ` ${new Date(claimedAt).toLocaleDateString("en-PH", { month: "numeric", day: "numeric" })}` : ""}
        </span>
      )}
    </span>
  )
}
