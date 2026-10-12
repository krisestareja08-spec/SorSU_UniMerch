"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ClipboardList, Package, Search, X } from "lucide-react"
import type { PreorderForm, PreorderRecord } from "@/lib/preorder-forms"
import { cn } from "@/lib/utils"
import { formKey } from "@/lib/preorder-key"

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const day = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })

/** All pre-order forms (one per product) with a search across every record. */
export function PreorderFormsIndex({ forms, records, basePath }: { forms: PreorderForm[]; records: PreorderRecord[]; basePath: string }) {
  const [query, setQuery] = useState("")
  const [show, setShow] = useState<"all" | "open" | "done">("all")
  const q = query.trim().toLowerCase()

  // Buyers matching the search, across all forms
  const matches = useMemo(() => !q ? [] : records.filter((r) =>
    [r.buyerName, r.contact, r.course, r.variation].some((v) => v?.toLowerCase().includes(q))).slice(0, 50), [q, records])

  const visible = forms.filter((f) => {
    if (show === "open" && f.claimed >= f.records) return false
    if (show === "done" && f.claimed < f.records) return false
    if (!q) return true
    return f.productName.toLowerCase().includes(q) || matches.some((m) => formKey(m) === formKey(f))
  })

  return (
    <div className="mt-5 space-y-5">
      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search"
            placeholder="Search a product, buyer name, course or contact number"
            aria-label="Search pre-order forms and records"
            className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-9 text-sm" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
          )}
        </div>
        <div role="group" aria-label="Show forms" className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {([["all", "All"], ["open", "Not all claimed"], ["done", "All claimed"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setShow(v)} aria-pressed={show === v}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", show === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
      </div>

      {/* Records found by the search */}
      {q && matches.length > 0 && (
        <section aria-labelledby="matches" className="rounded-2xl border border-border bg-card">
          <h2 id="matches" className="border-b border-border px-4 py-2.5 text-sm font-semibold">Records found ({matches.length}{matches.length === 50 ? "+" : ""})</h2>
          <ul className="divide-y divide-border">
            {matches.map((r) => (
              <li key={r.key}>
                <Link href={`${basePath}/preorders/${formKey(r)}?q=${encodeURIComponent(r.buyerName)}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-muted/40">
                  <span className="min-w-0">
                    <span className="font-medium">{r.buyerName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{r.productName} · {r.variation}</span>
                  </span>
                  <StatusBadges claimed={r.claimed} />
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
          {forms.length === 0 ? "No purchased or claimed pre-orders yet. A form appears here for each pre-ordered product once its first pre-order is paid." : "No forms match your search."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((f) => (
            <Link key={formKey(f)} href={`${basePath}/preorders/${formKey(f)}${q && !f.productName.toLowerCase().includes(q) ? `?q=${encodeURIComponent(query.trim())}` : ""}`}
              className="flex gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:shadow-sm">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                {f.image ? <Image src={f.image} alt="" fill className="object-cover" sizes="64px" /> : <Package className="m-auto mt-5 size-6 text-muted-foreground/40" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{f.productName}</p>
                <p className="text-xs text-muted-foreground">{f.records} record{f.records === 1 ? "" : "s"} · {f.units} unit{f.units === 1 ? "" : "s"} · {peso(f.amount)}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("rounded-full px-2 py-0.5 font-semibold", f.claimed >= f.records ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300")}>
                    {f.claimed}/{f.records} claimed
                  </span>
                  <span className="text-muted-foreground">Updated {day(f.lastActivity)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
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
