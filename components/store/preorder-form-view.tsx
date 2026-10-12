"use client"

import { useMemo, useState } from "react"
import { Printer, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PreorderRecord } from "@/lib/preorder-forms"
import { StatusBadges } from "@/components/store/preorder-forms-index"
import { cn } from "@/lib/utils"

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—")
const ymd = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
/** The sizes / variations in a record, e.g. "M × 2, L × 1" → ["M", "L"] */
const sizesOf = (r: PreorderRecord) => r.variation.split(", ").map((p) => p.replace(/\s*× \d+$/, "").trim()).filter(Boolean)

/**
 * One product's pre-order completion form: No., Name, Yr/Course, Contact No., Qty/Size,
 * Amount Paid, Remarks (Purchased / Claimed) and Date — searchable, filterable and printable.
 */
export function PreorderFormView({ productName, storeName, records, initialQuery = "" }: {
  productName: string; storeName: string; records: PreorderRecord[]; initialQuery?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<"all" | "purchased" | "claimed">("all")
  const [size, setSize] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const sizes = useMemo(() => [...new Set(records.flatMap(sizesOf))].sort(), [records])
  const q = query.trim().toLowerCase()
  const rows = records.filter((r) => {
    if (status === "purchased" && r.claimed) return false
    if (status === "claimed" && !r.claimed) return false
    if (size && !sizesOf(r).includes(size)) return false
    const when = ymd(r.claimedAt ?? r.purchasedAt ?? r.orderedAt)
    if (from && when < from) return false
    if (to && when > to) return false
    return !q || [r.buyerName, r.course, r.contact, r.variation].some((v) => v?.toLowerCase().includes(q))
  })
  const filtered = !!(q || status !== "all" || size || from || to)
  const totals = rows.reduce((t, r) => ({ units: t.units + r.quantity, amount: t.amount + r.amountPaid, claimed: t.claimed + (r.claimed ? 1 : 0) }), { units: 0, amount: 0, claimed: 0 })

  return (
    <div className="mt-5 space-y-4">
      {/* Tools (not printed) */}
      <div className="space-y-3 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search name, course, contact number or size"
              aria-label="Search this form" className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-9 text-sm" />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            )}
          </div>
          <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="size-4" />Print form</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Remarks" className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
            {([["all", "All"], ["purchased", "Purchased, not claimed"], ["claimed", "Claimed"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setStatus(v)} aria-pressed={status === v}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", status === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>
          {sizes.length > 1 && (
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Size / variation</span>
              <select value={size} onChange={(e) => setSize(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
                <option value="">All sizes</option>
                {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-2 text-sm" /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-2 text-sm" /></label>
          {filtered && (
            <button type="button" onClick={() => { setQuery(""); setStatus("all"); setSize(""); setFrom(""); setTo("") }}
              className="h-9 rounded-lg px-2 text-xs font-medium text-primary hover:underline">Clear filters</button>
          )}
        </div>
      </div>

      {/* The form */}
      <section className="rounded-2xl border border-border bg-card print:rounded-none print:border-0">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{storeName} · Pre-order completion form</p>
            <h2 className="font-serif text-lg font-semibold">{productName}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {rows.length} record{rows.length === 1 ? "" : "s"}{filtered ? ` (filtered from ${records.length})` : ""} · Date: {day(new Date().toISOString())}
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-sm print:min-w-0">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">No.</th>
                <th className="px-3 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Yr / Course</th>
                <th className="px-3 py-2.5 font-medium">Contact No.</th>
                <th className="px-3 py-2.5 font-medium">Qty / Size</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount Paid</th>
                <th className="px-3 py-2.5 font-medium">Remarks</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">{records.length ? "No records match your search or filters." : "No records yet."}</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.key} className="border-b border-border/60 last:border-0 print:break-inside-avoid">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.buyerName}</td>
                  <td className="px-3 py-2">{r.course ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.contact ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2">{r.variation}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                    {peso(r.amountPaid)}{r.partial && <span className="block text-[11px] font-normal text-amber-700 dark:text-amber-300">partly paid</span>}
                  </td>
                  <td className="px-3 py-2"><StatusBadges claimed={r.claimed} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {r.claimed ? <>Claimed {day(r.claimedAt)}<span className="block text-muted-foreground">Purchased {day(r.purchasedAt)}</span></> : <>Purchased {day(r.purchasedAt)}</>}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-border bg-muted/30 text-sm font-semibold">
                  <td className="px-3 py-2.5" colSpan={4}>Total · {totals.claimed} of {rows.length} claimed</td>
                  <td className="px-3 py-2.5">{totals.units} unit{totals.units === 1 ? "" : "s"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{peso(totals.amount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  )
}
