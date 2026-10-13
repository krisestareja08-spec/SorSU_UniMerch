"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { Pencil, Printer, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PreorderFormDef, PreorderFormRow } from "@/lib/preorder-forms"
import { StatusBadges } from "@/components/store/preorder-forms-index"
import { cn } from "@/lib/utils"

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—")
const ymd = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * A pre-order completion form, laid out like the paper sheet: No., Name, Yr/Course, Contact Number,
 * Size / Quantity (qty) — one sub-column per product, grouped by the form's cells — Amount Paid,
 * Remarks (Purchased / Claimed) and Date. Searchable, filterable and printable.
 */
export function PreorderFormView({ form, storeName, rows: records, editHref, initialQuery = "" }: {
  form: PreorderFormDef; storeName: string; rows: PreorderFormRow[]; editHref: string; initialQuery?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<"all" | "purchased" | "claimed">("all")
  const [product, setProduct] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const products = useMemo(() => form.columns.flatMap((c) => c.products), [form])
  const q = query.trim().toLowerCase()
  const rows = records.filter((r) => {
    if (status === "purchased" && r.claimed) return false
    if (status === "claimed" && !r.claimed) return false
    if (product && !r.cells[product]) return false
    const when = ymd(r.claimedAt ?? r.purchasedAt ?? new Date().toISOString())
    if (from && when < from) return false
    if (to && when > to) return false
    return !q || [r.buyerName, r.course, r.contact, ...Object.values(r.cells)].some((v) => v?.toLowerCase().includes(q))
  })
  const filtered = !!(q || status !== "all" || product || from || to)
  const amount = rows.reduce((n, r) => n + r.amountPaid, 0)
  const claimed = rows.filter((r) => r.claimed).length
  const units = (id: string) => rows.reduce((n, r) => n + (r.quantities[id] ?? 0), 0)
  // A thicker line between Size / Qty cells, so "Polo · Blouse" read as one cell
  const cellStart = new Set(form.columns.map((c) => c.products[0]?.id))

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
          <div className="flex gap-2">
            <Button asChild variant="outline" className="gap-2"><Link href={editHref}><Pencil className="size-4" />Edit form</Link></Button>
            <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="size-4" />Print</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Remarks" className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
            {([["all", "All"], ["purchased", "Purchased, not claimed"], ["claimed", "Claimed"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setStatus(v)} aria-pressed={status === v}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", status === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>
          {products.length > 1 && (
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Product</span>
              <select value={product} onChange={(e) => setProduct(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
                <option value="">All products</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-2 text-sm" /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-2 text-sm" /></label>
          {filtered && (
            <button type="button" onClick={() => { setQuery(""); setStatus("all"); setProduct(""); setFrom(""); setTo("") }}
              className="h-9 rounded-lg px-2 text-xs font-medium text-primary hover:underline">Clear filters</button>
          )}
        </div>
      </div>

      {/* The form */}
      <section className="rounded-2xl border border-border bg-card print:rounded-none print:border-0">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{storeName} · Pre-order completion form</p>
            <h2 className="font-serif text-lg font-semibold">{form.title}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {rows.length} record{rows.length === 1 ? "" : "s"}{filtered ? ` (filtered from ${records.length})` : ""} · Date: {day(new Date().toISOString())}
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm print:text-xs" style={{ minWidth: `${36 + products.length * 5}rem` }}>
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="bg-muted/40 text-left">
                <th rowSpan={2} className="border-b border-border px-3 py-2 font-medium">No.</th>
                <th rowSpan={2} className="border-b border-border px-3 py-2 font-medium">Name</th>
                <th rowSpan={2} className="border-b border-border px-3 py-2 font-medium">Yr / Course</th>
                <th rowSpan={2} className="border-b border-border px-3 py-2 font-medium">Contact Number</th>
                <th colSpan={products.length} className="border-x border-b border-border px-3 py-2 text-center font-medium">Size / Quantity (qty)</th>
                <th rowSpan={2} className="border-b border-border px-3 py-2 text-right font-medium">Amount Paid</th>
                <th rowSpan={2} className="border-b border-border px-3 py-2 font-medium">Remarks</th>
                <th rowSpan={2} className="border-b border-border px-3 py-2 font-medium">Date</th>
              </tr>
              <tr className="bg-muted/40">
                {form.columns.map((c, ci) => (
                  <Fragment key={ci}>
                    {c.products.map((p, pi) => (
                      <th key={p.id} className={cn("border-b border-border px-2 py-1.5 text-center text-[11px] font-semibold normal-case tracking-normal text-foreground",
                        pi === 0 ? "border-l" : "border-l border-l-border/40", ci === form.columns.length - 1 && pi === c.products.length - 1 && "border-r")}>
                        {p.name}
                      </th>
                    ))}
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7 + products.length} className="px-3 py-10 text-center text-muted-foreground">
                  {records.length ? "No records match your search or filters." : "No records yet. Buyers appear here once their pre-order for these products is paid."}
                </td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.key} className="border-b border-border/60 last:border-0 print:break-inside-avoid">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.buyerName}</td>
                  <td className="px-3 py-2">{r.course ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.contact ?? <span className="text-muted-foreground">—</span>}</td>
                  {products.map((p) => (
                    <td key={p.id} className={cn("whitespace-nowrap px-2 py-2 text-center font-semibold tabular-nums", cellStart.has(p.id) ? "border-l border-border" : "border-l border-border/40")}>
                      {r.cells[p.id] ?? ""}
                    </td>
                  ))}
                  <td className="whitespace-nowrap border-l border-border px-3 py-2 text-right font-semibold tabular-nums">
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
                  <td className="px-3 py-2.5" colSpan={4}>Total · {claimed} of {rows.length} claimed</td>
                  {products.map((p) => (
                    <td key={p.id} className={cn("px-2 py-2.5 text-center tabular-nums", cellStart.has(p.id) ? "border-l border-border" : "border-l border-border/40")}>
                      {units(p.id) || ""}
                    </td>
                  ))}
                  <td className="border-l border-border px-3 py-2.5 text-right tabular-nums">{peso(amount)}</td>
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
