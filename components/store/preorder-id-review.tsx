"use client"

import { useState } from "react"
import { Check, IdCard, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

/**
 * Pre-order I.D. check (scripts/29): the shop opens the photo the buyer uploaded at checkout, then
 * approves it (the order becomes "For Pick Up") or rejects it (the order is cancelled).
 */
export function PreorderIdReview({ orderId, idPath, onDone }: { orderId: string; idPath: string | null; onDone: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<"view" | "approve" | "reject" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function view() {
    if (!idPath) return
    setBusy("view")
    setError(null)
    const { data, error: err } = await createClient().storage.from("preorder-ids").createSignedUrl(idPath, 60 * 10)
    setBusy(null)
    if (err || !data) setError("The I.D. photo couldn't be opened.")
    else setUrl(data.signedUrl)
  }

  async function decide(approve: boolean) {
    if (!approve && !window.confirm("Reject this I.D.? The pre-order will be cancelled.")) return
    setBusy(approve ? "approve" : "reject")
    setError(null)
    const { error: err } = await createClient().from("orders")
      .update(approve ? { id_status: "approved", status: "ready_for_pickup" } : { id_status: "rejected", status: "cancelled" })
      .eq("id", orderId)
    setBusy(null)
    if (err) setError(err.message)
    else onDone()
  }

  return (
    <div className="w-full rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
        <IdCard className="size-4" />Check the buyer&apos;s I.D. before confirming this pre-order
      </p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Buyer's I.D." className="max-h-56 rounded-lg border border-border object-contain" />
        </a>
      ) : (
        <Button size="sm" variant="outline" className="mt-2 gap-1" disabled={!idPath || busy !== null} onClick={view}>
          {busy === "view" ? <Loader2 className="size-3 animate-spin" /> : <IdCard className="size-3" />}{idPath ? "View I.D." : "No I.D. uploaded"}
        </Button>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy !== null || !url} onClick={() => decide(true)} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
          {busy === "approve" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Approve — For Pick Up
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => decide(false)} className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/5">
          {busy === "reject" ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}Reject
        </Button>
      </div>
      {!url && idPath && <p className="mt-1.5 text-[11px] text-muted-foreground">Open the I.D. first to approve it.</p>}
    </div>
  )
}
