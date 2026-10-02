"use client"

import { useState } from "react"
import { BadgeCheck, Download, IdCard, Loader2, ShieldAlert, X } from "lucide-react"
import { getBuyerIdentity, type BuyerIdentity } from "@/app/store-order-actions"
import type { ModuleKey } from "@/lib/modules"
import { cn } from "@/lib/utils"

/**
 * Orders with restricted items: staff open the buyer's verified I.D. and confirm the identity
 * before the order can be confirmed. `checked` / `onChecked` let the parent gate its buttons.
 */
export function BuyerIdCheck({
  orderId,
  module,
  checked,
  onChecked,
}: {
  orderId: string
  module: ModuleKey
  checked?: boolean
  onChecked?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<BuyerIdentity | null>(null)

  async function show() {
    setOpen(true)
    if (info) return
    setLoading(true)
    setError(null)
    try {
      setInfo(await getBuyerIdentity(orderId, module))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the buyer's I.D.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" onClick={show}
        className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold",
          checked ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50" : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100")}>
        {checked ? <BadgeCheck className="size-3.5" /> : <IdCard className="size-3.5" />}
        {checked ? "Buyer I.D. checked" : "Restricted item — view buyer's I.D."}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby={`buyer-id-${orderId}`}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id={`buyer-id-${orderId}`} className="font-serif text-lg font-semibold">Buyer identity check</h2>
                <p className="text-xs text-muted-foreground">Order #{orderId.slice(0, 8)} contains restricted items. Confirm the buyer is who they claim before confirming the order.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            </div>

            {loading && <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

            {info && (
              <div className="space-y-4">
                <div className={cn("flex items-start gap-2 rounded-xl p-3 text-sm",
                  info.verified ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-destructive/10 text-destructive")}>
                  {info.verified ? <BadgeCheck className="mt-0.5 size-4 shrink-0" /> : <ShieldAlert className="mt-0.5 size-4 shrink-0" />}
                  <span>
                    {info.verified
                      ? <>Verified by the Verification Admin as <strong>{info.affiliation}</strong>.</>
                      : <>This buyer is <strong>not verified</strong>. Do not release restricted items.</>}
                  </span>
                </div>

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Name</dt><dd className="font-medium">{info.buyerName ?? "—"}</dd>
                  <dt className="text-muted-foreground">I.D. number</dt><dd className="font-medium">{info.idNumber ?? "—"}</dd>
                  <dt className="text-muted-foreground">Department</dt><dd>{info.department ?? "—"}</dd>
                  <dt className="text-muted-foreground">Restricted items</dt><dd>{info.restrictedItems.join(", ")}</dd>
                </dl>

                <DocPreview label="Uploaded I.D." url={info.idUrl} path={info.idPath} />
                {info.corPath && <DocPreview label="Certificate of Registration (COR)" url={info.corUrl} path={info.corPath} />}

                {onChecked && (
                  <button type="button" disabled={!info.verified || checked}
                    onClick={() => { onChecked(); setOpen(false) }}
                    className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {checked ? "Already confirmed" : "I've checked the I.D. — identity matches"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function DocPreview({ label, url, path }: { label: string; url: string | null; path: string | null }) {
  const ext = (path ?? "").split(".").pop()?.toLowerCase() ?? ""
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Download className="size-3" />Open</a>}
      </div>
      {!path ? (
        <p className="text-xs text-muted-foreground">No document on file — the buyer has no approved verification.</p>
      ) : !url ? (
        <p className="text-xs text-destructive">Could not load the document.</p>
      ) : ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="max-h-80 w-full rounded-lg object-contain" />
      ) : ext === "pdf" ? (
        <iframe src={url} title={label} className="h-80 w-full rounded-lg" />
      ) : (
        <p className="text-xs text-muted-foreground">Word document — use “Open” to view it.</p>
      )}
    </div>
  )
}
