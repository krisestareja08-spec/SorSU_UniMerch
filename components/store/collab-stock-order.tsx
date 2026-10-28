"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, Send, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { ProductHeader } from "@/components/ui/product-thumb"
import { sendCollabStockOrder } from "@/app/branch-stock-actions"
import { unwrap } from "@/lib/action-result"
import { toast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

type Size = { id: string | null; name: string; price: number; stock?: number }
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Main Supply Office → an organization's collaboration product: units and price per size become a
 * stock order, already quoted with the royalty (rate × price per logo unit × units). The
 * organization is told to pay; the stock is added when the order is completed in Special Orders.
 */
export function CollabStockOrder({ productId, productName, image, storeName, logo, rate, sizes }: {
  productId: string; productName: string; image?: string | null; storeName: string; logo: boolean; rate: number; sizes: Size[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [price, setPrice] = useState<Record<string, string>>({})
  const [samePrice, setSamePrice] = useState("")
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup")
  const [address, setAddress] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const key = (s: Size) => s.id ?? "one"
  const priceOf = (s: Size) => Number.parseFloat(price[key(s)] ?? samePrice)
  const lines = sizes.map((s) => ({ s, q: Number(qty[key(s)] || 0), p: priceOf(s) }))
  const chosen = lines.filter((l) => l.q > 0)
  const priced = chosen.every((l) => Number.isFinite(l.p) && l.p >= 0)
  const units = chosen.reduce((n, l) => n + l.q, 0)
  const items = chosen.reduce((n, l) => n + (Number.isFinite(l.p) ? l.p * l.q : 0), 0)
  const royalty = logo ? chosen.reduce((n, l) => n + (Number.isFinite(l.p) ? (Math.round(l.p * rate) / 100) * l.q : 0), 0) : 0

  function close() { setOpen(false); setError(null) }
  function send() {
    setError(null)
    start(async () => {
      try {
        const { id } = unwrap(await sendCollabStockOrder({
          productId, fulfilment, address, note,
          lines: chosen.map((l) => ({ variantId: l.s.id, quantity: l.q, unitPrice: l.p })),
        }))
        toast({ title: `Stock order sent to ${storeName}`, description: "They're asked to pay; the stock is added when you complete it." })
        setSent(id); setOpen(false); setQty({}); setNote("")
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "The stock order couldn't be sent.")
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" className="gap-1.5" onClick={() => { setOpen(true); setSent(null) }}><Truck className="size-3.5" />Send stock order</Button>
      {sent && <Link href={`/supply-office/special-orders/${sent}`} className="text-xs font-medium text-primary hover:underline">Sent · open it</Link>}

      <Dialog open={open} onClose={close} title="Send a stock order"
        description={`${storeName} pays the quote; the stock is added when you complete it.`}
        header={<ProductHeader image={image} name={productName} detail={<>{storeName}{logo ? " · official logo" : ""}</>} />}
        footer={<>
          <div className="mr-auto text-sm">
            <p className="text-xs text-muted-foreground">{units} unit{units === 1 ? "" : "s"} · they pay</p>
            <p className="font-serif text-lg font-bold tabular-nums text-gold">{peso(items + royalty)}</p>
          </div>
          <Button variant="outline" onClick={close} disabled={pending}>Cancel</Button>
          <Button className="gap-1.5" disabled={pending || chosen.length === 0 || !priced || (fulfilment === "delivery" && !address.trim())} onClick={send}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Send
          </Button>
        </>}>
        <div className="space-y-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="font-medium">Price per unit</span>
            <span className="text-muted-foreground">₱</span>
            <input type="number" min={0} step="0.01" value={samePrice} onChange={(e) => setSamePrice(e.target.value)} placeholder="for every size"
              className="h-9 w-32 rounded-lg border border-input bg-background px-2" />
          </label>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[1fr_5.5rem_6.5rem] gap-2 bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground">
              <span>Size</span><span>Units</span><span>Price / unit</span>
            </div>
            {sizes.map((s) => (
              <div key={key(s)} className="grid grid-cols-[1fr_5.5rem_6.5rem] items-center gap-2 border-t border-border px-3 py-2">
                <span><span className="font-semibold">{s.name}</span>{s.stock != null && <span className="block text-[11px] text-muted-foreground">{s.stock} in stock</span>}</span>
                <input type="number" min={0} value={qty[key(s)] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [key(s)]: e.target.value }))}
                  aria-label={`Units of ${s.name}`} placeholder="0" className="h-9 w-full rounded-lg border border-input bg-background px-2 tabular-nums" />
                <input type="number" min={0} step="0.01" value={price[key(s)] ?? ""} onChange={(e) => setPrice((p) => ({ ...p, [key(s)]: e.target.value }))}
                  placeholder={samePrice || `sells ₱${s.price}`} aria-label={`Price per unit of ${s.name}`} className="h-9 w-full rounded-lg border border-input bg-background px-2 tabular-nums" />
              </div>
            ))}
          </div>
          <div role="radiogroup" aria-label="Pick-up or delivery" className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
            {(["pickup", "delivery"] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={fulfilment === f} onClick={() => setFulfilment(f)}
                className={cn("rounded-lg py-2 text-xs font-semibold", fulfilment === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                {f === "pickup" ? "They pick it up" : "We deliver"}
              </button>
            ))}
          </div>
          {fulfilment === "delivery" && <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Deliver to…" aria-label="Deliver to" className="h-10 w-full rounded-lg border border-input bg-background px-3" />}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the organization (optional)" aria-label="Note" className="h-10 w-full rounded-lg border border-input bg-background px-3" />
          <dl className="space-y-1 rounded-xl bg-muted/40 px-3 py-2.5">
            <div className="flex justify-between"><dt className="text-muted-foreground">Items</dt><dd className="tabular-nums">{peso(items)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{logo ? `Royalty (${rate}% per unit × units)` : "Royalty (no logo)"}</dt><dd className="tabular-nums">{peso(royalty)}</dd></div>
          </dl>
          {error && <p role="alert" className="flex items-start gap-1.5 text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
        </div>
      </Dialog>
    </div>
  )
}
