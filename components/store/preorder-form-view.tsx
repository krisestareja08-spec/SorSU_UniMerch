"use client"

import { Fragment, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, ChevronLeft, ChevronRight, Download, Loader2, Pencil, Printer, Search, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductThumb } from "@/components/ui/product-thumb"
import type { FormStock, PreorderFormDef, PreorderFormRow, PreorderStage } from "@/lib/preorder-form-shape"
import { markPreordersReady } from "@/app/preorder-form-actions"
import type { ModuleKey } from "@/lib/modules"
import { unwrap } from "@/lib/action-result"
import { toast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const fmtDay = (d: Date) => d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
const prettyPickup = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })

type Period = "day" | "week" | "month" | "all"
const TABS: { id: PreorderStage; label: string }[] = [
  { id: "waitlist", label: "Waitlist" }, { id: "ready", label: "Ready for pick up" }, { id: "claimed", label: "History" },
]

/** [start, end) of the day / week (Monday) / month that contains `anchor` */
function range(period: Period, anchor: Date): [Date, Date] | null {
  if (period === "all") return null
  const s = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  if (period === "week") s.setDate(s.getDate() - ((s.getDay() + 6) % 7))
  if (period === "month") s.setDate(1)
  const e = new Date(s)
  if (period === "day") e.setDate(e.getDate() + 1)
  else if (period === "week") e.setDate(e.getDate() + 7)
  else e.setMonth(e.getMonth() + 1)
  return [s, e]
}
function shift(period: Period, anchor: Date, dir: number) {
  const d = new Date(anchor)
  if (period === "day") d.setDate(d.getDate() + dir)
  else if (period === "week") d.setDate(d.getDate() + 7 * dir)
  else if (period === "month") d.setMonth(d.getMonth() + dir)
  return d
}
function periodLabel(period: Period, r: [Date, Date] | null) {
  if (!r) return "All dates"
  const last = new Date(r[1]); last.setDate(last.getDate() - 1)
  if (period === "day") return fmtDay(r[0])
  if (period === "month") return r[0].toLocaleDateString("en-PH", { month: "long", year: "numeric" })
  return `${r[0].toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – ${fmtDay(last)}`
}

/** "M" size key of a line: product + size */
const sizeKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ""}`

function remarks(r: PreorderFormRow) {
  if (r.stage === "claimed") return "Purchased & Claimed"
  if (r.stage === "ready") return `Ready for pick up${r.pickupDate ? ` · ${prettyPickup(r.pickupDate)}` : ""}`
  return `Waitlist · ${r.partial ? "half paid" : "paid in full"}`
}

/**
 * A pre-order form, laid out like the paper sheet — Queue No., Name, Yr/Course, Contact Number,
 * Size / Quantity (qty) with a sub-column per product, Amount Paid, Remarks and Date — and the live
 * waitlist: buyers who paid half or full, in queue order. Select buyers whose size arrived and mark
 * them ready (they're notified). Picked-up orders move to History. Per day / week / month, with
 * search and filters; downloads as Excel, prints as PDF.
 */
export function PreorderFormView({ form, storeName, rows: records, stock, module, editHref, initialQuery = "" }: {
  form: PreorderFormDef; storeName: string; rows: PreorderFormRow[]; stock: FormStock; module: ModuleKey; editHref: string; initialQuery?: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<PreorderStage>("waitlist")
  const [period, setPeriod] = useState<Period>("week")
  const [anchor, setAnchor] = useState(() => new Date())
  const [query, setQuery] = useState(initialQuery)
  const [product, setProduct] = useState("")
  const [size, setSize] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()
  const [downloading, setDownloading] = useState(false)

  const products = useMemo(() => form.columns.flatMap((c) => c.products), [form])
  const cellStart = new Set(form.columns.map((c) => c.products[0]?.id))
  const span = range(period, anchor)
  const when = (r: PreorderFormRow) => new Date(r.stage === "claimed" ? r.claimedAt ?? r.orderedAt : r.orderedAt)
  const inPeriod = (r: PreorderFormRow) => !span || (when(r) >= span[0] && when(r) < span[1])

  // Sizes that can be filtered on: every size of the form's products, plus sizes buyers ordered
  const sizeOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of products) {
      const st = stock[p.id]
      if (st?.sizes.length) for (const s of st.sizes) m.set(sizeKey(p.id, s.id), `${p.name} · ${s.name}`)
      else m.set(sizeKey(p.id, null), p.name)
    }
    for (const r of records) for (const s of r.sizes) if (!m.has(sizeKey(s.productId, s.variantId))) {
      m.set(sizeKey(s.productId, s.variantId), `${products.find((p) => p.id === s.productId)?.name ?? "Item"}${s.variant ? ` · ${s.variant}` : ""}`)
    }
    return [...m]
  }, [products, stock, records])

  const stockOf = (key: string) => {
    const [pid, vid] = key.split(":")
    const st = stock[pid]
    if (!st) return 0
    return vid ? st.sizes.find((s) => s.id === vid)?.stock ?? 0 : st.stock
  }
  // Units of a size that buyers still on the waitlist are waiting for
  const waiting = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of records) if (r.stage === "waitlist") for (const s of r.sizes) m.set(sizeKey(s.productId, s.variantId), (m.get(sizeKey(s.productId, s.variantId)) ?? 0) + s.quantity)
    return m
  }, [records])

  const q = query.trim().toLowerCase()
  const matchesFilters = (r: PreorderFormRow) => {
    if (product && !r.cells[product]) return false
    if (size && !r.sizes.some((s) => sizeKey(s.productId, s.variantId) === size)) return false
    return !q || [r.buyerName, r.course, r.contact, ...Object.values(r.cells)].some((v) => v?.toLowerCase().includes(q))
  }
  const ofTab = records.filter((r) => r.stage === tab)
  const rows = ofTab.filter((r) => inPeriod(r) && matchesFilters(r))
    .sort((a, b) => tab === "claimed" ? when(b).getTime() - when(a).getTime() : (a.queueNo ?? 0) - (b.queueNo ?? 0))
  const outside = ofTab.filter((r) => !inPeriod(r) && matchesFilters(r)).length
  const counts = Object.fromEntries(TABS.map((t) => [t.id, records.filter((r) => r.stage === t.id).length])) as Record<PreorderStage, number>
  const filtered = !!(q || product || size)

  // ── Batch select (waitlist) ──
  const selectable = tab === "waitlist"
  const allShown = rows.length > 0 && rows.every((r) => selected.has(r.orderId))
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = () => setSelected((s) => { const n = new Set(s); for (const r of rows) { if (allShown) n.delete(r.orderId); else n.add(r.orderId) } return n })
  // What the selection needs vs. what's in stock, per size
  const shortfalls = useMemo(() => {
    const need = new Map<string, number>()
    for (const r of records) if (selected.has(r.orderId) && r.stage === "waitlist") for (const s of r.sizes) need.set(sizeKey(s.productId, s.variantId), (need.get(sizeKey(s.productId, s.variantId)) ?? 0) + s.quantity)
    return [...need].filter(([k, n]) => n > stockOf(k)).map(([k, n]) => `${sizeOptions.find(([key]) => key === k)?.[1] ?? "Item"}: ${n} needed, ${stockOf(k)} in stock`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, records, stock, sizeOptions])

  /** Selects waitlisted buyers of the chosen size, in queue order, as far as its stock goes */
  function fillStock() {
    if (!size) return
    let left = stockOf(size)
    const pick = new Set<string>()
    for (const r of ofTab.filter(matchesFilters).sort((a, b) => (a.queueNo ?? 0) - (b.queueNo ?? 0))) {
      const need = r.sizes.filter((s) => sizeKey(s.productId, s.variantId) === size).reduce((n, s) => n + s.quantity, 0)
      if (need === 0 || need > left) continue
      left -= need
      pick.add(r.orderId)
    }
    setSelected(pick)
    if (pick.size === 0) toast({ title: "Not enough stock for anyone in the queue yet", variant: "info" })
  }

  function markReady() {
    const ids = [...selected].filter((id) => records.some((r) => r.orderId === id && r.stage === "waitlist"))
    if (ids.length === 0) return
    start(async () => {
      try {
        const { updated, skipped } = unwrap(await markPreordersReady({ module, orderIds: ids }))
        toast({ title: `${updated} buyer${updated === 1 ? "" : "s"} notified — ready for pick up`, description: skipped ? `${skipped} were no longer on the waitlist.` : undefined })
        setSelected(new Set())
        router.refresh()
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Couldn't mark them ready.", variant: "error" })
      }
    })
  }

  // ── Excel download of what's shown (tab + period + filters) ──
  async function download() {
    setDownloading(true)
    try {
      const ExcelJS = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()
      const tabLabel = TABS.find((t) => t.id === tab)!.label
      const ws = wb.addWorksheet(tabLabel.slice(0, 31))
      const fixedBefore = ["Queue No.", "Name", "Yr / Course", "Contact Number"]
      const fixedAfter = ["Amount Paid", "Remarks", "Date"]
      const width = fixedBefore.length + products.length + fixedAfter.length
      ws.addRow([`${storeName} · Pre-order Form`]).font = { bold: true, size: 13 }
      ws.addRow([`${form.title} — ${tabLabel} — ${periodLabel(period, span)}`]).font = { italic: true }
      ws.mergeCells(1, 1, 1, width); ws.mergeCells(2, 1, 2, width)
      const h1 = ws.addRow([...fixedBefore, "Size / Quantity (qty)", ...Array(Math.max(0, products.length - 1)).fill(""), ...fixedAfter])
      const h2 = ws.addRow([...fixedBefore.map(() => ""), ...products.map((p) => p.name), ...fixedAfter.map(() => "")])
      const r1 = h1.number, r2 = h2.number
      fixedBefore.forEach((_, i) => ws.mergeCells(r1, i + 1, r2, i + 1))
      if (products.length) ws.mergeCells(r1, fixedBefore.length + 1, r1, fixedBefore.length + products.length)
      fixedAfter.forEach((_, i) => { const c = fixedBefore.length + products.length + i + 1; ws.mergeCells(r1, c, r2, c) })
      for (const row of [h1, h2]) row.eachCell((c) => {
        c.font = { bold: true }; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1EDE4" } }
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
      })
      for (const r of rows) {
        const line = ws.addRow([
          r.queueNo ?? "", r.buyerName, r.course ?? "", r.contact ?? "",
          ...products.map((p) => r.cells[p.id] ?? ""),
          r.amountPaid, remarks(r), fmtWhen(r.stage === "claimed" ? r.claimedAt ?? r.orderedAt : r.orderedAt),
        ])
        line.getCell(fixedBefore.length + products.length + 1).numFmt = '"₱"#,##0.00'
        line.eachCell({ includeEmpty: true }, (c) => { c.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "thin" }, right: { style: "thin" } } })
      }
      const totals = ws.addRow(["", `Total · ${rows.length} buyer${rows.length === 1 ? "" : "s"}`, "", "",
        ...products.map((p) => rows.reduce((n, r) => n + (r.quantities[p.id] ?? 0), 0) || ""),
        rows.reduce((n, r) => n + r.amountPaid, 0), "", ""])
      totals.font = { bold: true }
      totals.getCell(fixedBefore.length + products.length + 1).numFmt = '"₱"#,##0.00'
      ws.columns.forEach((col, i) => { col.width = i === 1 ? 26 : i === 0 ? 10 : i < fixedBefore.length ? 16 : i < fixedBefore.length + products.length ? 11 : i === width - 2 ? 30 : 18 })
      const buf = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `${form.title} - ${tabLabel} - ${periodLabel(period, span)}.xlsx`.replace(/[\\/:*?"<>|]/g, "-")
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      toast({ title: "The Excel file couldn't be made. Please try again.", variant: "error" })
    } finally {
      setDownloading(false)
    }
  }

  const colSpan = (selectable ? 8 : 7) + products.length
  const dateOf = (r: PreorderFormRow) => fmtWhen(r.stage === "claimed" ? r.claimedAt ?? r.orderedAt : r.orderedAt)
  const emptyText = records.length === 0 ? "No paid pre-orders yet. Buyers appear here once they pay half or in full."
    : filtered ? "No buyers match your search or filters." : `No one ${tab === "claimed" ? "picked up" : "here"} in this period.`

  return (
    <div className="mt-5 space-y-4">
      {/* Stock per size vs. who's waiting (not printed) */}
      <section aria-labelledby="stock-heading" className="print:hidden">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="stock-heading" className="text-sm font-semibold">Stock &amp; waitlist</h2>
          <p className="text-xs text-muted-foreground">Tap a size to see who&apos;s waiting for it</p>
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {products.map((p) => {
            const st = stock[p.id]
            const sizes = st?.sizes.length ? st.sizes.map((s) => ({ key: sizeKey(p.id, s.id), name: s.name, stock: s.stock })) : [{ key: sizeKey(p.id, null), name: "", stock: st?.stock ?? 0 }]
            return (
              <div key={p.id} className="w-64 shrink-0 rounded-xl border border-border bg-card p-3 sm:w-auto sm:min-w-56 sm:max-w-sm">
                <div className="flex items-center gap-2.5">
                  <ProductThumb src={st?.image} alt={p.name} size="sm" />
                  <p className="min-w-0 truncate text-sm font-semibold">{p.name}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sizes.map((s) => {
                    const w = waiting.get(s.key) ?? 0
                    return (
                      <button key={s.key} type="button" aria-pressed={size === s.key} onClick={() => { setSize(size === s.key ? "" : s.key); setTab("waitlist") }}
                        className={cn("rounded-lg border px-2 py-1 text-left text-[11px] leading-tight transition-colors",
                          size === s.key ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : w > s.stock ? "border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10" : "border-border hover:bg-muted")}>
                        <span className="block text-xs font-semibold">{s.name || "Stock"}</span>
                        <span className="tabular-nums text-muted-foreground">
                          <span className={cn("font-semibold", s.stock > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>{s.stock}</span> in stock
                          {w > 0 && <> · <span className="font-semibold text-foreground">{w}</span> waiting</>}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Tools (not printed) */}
      <div className="space-y-3 print:hidden">
        <div role="tablist" aria-label="Form" className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setSelected(new Set()) }}
              className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-1 py-1.5 text-sm font-medium transition-colors", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <span className="truncate">{t.label}</span>
              {counts[t.id] > 0 && <span className={cn("min-w-5 rounded-full px-1.5 text-[11px] font-bold leading-5", t.id === "waitlist" ? "bg-gold text-primary" : "bg-muted text-muted-foreground")}>{counts[t.id]}</span>}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Period" className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
            {(["day", "week", "month", "all"] as const).map((p) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => { setPeriod(p); setAnchor(new Date()) }}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize", period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {p === "all" ? "All" : p}
              </button>
            ))}
          </div>
          {period !== "all" && (
            <div className="flex items-center gap-1">
              <Button type="button" size="icon" variant="outline" className="size-8" aria-label="Previous" onClick={() => setAnchor((a) => shift(period, a, -1))}><ChevronLeft className="size-4" /></Button>
              <span className="min-w-32 text-center text-sm font-medium">{periodLabel(period, span)}</span>
              <Button type="button" size="icon" variant="outline" className="size-8" aria-label="Next" onClick={() => setAnchor((a) => shift(period, a, 1))}><ChevronRight className="size-4" /></Button>
            </div>
          )}
          <div className="ml-auto flex gap-1.5">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={download} disabled={downloading} aria-label="Download Excel">
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}<span className="hidden sm:inline">Excel</span>
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()} aria-label="Print"><Printer className="size-4" /><span className="hidden sm:inline">Print</span></Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5"><Link href={editHref} aria-label="Edit form"><Pencil className="size-4" /><span className="hidden sm:inline">Edit</span></Link></Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search name, course, contact number or size"
              aria-label="Search this form" className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm" />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            )}
          </div>
          <div className="flex gap-2">
            {products.length > 1 && (
              <select value={product} onChange={(e) => setProduct(e.target.value)} aria-label="Product" className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm sm:flex-none">
                <option value="">All products</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <select value={size} onChange={(e) => setSize(e.target.value)} aria-label="Size" className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm sm:flex-none">
              <option value="">All sizes</option>
              {sizeOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          {filtered && (
            <button type="button" onClick={() => { setQuery(""); setProduct(""); setSize("") }} className="h-9 self-start px-2 text-xs font-medium text-primary hover:underline sm:self-auto">Clear filters</button>
          )}
        </div>

        {selectable && counts.waitlist > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <p className="min-w-0 flex-1 text-muted-foreground">
              {size ? <>Select the waiting buyers of <span className="font-semibold text-foreground">{sizeOptions.find(([k]) => k === size)?.[1]}</span> in queue order, as far as the stock goes.</>
                : <>When a size arrives, tap it above (or tick buyers below), then <span className="font-semibold text-foreground">mark them ready</span>. They&apos;re notified to choose a pick-up day.</>}
            </p>
            {size && (
              <Button type="button" size="sm" variant="outline" className="gap-1.5 bg-card" onClick={fillStock}>
                Fill from stock ({stockOf(size)})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* The form */}
      <section className="rounded-2xl border border-border bg-card print:rounded-none print:border-0">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{storeName} · Pre-order form · {TABS.find((t) => t.id === tab)!.label}</p>
            <h2 className="font-serif text-lg font-semibold">{form.title}</h2>
          </div>
          <p className="text-xs text-muted-foreground">{periodLabel(period, span)} · {rows.length} buyer{rows.length === 1 ? "" : "s"}{filtered ? " (filtered)" : ""}</p>
        </header>

        {/* Phones: one card per buyer */}
        <div className="md:hidden print:hidden">
          {selectable && rows.length > 0 && (
            <label className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
              <input type="checkbox" checked={allShown} onChange={toggleAll} className="size-5 accent-primary" />Select all shown
            </label>
          )}
          {rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyText}</p> : (
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const Wrap = selectable ? "label" : "div"
                return (
                  <li key={r.key}>
                    <Wrap className={cn("flex gap-3 px-4 py-3", selectable && "cursor-pointer", selected.has(r.orderId) && "bg-primary/5")}>
                      {selectable && <input type="checkbox" checked={selected.has(r.orderId)} onChange={() => toggle(r.orderId)} aria-label={`Select ${r.buyerName}`} className="mt-0.5 size-5 shrink-0 accent-primary" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 font-semibold">
                            {r.queueNo != null && <span className="mr-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums">#{r.queueNo}</span>}{r.buyerName}
                          </p>
                          <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
                            {peso(r.amountPaid)}{r.partial && <span className="block text-[11px] font-normal text-amber-700 dark:text-amber-300">{peso(r.share - r.amountPaid)} due</span>}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">{[r.course, r.contact].filter(Boolean).join(" · ") || "No course or contact number"}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {products.filter((p) => r.cells[p.id]).map((p) => (
                            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background py-0.5 pl-0.5 pr-2 text-xs">
                              <ProductThumb src={stock[p.id]?.image} alt="" size="xs" className="size-6 rounded" />
                              <span className="text-muted-foreground">{p.name}</span><span className="font-semibold tabular-nums">{r.cells[p.id]}</span>
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <Remark r={r} /><span className="text-[11px] text-muted-foreground">{dateOf(r)}</span>
                        </div>
                      </div>
                    </Wrap>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Larger screens and print: the sheet */}
        <div className="hidden overflow-x-auto md:block print:block">
          <table className="w-full border-collapse text-sm print:text-xs" style={{ minWidth: `${38 + products.length * 5}rem` }}>
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="bg-muted/40 text-left">
                {selectable && (
                  <th rowSpan={2} className="border-b border-border px-3 py-2 print:hidden">
                    <input type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Select all shown" className="size-4 accent-primary" />
                  </th>
                )}
                <th rowSpan={2} className="border-b border-border px-3 py-2 font-medium">Queue No.</th>
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
                        <span className="flex flex-col items-center gap-1">
                          <ProductThumb src={stock[p.id]?.image} alt="" size="xs" className="print:hidden" />{p.name}
                        </span>
                      </th>
                    ))}
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={colSpan} className="px-3 py-10 text-center text-muted-foreground">{emptyText}</td></tr>}
              {rows.map((r) => (
                <tr key={r.key} onClick={selectable ? () => toggle(r.orderId) : undefined}
                  className={cn("border-b border-border/60 last:border-0 print:break-inside-avoid", selectable && "cursor-pointer hover:bg-muted/30", selected.has(r.orderId) && "bg-primary/5 hover:bg-primary/5")}>
                  {selectable && (
                    <td className="px-3 py-2 print:hidden">
                      <input type="checkbox" checked={selected.has(r.orderId)} onChange={() => toggle(r.orderId)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${r.buyerName}`} className="size-4 accent-primary" />
                    </td>
                  )}
                  <td className="px-3 py-2 font-semibold tabular-nums">{r.queueNo ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{r.buyerName}</td>
                  <td className="px-3 py-2">{r.course ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.contact ?? <span className="text-muted-foreground">—</span>}</td>
                  {products.map((p) => (
                    <td key={p.id} className={cn("whitespace-nowrap px-2 py-2 text-center font-semibold tabular-nums", cellStart.has(p.id) ? "border-l border-border" : "border-l border-border/40")}>
                      {r.cells[p.id] ?? ""}
                    </td>
                  ))}
                  <td className="whitespace-nowrap border-l border-border px-3 py-2 text-right font-semibold tabular-nums">
                    {peso(r.amountPaid)}{r.partial && <span className="block text-[11px] font-normal text-amber-700 dark:text-amber-300">half · {peso(r.share - r.amountPaid)} due</span>}
                  </td>
                  <td className="px-3 py-2"><Remark r={r} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{dateOf(r)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-border bg-muted/30 text-sm font-semibold">
                  <td className="px-3 py-2.5" colSpan={selectable ? 5 : 4}>Total · {rows.length} buyer{rows.length === 1 ? "" : "s"}</td>
                  {products.map((p) => (
                    <td key={p.id} className={cn("px-2 py-2.5 text-center tabular-nums", cellStart.has(p.id) ? "border-l border-border" : "border-l border-border/40")}>
                      {rows.reduce((n, r) => n + (r.quantities[p.id] ?? 0), 0) || ""}
                    </td>
                  ))}
                  <td className="border-l border-border px-3 py-2.5 text-right tabular-nums">{peso(rows.reduce((n, r) => n + r.amountPaid, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Batch action: stays in view while buyers are selected */}
      {selectable && selected.size > 0 && (
        <div className="sticky bottom-20 z-20 lg:bottom-4 print:hidden">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-card/95 p-3 shadow-lg backdrop-blur">
            <p className="text-sm font-semibold">{selected.size} selected</p>
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">Clear</button>
            <Button type="button" size="sm" className="ml-auto gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" disabled={pending} onClick={markReady}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}Mark ready &amp; notify
            </Button>
            {shortfalls.length > 0 && (
              <p role="alert" className="w-full text-xs text-amber-700 dark:text-amber-300">
                More than in stock: {shortfalls.join("; ")}. Stock isn&apos;t held, so whoever picks up first gets it and the rest go back to the waitlist when it runs out.
              </p>
            )}
          </div>
        </div>
      )}

      {outside > 0 && (
        <p className="text-center text-xs text-muted-foreground print:hidden">
          {outside} more {tab === "claimed" ? "picked up" : "in this list"} outside {periodLabel(period, span)} ·{" "}
          <button type="button" onClick={() => setPeriod("all")} className="font-medium text-primary hover:underline">Show all dates</button>
        </p>
      )}
    </div>
  )
}

function Remark({ r }: { r: PreorderFormRow }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold",
      r.stage === "claimed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
        : r.stage === "ready" ? "bg-primary/10 text-primary" : "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300")}>
      {remarks(r)}
    </span>
  )
}
