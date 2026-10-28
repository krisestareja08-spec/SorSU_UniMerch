"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Banknote, Check, Landmark, Loader2, PackageCheck, Pencil, Smartphone, Truck, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProductThumb } from "@/components/ui/product-thumb"
import { createClient } from "@/lib/supabase/client"
import { advanceSupplyRequest, cancelSupplyRequest, paySupplyRequest, reviewSupplyRequest } from "@/app/supply-request-actions"
import { unwrap } from "@/lib/action-result"
import { toast } from "@/components/ui/toaster"
import type { ModuleKey } from "@/lib/modules"
import { pesoFmt, type SupplyRequest } from "@/lib/supply-request-shape"
import { cn } from "@/lib/utils"

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<unknown>, ok: string) => {
    setError(null)
    start(async () => {
      try { await fn(); toast({ title: ok }); router.refresh() } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong.") }
    })
  }
  return { pending, error, run }
}

/** Requester: edit / cancel before it's paid, and pay the quote. */
export function RequesterPanel({ request: r, module, basePath, storeId }: { request: SupplyRequest; module: ModuleKey; basePath: string; storeId: string }) {
  const { pending, error, run } = useRun()
  const [method, setMethod] = useState<"gcash" | "bank" | "cash">("gcash")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [reference, setReference] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const canEdit = r.status === "submitted" || r.status === "changes_requested"
  const canCancel = canEdit || r.status === "approved"

  function pay() {
    run(async () => {
      let receiptUrl: string | undefined
      if (method !== "cash") {
        if (!file) throw new Error("Upload the payment receipt.")
        const supabase = createClient()
        const ext = file.name.split(".").pop() || "jpg"
        const path = `supply/${storeId}/${crypto.randomUUID()}.${ext}`
        const { error: e } = await supabase.storage.from("order-receipts").upload(path, file)
        if (e) throw new Error("The receipt couldn't be uploaded. Please try again.")
        receiptUrl = supabase.storage.from("order-receipts").getPublicUrl(path).data.publicUrl
      }
      unwrap(await paySupplyRequest({ module, id: r.id, method, receiptUrl, reference }))
    }, method === "cash" ? "The Main office knows you'll pay at the counter" : "Payment sent for checking")
  }

  return (
    <div className="space-y-3">
      {r.status === "approved" && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
          <p className="text-sm font-semibold">Pay {pesoFmt(r.total)} to confirm the order <span className="font-normal text-muted-foreground">(includes {pesoFmt(r.royalty_total)} royalty)</span></p>
          {r.payment_method === "cash" && <p className="text-xs text-muted-foreground">You chose to pay at the Main Supply Office counter. Pay there, or switch to online below.</p>}
          <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-1 rounded-lg bg-card p-1">
            {([["gcash", "GCash", Smartphone], ["bank", "Bank", Landmark], ["cash", "At the counter", Banknote]] as const).map(([v, l, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={method === v} onClick={() => setMethod(v)}
                className={cn("flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium", method === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                <Icon className="size-3.5" />{l}
              </button>
            ))}
          </div>
          {method !== "cash" ? (
            <>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)) } }} />
              {preview ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Receipt" className="h-20 rounded-lg border border-border object-cover" />
                  <button type="button" onClick={() => fileRef.current?.click()} className="text-xs font-medium text-primary hover:underline">Replace</button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 py-4 text-sm font-medium hover:border-gold/70">
                  <Upload className="size-4 text-gold/70" />Upload payment receipt
                </button>
              )}
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference number" className="h-9 text-sm" />
            </>
          ) : <p className="text-xs text-muted-foreground">Bring {pesoFmt(r.total)} to the Main Supply Office. They mark it paid when they receive it.</p>}
          <Button onClick={pay} disabled={pending || (method !== "cash" && !file)} className="w-full gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}{method === "cash" ? "I'll pay at the counter" : "Send payment"}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canEdit && <Button asChild variant="outline" className="gap-1.5"><Link href={`${basePath}/supply-requests/${r.id}/edit`}><Pencil className="size-4" />{r.status === "changes_requested" ? "Make the changes" : "Edit request"}</Link></Button>}
        {canCancel && (
          <Button variant="outline" disabled={pending} className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
            onClick={() => { if (window.confirm("Cancel this supply request?")) run(async () => unwrap(await cancelSupplyRequest({ module, id: r.id })), "Request cancelled") }}>
            <X className="size-4" />Cancel request
          </Button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

/** Main Supply Office: review with a quote, confirm payment, and move the order along. */
export function MainPanel({ request: r, royaltyRate }: { request: SupplyRequest; royaltyRate: number }) {
  const { pending, error, run } = useRun()
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(r.items.map((i) => [i.id, i.unit_price == null ? "" : String(i.unit_price)])))
  const [fee, setFee] = useState(String(r.delivery_fee || ""))
  const [note, setNote] = useState("")
  const [date, setDate] = useState(r.scheduled_date ?? "")

  const unit = (id: string) => Number.parseFloat(prices[id])
  const priced = r.items.every((i) => Number.isFinite(unit(i.id)) && unit(i.id) >= 0)
  const itemsTotal = r.items.reduce((n, i) => n + (Number.isFinite(unit(i.id)) ? unit(i.id) * i.quantity : 0), 0)
  const royalty = r.items.reduce((n, i) => n + (i.uses_logo && Number.isFinite(unit(i.id)) ? Math.round(unit(i.id) * royaltyRate) / 100 * i.quantity : 0), 0)
  const feeNum = r.fulfilment === "delivery" ? Number.parseFloat(fee) || 0 : 0

  const review = (decision: "approve" | "changes" | "decline") => run(async () => unwrap(await reviewSupplyRequest({
    id: r.id, decision, note, deliveryFee: feeNum,
    prices: decision === "approve" ? r.items.map((i) => ({ id: i.id, unit_price: unit(i.id) })) : [],
  })), decision === "approve" ? "Quote sent — waiting for payment" : decision === "changes" ? "Sent back for changes" : "Request declined")
  const advance = (step: "paid" | "reject_payment" | "preparing" | "ready" | "out_for_delivery" | "completed", ok: string) =>
    run(async () => unwrap(await advanceSupplyRequest({ id: r.id, step, date, note })), ok)

  return (
    <div className="space-y-3">
      {r.status === "submitted" && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
          <div>
            <p className="text-sm font-semibold">Send a quote</p>
            <p className="text-xs text-muted-foreground">Set the price per unit of each line. The royalty is added for official-logo items.</p>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {r.items.map((i) => (
              <li key={i.id} className="flex items-center gap-2.5 px-3 py-2">
                <ProductThumb src={i.image_url} alt="" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.size || "One size"} × {i.quantity}{i.uses_logo ? " · logo" : ""}
                    {Number.isFinite(unit(i.id)) && <> · <span className="font-semibold tabular-nums text-foreground">{pesoFmt(unit(i.id) * i.quantity)}</span></>}</p>
                </div>
                <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">₱
                  <input type="number" min={0} step="0.01" value={prices[i.id]} onChange={(e) => setPrices((p) => ({ ...p, [i.id]: e.target.value }))}
                    aria-label={`Unit price of ${i.name}${i.size ? ` (${i.size})` : ""}`} placeholder="0.00" className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
              </li>
            ))}
          </ul>
          {r.fulfilment === "delivery" && (
            <label className="flex items-center gap-2 text-sm">Delivery fee ₱
              <input type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm" /></label>
          )}
          <dl className="space-y-0.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Items</dt><dd className="tabular-nums">{pesoFmt(itemsTotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Royalty ({royaltyRate}% per logo unit × units)</dt><dd className="tabular-nums">{pesoFmt(royalty)}</dd></div>
            {feeNum > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd className="tabular-nums">{pesoFmt(feeNum)}</dd></div>}
            <div className="flex justify-between font-semibold"><dt>Total to pay</dt><dd className="tabular-nums">{pesoFmt(itemsTotal + royalty + feeNum)}</dd></div>
          </dl>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note to the requester (needed when asking for changes)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending || !priced} onClick={() => review("approve")} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Approve &amp; send quote
            </Button>
            <Button variant="outline" disabled={pending || !note.trim()} onClick={() => review("changes")}>Ask for changes</Button>
            <Button variant="outline" disabled={pending} onClick={() => { if (window.confirm("Decline this request?")) review("decline") }} className="border-destructive/30 text-destructive hover:bg-destructive/5">Decline</Button>
          </div>
          {!priced && <p className="text-xs text-muted-foreground">Set a unit price for every item to approve.</p>}
        </div>
      )}

      {(r.status === "approved" || r.status === "payment_review") && (
        <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
          <p className="text-sm font-semibold">Payment · {pesoFmt(r.total)}</p>
          {r.status === "payment_review" ? (
            <p className="text-xs text-muted-foreground">{r.payment_method === "bank" ? "Bank transfer" : "GCash"}{r.reference_number ? ` · ref ${r.reference_number}` : ""}{" · "}
              {r.receipt_url && <a href={r.receipt_url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">View receipt</a>}</p>
          ) : <p className="text-xs text-muted-foreground">{r.payment_method === "cash" ? "They'll pay at the counter." : "Waiting for the requester to pay."} Mark it paid when you receive it.</p>}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" />
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => advance("paid", "Marked paid")} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"><Banknote className="size-4" />Mark paid</Button>
            {r.status === "payment_review" && <Button variant="outline" disabled={pending} onClick={() => advance("reject_payment", "Payment sent back")}>Not confirmed</Button>}
            {r.status === "approved" && <Button variant="outline" disabled={pending} onClick={() => { if (window.confirm("Decline this request?")) review("decline") }} className="border-destructive/30 text-destructive hover:bg-destructive/5">Decline</Button>}
          </div>
        </div>
      )}

      {["paid", "preparing", "ready", "out_for_delivery"].includes(r.status) && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <p className="text-sm font-semibold">{r.fulfilment === "delivery" ? `Deliver to ${r.delivery_address ?? "the requester"}` : "Walk-in pick-up at the Main Supply Office"}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs"><span className="block text-muted-foreground">{r.fulfilment === "delivery" ? "Delivery date" : "Pick-up date"}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-0.5 h-9 rounded-lg border border-input bg-background px-2 text-sm" /></label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the requester (optional)" className="h-9 min-w-40 flex-1 rounded-lg border border-input bg-background px-3 text-sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            {r.status === "paid" && <Button variant="outline" disabled={pending} onClick={() => advance("preparing", "Marked as being prepared")}>Being prepared</Button>}
            {(r.status === "paid" || r.status === "preparing") && (r.fulfilment === "delivery"
              ? <Button disabled={pending} onClick={() => advance("out_for_delivery", "Requester told it's on the way")} className="gap-1.5"><Truck className="size-4" />Out for delivery</Button>
              : <Button disabled={pending} onClick={() => advance("ready", "Requester told it's ready")} className="gap-1.5"><PackageCheck className="size-4" />Ready for pick-up</Button>)}
            <Button disabled={pending} onClick={() => { if (window.confirm("Mark it completed? Collab stock and marketplace drafts are added to the requester now.")) advance("completed", "Completed") }}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"><Check className="size-4" />{r.fulfilment === "delivery" ? "Delivered" : "Picked up"} — complete</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
