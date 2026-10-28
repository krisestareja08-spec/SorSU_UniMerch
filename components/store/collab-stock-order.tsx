"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Send, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { sendCollabStockOrder } from "@/app/branch-stock-actions"
import { unwrap } from "@/lib/action-result"
import { toast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

type Size = { id: string | null; name: string; price: number }

/**
 * Main Supply Office → an organization's collaboration product: units and price per size become a
 * stock order, already quoted with the royalty (rate × price per logo unit × units). The
 * organization is told to pay; the stock is added when the order is completed in Special Orders.
 */
export function CollabStockOrder({ productId, productName, storeName, logo, rate, sizes }: {
  productId: string; productName: string; storeName: string; logo: boolean; rate: number; sizes: Size[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [price, setPrice] = useState<Record<string, string>>({})
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup")
  const [address, setAddress] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const key = (s: Size) => s.id ?? "one"
  const lines = sizes.map((s) => ({ s, q: Number(qty[key(s)] || 0), p: Number.parseFloat(price[key(s)] ?? "") }))
  const chosen = lines.filter((l) => l.q > 0)
  const priced = chosen.every((l) => Number.isFinite(l.p) && l.p >= 0)
  const items = chosen.reduce((n, l) => n + (Number.isFinite(l.p) ? l.p * l.q : 0), 0)
  const royalty = logo ? chosen.reduce((n, l) => n + (Number.isFinite(l.p) ? (Math.round(l.p * rate) / 100) * l.q : 0), 0) : 0
  const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={() => { setOpen(true); setSent(null) }}><Truck className="size-3.5" />Send stock order</Button>
        {sent && <Link href={`/supply-office/special-orders/${sent}`} className="text-xs font-medium text-primary hover:underline">Stock order sent · open it</Link>}
      </div>
    )
  }

  return (
    <div className="w-full max-w-md space-y-2.5 rounded-xl border border-border bg-card p-3 text-sm shadow-sm">
      <p className="font-medium">Stock order for {productName} <span className="text-xs font-normal text-muted-foreground">· {storeName}</span></p>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 font-medium">Size</th><th className="py-1 font-medium">Units</th><th className="py-1 font-medium">Price / unit</th></tr></thead>
        <tbody>
          {sizes.map((s) => (
            <tr key={key(s)}>
              <td className="py-1 pr-2 font-medium">{s.name}</td>
              <td className="py-1 pr-2"><input type="number" min={0} value={qty[key(s)] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [key(s)]: e.target.value }))}
                aria-label={`Units of ${s.name}`} className="h-8 w-20 rounded-md border border-input bg-background px-2" /></td>
              <td className="py-1"><input type="number" min={0} step="0.01" value={price[key(s)] ?? ""} onChange={(e) => setPrice((p) => ({ ...p, [key(s)]: e.target.value }))}
                placeholder={`sells ₱${s.price}`} aria-label={`Price per unit of ${s.name}`} className="h-8 w-28 rounded-md border border-input bg-background px-2" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div role="radiogroup" aria-label="Pick-up or delivery" className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
        {(["pickup", "delivery"] as const).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={fulfilment === f} onClick={() => setFulfilment(f)}
            className={cn("rounded-md py-1.5 text-xs font-medium", fulfilment === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
            {f === "pickup" ? "They pick it up" : "We deliver"}
          </button>
        ))}
      </div>
      {fulfilment === "delivery" && <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Deliver to…" aria-label="Deliver to" className="h-9 w-full rounded-lg border border-input bg-background px-3" />}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the organization (optional)" aria-label="Note" className="h-9 w-full rounded-lg border border-input bg-background px-3" />
      <dl className="space-y-0.5 rounded-lg bg-muted/40 px-3 py-2 text-xs">
        <div className="flex justify-between"><dt className="text-muted-foreground">Items</dt><dd className="tabular-nums">{peso(items)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">{logo ? `Royalty (${rate}% per unit × units)` : "Royalty (no logo)"}</dt><dd className="tabular-nums">{peso(royalty)}</dd></div>
        <div className="flex justify-between font-semibold"><dt>They pay</dt><dd className="tabular-nums">{peso(items + royalty)}</dd></div>
      </dl>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
        <Button size="sm" className="flex-1 gap-1.5" disabled={pending || chosen.length === 0 || !priced || (fulfilment === "delivery" && !address.trim())} onClick={send}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}Send to {storeName}
        </Button>
      </div>
    </div>
  )
}
