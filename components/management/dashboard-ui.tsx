import React from "react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

// ─── Section Heading ────────────────────────────────────────────────────────
export function PageHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-balance font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {description && <p className="text-pretty text-sm text-muted-foreground sm:text-base">{description}</p>}
      <div className="mt-2 h-px bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
export type Stat = {
  label: string
  value: string | number
  icon: LucideIcon
  hint?: string
  trend?: number   // positive = up, negative = down
  accent?: "gold" | "primary" | "green" | "red"
}

const ACCENT_STYLES = {
  gold:    { icon: "text-gold",    bg: "bg-gold/10",    value: "text-gold" },
  primary: { icon: "text-primary", bg: "bg-primary/10", value: "text-primary" },
  green:   { icon: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100/60 dark:bg-emerald-500/10", value: "text-emerald-700 dark:text-emerald-400" },
  red:     { icon: "text-destructive", bg: "bg-destructive/10", value: "text-destructive" },
}

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon
        const a = ACCENT_STYLES[s.accent ?? "primary"]
        return (
          <Card key={s.label} className="overflow-hidden border-primary/10 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm leading-tight">{s.label}</CardTitle>
              <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", a.bg)}>
                <Icon className={cn("size-4", a.icon)} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={cn("font-serif text-2xl font-semibold sm:text-3xl", a.value)}>{s.value}</p>
              <div className="mt-1 flex items-center gap-1.5">
                {s.trend != null && (
                  s.trend >= 0
                    ? <TrendingUp className="size-3.5 text-emerald-500" />
                    : <TrendingDown className="size-3.5 text-destructive" />
                )}
                {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Inline bar chart (SVG, no library) ─────────────────────────────────────
export function MiniBarChart({
  data,
  labels,
  color = "var(--color-primary)",
}: {
  data: number[]
  labels?: string[]
  color?: string
}) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-1 h-20" aria-hidden>
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm transition-all"
            style={{ height: `${Math.round((v / max) * 72)}px`, background: color, opacity: 0.85 }}
          />
          {labels && <span className="text-[9px] text-muted-foreground truncate w-full text-center">{labels[i]}</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Status Badge ────────────────────────────────────────────────────────────
type StatusType = "pending" | "approved" | "rejected" | "paid" | "unpaid" | "processing" | "completed" | "low" | "ok"
const STATUS_MAP: Record<StatusType, string> = {
  pending:    "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300",
  approved:   "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected:   "bg-destructive/10 text-destructive border border-destructive/20",
  paid:       "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
  unpaid:     "bg-amber-100 text-amber-700 border border-amber-200",
  processing: "bg-primary/10 text-primary border border-primary/20",
  completed:  "bg-muted text-muted-foreground border border-border",
  low:        "bg-destructive/10 text-destructive border border-destructive/20",
  ok:         "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
}
export function StatusBadge({ status }: { status: StatusType }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", STATUS_MAP[status])}>
      {status}
    </span>
  )
}

// ─── Dashboard Table ─────────────────────────────────────────────────────────
export function DashTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: (string | React.ReactNode)[][]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((c) => (
              <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((row, ri) => (
            <tr key={ri} className="transition-colors hover:bg-muted/30">
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-3 text-sm text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
