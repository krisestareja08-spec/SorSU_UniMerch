"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, Inbox, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductThumb } from "@/components/ui/product-thumb"
import { OPEN_STATUSES, SUPPLY_STATUS, pesoFmt, requestCode, type SupplyRequest, type SupplyStatus } from "@/lib/supply-request-shape"
import { cn } from "@/lib/utils"

const day = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })

/** Supply requests with tabs, search and filters — the requester's own, or all of them for the Main office. */
export function SupplyRequestList({ requests, mode, hrefBase, newHref }: {
  requests: SupplyRequest[]; mode: "requester" | "main"; hrefBase: string; newHref?: string
}) {
  const [tab, setTab] = useState<"todo" | "open" | "closed" | "all">(mode === "main" ? "todo" : "open")
  const [query, setQuery] = useState("")
  const [who, setWho] = useState<"" | "seller" | "cashier">("")
  // What needs the viewer's action
  const todo: SupplyStatus[] = mode === "main" ? ["submitted", "payment_review", "paid", "preparing", "ready", "out_for_delivery"] : ["changes_requested", "approved", "ready"]
  const q = query.trim().toLowerCase()
  const rows = useMemo(() => requests.filter((r) => {
    if (tab === "todo" && !todo.includes(r.status)) return false
    if (tab === "open" && !OPEN_STATUSES.includes(r.status)) return false
    if (tab === "closed" && OPEN_STATUSES.includes(r.status)) return false
    if (who && r.requester_module !== who) return false
    return !q || [r.title, r.requester_name, requestCode(r.id), ...r.items.map((i) => i.name)].some((v) => v?.toLowerCase().includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [requests, tab, q, who, mode])
  const count = (t: typeof tab) => requests.filter((r) => t === "todo" ? todo.includes(r.status) : t === "open" ? OPEN_STATUSES.includes(r.status) : t === "closed" ? !OPEN_STATUSES.includes(r.status) : true).length

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {newHref && <Button asChild className="gap-2 sm:order-last"><Link href={newHref}><Plus className="size-4" />New request</Link></Button>}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" aria-label="Search requests"
            placeholder={mode === "main" ? "Search title, organization / branch, item or #code" : "Search title, item or #code"}
            className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm" />
        </div>
        {mode === "main" && (
          <select value={who} onChange={(e) => setWho(e.target.value as typeof who)} aria-label="From" className="h-10 rounded-xl border border-input bg-background px-2 text-sm">
            <option value="">Organizations &amp; branches</option><option value="seller">Organizations</option><option value="cashier">Supply Office branches</option>
          </select>
        )}
      </div>
      <div role="tablist" className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {([["todo", mode === "main" ? "To do" : "Needs you"], ["open", "Open"], ["closed", "Closed"], ["all", "All"]] as const).map(([t, l]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn("flex flex-1 items-center justify-center whitespace-nowrap rounded-lg px-1 py-1.5 text-sm font-medium", tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {l}{count(t) > 0 && <span className={cn("ml-1.5 inline-block min-w-5 rounded-full px-1.5 text-[11px] font-bold leading-5",
              t === "todo" ? "bg-gold text-primary" : "bg-muted text-muted-foreground")}>{count(t)}</span>}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-2 size-8 text-muted-foreground/40" />
          {requests.length === 0
            ? mode === "main" ? "No supply requests from organizations or branches yet." : "No requests yet. Order event items, a new design, or stock for your collaboration products."
            : "Nothing here."}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const s = SUPPLY_STATUS[r.status]
            const units = r.items.reduce((n, i) => n + i.quantity, 0)
            // One photo per item (sizes of one item share a design group)
            const photos = [...new Map(r.items.map((i) => [i.design_group ?? i.id, i.image_url ?? null])).values()]
            const needsMe = todo.includes(r.status)
            return (
              <li key={r.id}>
                <Link href={`${hrefBase}/${r.id}`}
                  className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/40 sm:p-4", needsMe ? "border-gold/50" : "border-border")}>
                  <div className="relative shrink-0">
                    <ProductThumb src={photos.find(Boolean)} alt="" size="md" />
                    {photos.length > 1 && <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-card bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground">+{photos.length - 1}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {mode === "main" ? <span className="font-medium text-foreground/80">{r.requester_name} · </span> : ""}
                      {photos.length} item{photos.length === 1 ? "" : "s"} · {units} unit{units === 1 ? "" : "s"} · {day(r.created_at)}
                      {r.needed_by ? ` · needed by ${day(r.needed_by)}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", s.tone)}>{s.label}</span>
                      {r.total != null && <span className="text-xs font-semibold tabular-nums">{pesoFmt(r.total)}</span>}
                      <span className="font-mono text-[11px] text-muted-foreground">{requestCode(r.id)}</span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
