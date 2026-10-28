"use client"

import { useEffect, useState, useTransition } from "react"
import { AlertCircle, Check, Loader2, PackagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adjustStock } from "@/app/store-actions"
import { adjustBranchStock } from "@/app/branch-stock-actions"
import { unwrap } from "@/lib/action-result"
import { cn } from "@/lib/utils"

type Mode = "add" | "remove" | "set"

const MODES: { value: Mode; label: string; help: string; field: string; placeholder: string }[] = [
  { value: "add", label: "Add stock", help: "Units you received. They're added to the current stock.", field: "Units to add", placeholder: "e.g. 20" },
  { value: "remove", label: "Remove stock", help: "Units lost, damaged or taken out. They're taken off the current stock.", field: "Units to remove", placeholder: "e.g. 2" },
  { value: "set", label: "Set count", help: "Type the total you actually counted. It replaces the current stock.", field: "Counted total", placeholder: "e.g. 35" },
]

/**
 * Updating the stock of a product (or one size) in plain terms: add units, remove units, or set the
 * counted total — with a preview of the new total before saving. With `branchStoreId`, the Main
 * Supply Office updates one of its branches' stock (app/branch-stock-actions.ts).
 */
export function StockControl({ module, productId, variantId, current, branchStoreId }: {
  module: string; productId: string; variantId?: string; current: number; branchStoreId?: string
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("add")
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

  function close() {
    setOpen(false); setQuantity(""); setNote(""); setError(null); setMode("add")
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setError(null)
    const fd = new FormData()
    fd.set("module", module)
    fd.set("product_id", productId)
    if (variantId) fd.set("variant_id", variantId)
    fd.set("mode", mode)
    fd.set("quantity", String(qty))
    fd.set("note", note)
    if (branchStoreId) { fd.set("branch_store_id", branchStoreId); fd.set("current", String(current)) }
    start(async () => {
      try {
        const r = unwrap(await (branchStoreId ? adjustBranchStock(fd) : adjustStock(fd)))
        close()
        setDone(`Stock updated: ${r.before} → ${r.after}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update the stock.")
      }
    })
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => { setOpen(true); setDone(null) }}>
          <PackagePlus className="size-3.5" />Update stock
        </Button>
        {done && <span role="status" className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><Check className="size-3.5" />{done}</span>}
      </div>
    )
  }

  return (
    <form onSubmit={save} className="w-full max-w-sm space-y-2.5 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div role="group" aria-label="What do you want to do?" className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1">
        {MODES.map((m) => (
          <button key={m.value} type="button" aria-pressed={mode === m.value} onClick={() => { setMode(m.value); setError(null) }}
            className={cn("rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors",
              mode === m.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{def.help}</p>

      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-medium">{def.field}</span>
          <input type="number" inputMode="numeric" min={mode === "set" ? 0 : 1} step={1} required autoFocus
            value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={def.placeholder}
            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm" />
        </label>
        <p className="shrink-0 pb-2 text-xs text-muted-foreground">Now: <strong className="text-foreground">{current}</strong></p>
      </div>

      {/* What the stock will be */}
      <p role="status" className={cn("rounded-lg px-2.5 py-1.5 text-xs", problem ? "bg-destructive/10 text-destructive" : preview !== null ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-muted/50 text-muted-foreground")}>
        {problem ?? (preview !== null ? <>New stock: <strong>{current} → {preview}</strong>{preview === current ? " (no change)" : ""}</> : "Enter a number to see the new stock.")}
      </p>

      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Note (optional)"
        placeholder={mode === "remove" ? "Note (optional) — e.g. damaged" : mode === "add" ? "Note (optional) — e.g. delivery from supplier" : "Note (optional)"}
        className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm" />

      {error && <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{error}</p>}

      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={close} disabled={pending}>Cancel</Button>
        <Button type="submit" size="sm" className="flex-1 gap-1.5" disabled={!valid || preview === current || pending}>
          {pending && <Loader2 className="size-3.5 animate-spin" />}Save
        </Button>
      </div>
    </form>
  )
}
