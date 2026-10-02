"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

/** Value formats (named, so server pages can pass them to this client component). */
export type ValueFormat = "peso" | "number"
function fmt(kind: ValueFormat, n: number) {
  return kind === "peso"
    ? `₱${n.toLocaleString("en-PH", { maximumFractionDigits: n >= 1000 ? 0 : 2 })}`
    : n.toLocaleString("en-PH", { maximumFractionDigits: 0 })
}

/**
 * Single-series column chart (one measure over time). The chart title names the series, so no
 * legend; a per-bar hover tooltip shows the exact value; a table view sits alongside in the page.
 * Marks: thin columns with a 4px rounded top anchored to the baseline, 2px gaps, recessive axis.
 */
export function ColumnChart({
  data,
  format: kind = "number",
  ariaLabel,
  height = 180,
}: {
  data: { label: string; value: number }[]
  format?: ValueFormat
  ariaLabel: string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const format = (n: number) => fmt(kind, n)
  const max = Math.max(...data.map((d) => d.value), 0)
  const top = max > 0 ? niceCeil(max) : 1

  return (
    <figure aria-label={ariaLabel} className="w-full">
      <div className="relative flex gap-2" style={{ height }}>
        {/* y-axis: top value + baseline, recessive */}
        <div className="flex w-14 shrink-0 flex-col justify-between py-0 text-right text-[10px] text-muted-foreground">
          <span>{format(top)}</span>
          <span>{format(top / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative flex flex-1 items-end gap-0.5 border-b border-border">
          {/* gridlines */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border/60" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border/60" />
          {data.map((d, i) => {
            const h = top > 0 ? (d.value / top) * 100 : 0
            return (
              <button
                key={d.label + i}
                type="button"
                aria-label={`${d.label}: ${format(d.value)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="relative flex h-full flex-1 items-end justify-center outline-none"
              >
                <span
                  className={cn("block w-full max-w-10 rounded-t-[4px] bg-primary transition-opacity", hover !== null && hover !== i && "opacity-40")}
                  style={{ height: `${Math.max(h, d.value > 0 ? 1.5 : 0)}%` }}
                />
                {hover === i && (
                  <span role="tooltip" className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[11px] shadow-md">
                    <span className="block text-muted-foreground">{d.label}</span>
                    <span className="font-semibold text-foreground">{format(d.value)}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div className="ml-16 mt-1 flex gap-0.5">
        {data.map((d, i) => (
          <span key={d.label + i} className="flex-1 truncate text-center text-[10px] text-muted-foreground">{d.label}</span>
        ))}
      </div>
    </figure>
  )
}

/** Ranked horizontal bars (e.g. top sellers). Values are printed as text; bars carry magnitude. */
export function RankedBars({
  rows,
  format: kind = "number",
  empty = "No data yet.",
}: {
  rows: { label: string; value: number; sub?: string; href?: string }[]
  format?: ValueFormat
  empty?: string
}) {
  const format = (n: number) => fmt(kind, n)
  const max = Math.max(...rows.map((r) => r.value), 0)
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.label + i} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              {r.href ? <a href={r.href} className="font-medium text-foreground hover:text-primary hover:underline">{r.label}</a> : <span className="font-medium">{r.label}</span>}
              {r.sub && <span className="ml-1.5 text-xs text-muted-foreground">{r.sub}</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">{format(r.value)}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${max > 0 ? Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0) : 0}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

function niceCeil(n: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(n)))
  const f = n / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}
