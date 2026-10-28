"use client"

import { useEffect, useState, useTransition } from "react"
import { AlertCircle, Check, Loader2, Minus, PackagePlus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { ProductHeader } from "@/components/ui/product-thumb"
import { adjustStock } from "@/app/store-actions"
import { adjustBranchStock, adjustCollabStock } from "@/app/branch-stock-actions"
import { unwrap } from "@/lib/action-result"
import { cn } from "@/lib/utils"

type Mode = "add" | "remove" | "set"

const MODES: { value: Mode; label: string; help: string; field: string; placeholder: string }[] = [
  { value: "add", label: "Add stock", help: "Units you received. They're added to the current stock.", field: "Units to add", placeholder: "e.g. 20" },
  { value: "remove", label: "Remove stock", help: "Units lost, damaged or taken out. They're taken off the current stock.", field: "Units to remove", placeholder: "e.g. 2" },
  { value: "set", label: "Set count", help: "Type the total you actually counted. It replaces the current stock.", field: "Counted total", placeholder: "e.g. 35" },
]

export type StockProduct = { name: string; image?: string | null; size?: string | null }

/**
 * Updating the stock of a product (or one size) in plain terms: add units, remove units, or set the
 * counted total — in a pop-up that shows the product, with a preview of the new total before saving.
 * With `branchStoreId`, the Main Supply Office updates one of its branches' stock. With `collab`, it
 * corrects an organization's collaboration product (take out / recount only — new stock is a stock order).
 */
export function StockControl({ module, productId, variantId, current, branchStoreId, collab = false, product }: {
  module: string; productId: string; variantId?: string; current: number; branchStoreId?: string; collab?: boolean; product?: StockProduct
}) {
  const modes = collab ? MODES.filter((m) => m.value !== "add") : MODES
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(collab ? "remove" : "add")
  const [quantity, setQuantity] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // The confirmation fades after a few seconds
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(null), 5000)
    return () => clearTimeout(t)
  }, [done])

  const def = MODES.find((m) => m.value === mode)!
  const qty = quantity.trim() === "" ? null : Number(quantity)
  const valid = qty !== null && Number.isInteger(qty) && (mode === "set" ? qty >= 0 : qty >= 1) && !(mode === "remove" && qty > current)
  const preview = !valid || qty === null ? null : mode === "add" ? current + qty : mode === "remove" ? current - qty : qty
  const problem =
    qty === null ? null
    : !Number.isInteger(qty) ? "Enter a whole number."
    : mode === "remove" && qty > current ? `Only ${current} in stock — you can't remove ${qty}.`
    : mode === "set" ? (qty < 0 ? "The total can't be negative." : null)
    : qty < 1 ? "Enter 1 or more." : null
  const step = (d: number) => setQuantity(String(Math.max(mode === "set" ? 0 : 1, (qty ?? (mode === "set" ? current : 0)) + d)))

  function close() {
    setOpen(false); setQuantity(""); setNote(""); setError(null); setMode(collab ? "remove" : "add")
  }

  function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!valid) return
    setError(null)
    const fd = new FormData()
    fd.set("module", module)
    fd.set("product_id", productId)
    if (variantId) fd.set("variant_id", variantId)
    fd.set("mode", mode)
    fd.set("quantity", String(qty))
    fd.set("note", note)
    if (branchStoreId) fd.set("branch_store_id", branchStoreId)
    fd.set("current", String(current))
    start(async () => {
      try {
        const r = unwrap(await (collab ? adjustCollabStock(fd) : branchStoreId ? adjustBranchStock(fd) : adjustStock(fd)))
        close()
        setDone(`${r.before} → ${r.after}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update the stock.")
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => { setOpen(true); setDone(null) }}>
        <PackagePlus className="size-3.5" />{collab ? "Correct" : "Update stock"}
      </Button>
      {done && <span role="status" className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><Check className="size-3.5" />Saved {done}</span>}

      <Dialog open={open} onClose={close} size="sm"
        title={collab ? "Correct collaboration stock" : "Update stock"}
        description={collab ? "Take damaged units out or set a recount. New stock is sent as a stock order." : undefined}
        header={<ProductHeader image={product?.image} name={product?.name ?? "Product"}
          detail={<>{product?.size ? <span className="font-medium text-foreground">Size {product.size} · </span> : null}{current} in stock now</>} />}
        footer={<>
          <Button type="button" variant="outline" className="flex-1" onClick={close} disabled={pending}>Cancel</Button>
          <Button type="button" className="flex-1 gap-1.5" disabled={!valid || preview === current || pending} onClick={() => save()}>
            {pending && <Loader2 className="size-4 animate-spin" />}Save
          </Button>
        </>}>
        <form onSubmit={save} className="space-y-4">
          <div role="radiogroup" aria-label="What do you want to do?" className={cn("grid gap-1 rounded-xl bg-muted/60 p-1", modes.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
            {modes.map((m) => (
              <button key={m.value} type="button" role="radio" aria-checked={mode === m.value} onClick={() => { setMode(m.value); setError(null) }}
                className={cn("rounded-lg px-1.5 py-2 text-xs font-semibold transition-colors",
                  mode === m.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{def.help}</p>

          <label className="block">
            <span className="text-sm font-medium">{def.field}</span>
            <div className="mt-1.5 flex items-center gap-2">
              <Button type="button" size="icon" variant="outline" className="size-10 shrink-0" aria-label="Less" onClick={() => step(-1)}><Minus className="size-4" /></Button>
              <input type="number" inputMode="numeric" min={mode === "set" ? 0 : 1} step={1} required
                value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={def.placeholder}
                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-center text-base font-semibold tabular-nums" />
              <Button type="button" size="icon" variant="outline" className="size-10 shrink-0" aria-label="More" onClick={() => step(1)}><Plus className="size-4" /></Button>
            </div>
          </label>

          {/* What the stock will be */}
          <div role="status" className={cn("flex items-center justify-between rounded-xl px-3 py-2.5 text-sm",
            problem ? "bg-destructive/10 text-destructive" : preview !== null ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-muted/50 text-muted-foreground")}>
            {problem ?? (preview !== null
              ? <><span>New stock</span><span className="font-serif text-lg font-bold tabular-nums">{current} → {preview}</span></>
              : <span>Enter a number to see the new stock.</span>)}
          </div>

          <label className="block">
            <span className="text-sm font-medium">Note <span className="font-normal text-muted-foreground">(optional)</span></span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
              placeholder={mode === "remove" ? "e.g. damaged in storage" : mode === "add" ? "e.g. delivery from supplier" : "e.g. monthly count"}
              className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
          </label>

          {error && <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
        </form>
      </Dialog>
    </div>
  )
}
