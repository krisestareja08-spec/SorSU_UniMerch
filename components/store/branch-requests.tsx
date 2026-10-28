"use client"

import { useMemo, useState, useTransition } from "react"
import { AlertCircle, Check, Loader2, PackagePlus, PackageX, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { reviewBranchRequest, sendBranchRequest, withdrawBranchRequest } from "@/app/branch-stock-actions"
import { unwrap } from "@/lib/action-result"
import { toast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

export type BranchRequest = {
  id: string; branch_store_id: string; kind: "restock" | "return"; product_name: string; quantity: number
  reason: string | null; note: string | null; status: string; fulfilled_quantity: number | null; main_note: string | null
  created_at: string; reviewed_at: string | null
}

const STATUS: Record<string, { label: string; tone: string }> = {
  pending:   { label: "Waiting for Main office", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  fulfilled: { label: "Sent",            tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  partial:   { label: "Partly sent",     tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  approved:  { label: "Return approved", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  declined:  { label: "Declined",        tone: "bg-destructive/10 text-destructive" },
}
const REASONS = [["damaged", "Damaged"], ["defective", "Defective"], ["other", "Other"]] as const
const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

/**
 * A branch's two actions on one product / size: ask the Main Supply Office for a restock, or report
 * damaged / defective units to send back. Branches can't change stock themselves.
 */
export function BranchStockActions({ productId, variantId, stock }: { productId: string; variantId?: string; stock: number }) {
  const [open, setOpen] = useState<null | "restock" | "return">(null)
  const [qty, setQty] = useState("")
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("damaged")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const n = Number(qty)
  const valid = Number.isInteger(n) && n >= 1 && !(open === "return" && n > stock)

  function close() { setOpen(null); setQty(""); setNote(""); setError(null) }
  function send(e: React.FormEvent) {
    e.preventDefault()
    if (!open || !valid) return
    const kind = open
    start(async () => {
      try {
        unwrap(await sendBranchRequest({ kind, productId, variantId: variantId ?? null, quantity: n, reason: kind === "return" ? reason : null, note }))
        close()
        setDone(kind === "restock" ? "Restock requested" : "Return reported")
        toast({ title: kind === "restock" ? "Restock request sent to the Main office" : "Report sent to the Main office" })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send it.")
      }
    })
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => { setOpen("restock"); setDone(null) }}>
          <PackagePlus className="size-3.5" />Request restock
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={stock < 1} className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
          onClick={() => { setOpen("return"); setDone(null) }}>
          <PackageX className="size-3.5" />Report damaged / defective
        </Button>
        {done && <span role="status" className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><Check className="size-3.5" />{done}</span>}
      </div>
    )
  }

  return (
    <form onSubmit={send} className="w-full max-w-sm space-y-2.5 rounded-xl border border-border bg-card p-3 shadow-sm">
      <p className="text-sm font-medium">{open === "restock" ? "Ask the Main Supply Office for more" : "Send damaged / defective units back"}</p>
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-medium">{open === "restock" ? "Units needed" : "Units to return"}</span>
          <input type="number" inputMode="numeric" min={1} max={open === "return" ? stock : undefined} step={1} required autoFocus
            value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm" />
        </label>
        <p className="shrink-0 pb-2 text-xs text-muted-foreground">In stock: <strong className="text-foreground">{stock}</strong></p>
      </div>
      {open === "return" && (
        <div role="radiogroup" aria-label="Why" className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1">
          {REASONS.map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={reason === v} onClick={() => setReason(v)}
              className={cn("rounded-md px-1.5 py-1.5 text-xs font-medium", reason === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
      )}
      {open === "return" && qty !== "" && n > stock && <p className="text-xs text-destructive">Only {stock} in stock.</p>}
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} aria-label="Note (optional)"
        placeholder={open === "restock" ? "Note (optional) — e.g. needed before enrolment week" : "What's wrong? (optional) — e.g. torn seams"}
        className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm" />
      {error && <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={close} disabled={pending}>Cancel</Button>
        <Button type="submit" size="sm" className="flex-1 gap-1.5" disabled={!valid || pending}>{pending && <Loader2 className="size-3.5 animate-spin" />}Send</Button>
      </div>
    </form>
  )
}

/** Requests with search and filters. Branch: its own, withdraw pending. Main office: all branches, review. */
export function BranchRequestsList({ requests, mode, branchNames = {} }: {
  requests: BranchRequest[]; mode: "branch" | "main"; branchNames?: Record<string, string>
}) {
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<"all" | "restock" | "return">("all")
  const [status, setStatus] = useState<"open" | "all" | "done">("open")
  const [branch, setBranch] = useState("")
  const q = query.trim().toLowerCase()
  const rows = useMemo(() => requests.filter((r) => {
    if (kind !== "all" && r.kind !== kind) return false
    if (status === "open" && r.status !== "pending") return false
    if (status === "done" && r.status === "pending") return false
    if (branch && r.branch_store_id !== branch) return false
    return !q || [r.product_name, r.note, branchNames[r.branch_store_id]].some((v) => v?.toLowerCase().includes(q))
  }), [requests, kind, status, branch, q, branchNames])
  const pendingCount = requests.filter((r) => r.status === "pending").length

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" aria-label="Search requests"
            placeholder={mode === "main" ? "Search product, branch or note" : "Search product or note"}
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm" />
        </div>
        <div role="group" aria-label="Status" className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {([["open", `Waiting (${pendingCount})`], ["done", "Reviewed"], ["all", "All"]] as const).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium", status === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Type" className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
          <option value="all">Restocks &amp; returns</option><option value="restock">Restock requests</option><option value="return">Damaged / defective</option>
        </select>
        {mode === "main" && Object.keys(branchNames).length > 1 && (
          <select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch" className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
            <option value="">All branches</option>
            {Object.entries(branchNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {requests.length === 0 ? (mode === "main" ? "No requests from branches yet." : "No requests yet. Use Request restock on a product below.") : "No requests match."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((r) => <RequestRow key={r.id} r={r} mode={mode} branchName={branchNames[r.branch_store_id]} />)}
        </ul>
      )}
    </div>
  )
}

function RequestRow({ r, mode, branchName }: { r: BranchRequest; mode: "branch" | "main"; branchName?: string }) {
  const [qty, setQty] = useState(String(r.quantity))
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const s = STATUS[r.status] ?? STATUS.pending

  function run(fn: () => Promise<unknown>, okMsg: string) {
    setError(null)
    start(async () => {
      try { await fn(); toast({ title: okMsg }) } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong.") }
    })
  }
  const review = (decision: "fulfil" | "approve" | "decline") => run(
    async () => unwrap(await reviewBranchRequest({ id: r.id, decision, quantity: Number(qty), note })),
    decision === "decline" ? "Request declined" : decision === "fulfil" ? "Restock sent to the branch" : "Return approved",
  )

  return (
    <li className="space-y-2 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            <span className={cn("mr-2 rounded px-1.5 py-px text-[10px] font-bold uppercase", r.kind === "restock" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
              {r.kind === "restock" ? "Restock" : r.reason ?? "Return"}
            </span>
            {r.quantity} × {r.product_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {mode === "main" && branchName ? `${branchName} · ` : ""}{when(r.created_at)}
            {r.fulfilled_quantity != null && r.status !== "declined" ? ` · ${r.kind === "restock" ? "sent" : "returned"} ${r.fulfilled_quantity}` : ""}
          </p>
          {r.note && <p className="text-xs text-muted-foreground">“{r.note}”</p>}
          {r.main_note && <p className="text-xs text-foreground">Main office: {r.main_note}</p>}
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", s.tone)}>{s.label}</span>
      </div>

      {r.status === "pending" && mode === "main" && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            <span className="block text-muted-foreground">{r.kind === "restock" ? "Units to send" : "Units to take back"}</span>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="mt-0.5 h-8 w-20 rounded-lg border border-input bg-background px-2 text-sm" />
          </label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the branch (optional)" aria-label="Note to the branch"
            className="h-8 min-w-40 flex-1 rounded-lg border border-input bg-background px-2 text-sm" />
          <Button size="sm" disabled={pending || !(Number(qty) >= 1)} onClick={() => review(r.kind === "restock" ? "fulfil" : "approve")} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
            {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}{r.kind === "restock" ? "Send stock" : "Approve return"}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => review("decline")} className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/5">
            <X className="size-3" />Decline
          </Button>
        </div>
      )}
      {r.status === "pending" && mode === "branch" && (
        <Button size="sm" variant="ghost" disabled={pending} className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => run(async () => unwrap(await withdrawBranchRequest(r.id)), "Request withdrawn")}>
          Withdraw
        </Button>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </li>
  )
}
