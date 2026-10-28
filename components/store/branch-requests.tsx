"use client"

import { useMemo, useState, useTransition } from "react"
import { AlertCircle, Check, Inbox, Loader2, Minus, PackagePlus, PackageX, Plus, Search, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { ProductHeader, ProductThumb } from "@/components/ui/product-thumb"
import { reviewBranchRequest, sendBranchRequest, withdrawBranchRequest } from "@/app/branch-stock-actions"
import { unwrap } from "@/lib/action-result"
import { toast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

export type BranchRequest = {
  id: string; branch_store_id: string; kind: "restock" | "return"; product_name: string; product_image_url?: string | null; quantity: number
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

function Stepper({ value, onChange, min = 1, max }: { value: string; onChange: (v: string) => void; min?: number; max?: number }) {
  const n = Number(value) || 0
  const set = (v: number) => onChange(String(Math.max(min, max != null ? Math.min(max, v) : v)))
  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="icon" variant="outline" className="size-10 shrink-0" aria-label="Less" onClick={() => set(n - 1)}><Minus className="size-4" /></Button>
      <input type="number" inputMode="numeric" min={min} max={max} step={1} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-center text-base font-semibold tabular-nums" />
      <Button type="button" size="icon" variant="outline" className="size-10 shrink-0" aria-label="More" onClick={() => set(n + 1)}><Plus className="size-4" /></Button>
    </div>
  )
}

/**
 * A branch's request on one product / size, in a pop-up that shows the product: ask the Main Supply
 * Office for a restock, or report damaged / defective units to send back.
 */
export function BranchStockActions({ productId, variantId, stock, product }: {
  productId: string; variantId?: string; stock: number; product?: { name: string; image?: string | null; size?: string | null }
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<"restock" | "return">("restock")
  const [qty, setQty] = useState("")
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("damaged")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const n = Number(qty)
  const valid = Number.isInteger(n) && n >= 1 && !(kind === "return" && n > stock)
  function close() { setOpen(false); setQty(""); setNote(""); setError(null) }
  function openAs(k: "restock" | "return") { setKind(k); setOpen(true); setDone(null) }
  function send() {
    if (!valid) return
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => openAs("restock")}><PackagePlus className="size-3.5" />Request</Button>
      {done && <span role="status" className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><Check className="size-3.5" />{done}</span>}

      <Dialog open={open} onClose={close} size="sm" title="Request from the Main Supply Office"
        header={<ProductHeader image={product?.image} name={product?.name ?? "Product"}
          detail={<>{product?.size ? <span className="font-medium text-foreground">Size {product.size} · </span> : null}{stock} in stock now</>} />}
        footer={<>
          <Button type="button" variant="outline" className="flex-1" onClick={close} disabled={pending}>Cancel</Button>
          <Button type="button" className="flex-1 gap-1.5" disabled={!valid || pending} onClick={send}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Send request
          </Button>
        </>}>
        <div className="space-y-4">
          <div role="radiogroup" aria-label="What do you need?" className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
            {([["restock", "More stock", PackagePlus], ["return", "Damaged / defective", PackageX]] as const).map(([v, l, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={kind === v} disabled={v === "return" && stock < 1}
                onClick={() => { setKind(v); setError(null) }}
                className={cn("flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors disabled:opacity-40",
                  kind === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <Icon className="size-3.5" />{l}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {kind === "restock" ? "The Main Supply Office sends the units and they're added to your stock." : "Report units to send back. Once the Main office approves, they're taken off your stock."}
          </p>
          <label className="block">
            <span className="text-sm font-medium">{kind === "restock" ? "Units needed" : "Units to return"}</span>
            <div className="mt-1.5"><Stepper value={qty} onChange={setQty} max={kind === "return" ? stock : undefined} /></div>
            {kind === "return" && n > stock && <span className="mt-1 block text-xs text-destructive">Only {stock} in stock.</span>}
          </label>
          {kind === "return" && (
            <div>
              <span className="text-sm font-medium">Why?</span>
              <div role="radiogroup" aria-label="Why" className="mt-1.5 flex flex-wrap gap-1.5">
                {REASONS.map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={reason === v} onClick={() => setReason(v)}
                    className={cn("rounded-full border px-3 py-1 text-xs font-medium", reason === v ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{l}</button>
                ))}
              </div>
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium">Note <span className="font-normal text-muted-foreground">(optional)</span></span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
              placeholder={kind === "restock" ? "e.g. needed before enrolment week" : "What's wrong? e.g. torn seams"}
              className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
          </label>
          {error && <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
        </div>
      </Dialog>
    </div>
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
  const pendingRestocks = requests.filter((r) => r.status === "pending" && r.kind === "restock").length

  return (
    <div className="space-y-3">
      <div role="tablist" className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {([["open", `Waiting (${pendingCount})`], ["done", "Reviewed"], ["all", "All"]] as const).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={status === v} onClick={() => setStatus(v)}
            className={cn("flex-1 rounded-lg py-1.5 text-sm font-medium", status === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" aria-label="Search requests"
            placeholder={mode === "main" ? "Search product, branch or note" : "Search product or note"}
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm" />
        </div>
        <div className="flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Type" className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm">
            <option value="all">Restocks &amp; returns</option><option value="restock">Restocks</option><option value="return">Damaged / defective</option>
          </select>
          {mode === "main" && Object.keys(branchNames).length > 1 && (
            <select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch" className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm">
              <option value="">All branches</option>
              {Object.entries(branchNames).map(([id, name]) => <option key={id} value={id}>{name.replace(/^Supply Office — /, "")}</option>)}
            </select>
          )}
        </div>
      </div>
      {mode === "main" && status === "open" && pendingCount > 0 && (
        <p className="text-xs text-muted-foreground">{pendingRestocks} restock{pendingRestocks === 1 ? "" : "s"} and {pendingCount - pendingRestocks} return report{pendingCount - pendingRestocks === 1 ? "" : "s"} waiting, oldest first.</p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-2 size-7 text-muted-foreground/40" />
          {requests.length === 0 ? (mode === "main" ? "No requests from branches yet." : "No requests yet. Use Request on a product to ask for stock.") : status === "open" ? "Nothing waiting — you're all caught up." : "No requests match."}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => <RequestRow key={r.id} r={r} mode={mode} branchName={branchNames[r.branch_store_id]} />)}
        </ul>
      )}
    </div>
  )
}

function RequestRow({ r, mode, branchName }: { r: BranchRequest; mode: "branch" | "main"; branchName?: string }) {
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState(String(r.quantity))
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const s = STATUS[r.status] ?? STATUS.pending
  const restock = r.kind === "restock"

  function run(fn: () => Promise<unknown>, okMsg: string) {
    setError(null)
    start(async () => {
      try { await fn(); toast({ title: okMsg }); setOpen(false) } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong.") }
    })
  }
  const review = (decision: "fulfil" | "approve" | "decline") => run(
    async () => unwrap(await reviewBranchRequest({ id: r.id, decision, quantity: Number(qty), note })),
    decision === "decline" ? "Request declined" : decision === "fulfil" ? "Restock sent to the branch" : "Return approved",
  )

  return (
    <li className={cn("flex gap-3 rounded-xl border bg-card p-3", r.status === "pending" ? "border-amber-200 dark:border-amber-500/20" : "border-border")}>
      <ProductThumb src={r.product_image_url} alt={r.product_name} size="md" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <p className="min-w-0 text-sm font-semibold leading-snug">{r.product_name}</p>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", s.tone)}>{s.label}</span>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className={cn("rounded px-1.5 py-px text-[10px] font-bold uppercase", restock ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
            {restock ? "Restock" : r.reason ?? "Return"}
          </span>
          <span className="font-semibold text-foreground">{r.quantity} unit{r.quantity === 1 ? "" : "s"}</span>
          {mode === "main" && branchName && <span>· {branchName.replace(/^Supply Office — /, "")}</span>}
          <span>· {when(r.created_at)}</span>
          {r.fulfilled_quantity != null && r.status !== "declined" && <span>· {restock ? "sent" : "returned"} {r.fulfilled_quantity}</span>}
        </p>
        {r.note && <p className="text-xs text-muted-foreground">“{r.note}”</p>}
        {r.main_note && <p className="text-xs"><span className="font-medium">Main office:</span> {r.main_note}</p>}
        {r.status === "pending" && (
          <div className="flex flex-wrap gap-2 pt-1">
            {mode === "main" ? (
              <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">{restock ? "Review & send" : "Review return"}</Button>
            ) : (
              <Button size="sm" variant="ghost" disabled={pending} className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => run(async () => unwrap(await withdrawBranchRequest(r.id)), "Request withdrawn")}>Withdraw</Button>
            )}
          </div>
        )}
        {error && !open && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>

      {mode === "main" && (
        <Dialog open={open} onClose={() => setOpen(false)} size="sm"
          title={restock ? "Send stock to the branch" : "Damaged / defective return"}
          description={branchName}
          header={<ProductHeader image={r.product_image_url} name={r.product_name}
            detail={<>{restock ? "Asked for" : "Returning"} {r.quantity} · {when(r.created_at)}</>} />}
          footer={<>
            <Button variant="outline" disabled={pending} onClick={() => review("decline")} className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"><X className="size-4" />Decline</Button>
            <Button disabled={pending || !(Number(qty) >= 1)} onClick={() => review(restock ? "fulfil" : "approve")} className="ml-auto gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{restock ? `Send ${qty || 0}` : "Approve return"}
            </Button>
          </>}>
          <div className="space-y-4">
            {r.note && <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">“{r.note}”</p>}
            <label className="block">
              <span className="text-sm font-medium">{restock ? "Units to send" : "Units to take back"}</span>
              <span className="block text-xs text-muted-foreground">{restock ? "Send fewer if that's all you have — it's marked partly sent." : "Taken off the branch's stock."}</span>
              <div className="mt-1.5"><Stepper value={qty} onChange={setQty} /></div>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Note to the branch <span className="font-normal text-muted-foreground">(optional)</span></span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={restock ? "e.g. the rest arrives next week" : "e.g. replacement coming"}
                className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
            </label>
            {error && <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
          </div>
        </Dialog>
      )}
    </li>
  )
}
