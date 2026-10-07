"use client"

import { useState, useTransition } from "react"
import { Flag, Loader2, X } from "lucide-react"
import { reportBuyer, type ReportReason } from "@/app/store-order-actions"
import type { ModuleKey } from "@/lib/modules"
import { unwrap } from "@/lib/action-result"

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "dummy_account", label: "Dummy / fake account" },
  { value: "fake_identity", label: "Identity doesn't match I.D." },
  { value: "no_show", label: "Repeated no-show / unpaid orders" },
  { value: "abusive", label: "Abusive behaviour" },
  { value: "other", label: "Other" },
]

/** Store staff flag a suspicious buyer; the Verification Admin reviews and can suspend or ban. */
export function ReportBuyerButton({ orderId, module, buyerName }: { orderId: string; module: ModuleKey; buyerName?: string | null }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>("dummy_account")
  const [details, setDetails] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        unwrap(await reportBuyer({ orderId, module, reason, details }))
        setDone(true)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send the report.")
      }
    })
  }

  if (done) {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><Flag className="size-3" />Reported — account flagged</span>
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/5">
        <Flag className="size-3" /> Report buyer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby={`report-${orderId}`} className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={`report-${orderId}`} className="font-serif text-lg font-semibold">Report buyer</h2>
                <p className="text-xs text-muted-foreground">
                  {buyerName ? <><strong>{buyerName}</strong> · </> : null}Order #{orderId.slice(0, 8)}. The account is flagged and the Verification Admin decides whether to suspend or ban it.
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            </div>

            <fieldset className="mt-4 space-y-2">
              <legend className="mb-1 text-sm font-medium">Reason</legend>
              {REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={`reason-${orderId}`} checked={reason === r.value} onChange={() => setReason(r.value)} />{r.label}
                </label>
              ))}
            </fieldset>
            <label className="mt-3 block text-sm font-medium" htmlFor={`details-${orderId}`}>Details</label>
            <textarea id={`details-${orderId}`} rows={3} value={details} onChange={(e) => setDetails(e.target.value)}
              placeholder="What did you notice? (e.g. name doesn't match I.D., fake contact number)"
              className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setOpen(false)} className="h-9 flex-1 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancel</button>
              <button type="button" disabled={pending} onClick={submit}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-destructive text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60">
                {pending && <Loader2 className="size-4 animate-spin" />}Send report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
