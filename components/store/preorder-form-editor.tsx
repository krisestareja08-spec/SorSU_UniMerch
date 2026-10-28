"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Package, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deletePreorderForm, savePreorderForm } from "@/app/preorder-form-actions"
import type { PreorderFormDef } from "@/lib/preorder-form-shape"
import type { ModuleKey } from "@/lib/modules"
import { unwrap } from "@/lib/action-result"
import { toast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

export type PickableProduct = { id: string; name: string; preOrder: boolean; image: string | null }

/**
 * Create / edit a pre-order form: a title, then Size / Qty cells. Each cell holds the
 * products it covers, e.g. "Polo" + "Blouse" in one cell and "Pants" + "Skirt" in another; each
 * product becomes a sub-column where a buyer's "M-2" is written.
 */
export function PreorderFormEditor({ module, basePath, products, initial }: {
  module: ModuleKey; basePath: string; products: PickableProduct[]; initial?: PreorderFormDef
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title ?? "")
  const [cells, setCells] = useState<string[][]>(
    initial?.columns.length ? initial.columns.map((c) => c.products.map((p) => p.id)) : [[]],
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Products saved on the form but since deleted still show by their saved name
  const known = new Map(products.map((p) => [p.id, p]))
  for (const c of initial?.columns ?? []) for (const p of c.products) if (!known.has(p.id)) known.set(p.id, { id: p.id, name: `${p.name} (deleted)`, preOrder: false, image: null })
  const used = new Set(cells.flat())
  const available = products.filter((p) => !used.has(p.id))
  const preOrders = available.filter((p) => p.preOrder)
  const others = available.filter((p) => !p.preOrder)

  const setCell = (i: number, ids: string[]) => setCells((all) => all.map((c, j) => (j === i ? ids : c)))

  function save() {
    setError(null)
    startTransition(async () => {
      try {
        const { id } = unwrap(await savePreorderForm({ module, id: initial?.id, title, columns: cells.map((productIds) => ({ productIds })) }))
        toast({ title: initial ? "Form updated" : "Form created", variant: "success" })
        router.push(`${basePath}/preorders/${id}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "The form couldn't be saved.")
      }
    })
  }

  function remove() {
    if (!initial || !window.confirm(`Delete the form "${initial.title}"? The orders themselves are kept.`)) return
    startTransition(async () => {
      try {
        unwrap(await deletePreorderForm({ module, id: initial.id }))
        toast({ title: "Form deleted" })
        router.push(`${basePath}/preorders`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "The form couldn't be deleted.")
      }
    })
  }

  const columns = cells.filter((c) => c.length > 0)

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium">Form title *</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. School Uniform" className="mt-1.5" />
        </label>

        <div>
          <p className="text-sm font-medium">Size / Quantity (qty) cells *</p>
          <p className="text-xs text-muted-foreground">Each cell covers one or more products. A buyer&apos;s Medium × 2 is written as <span className="font-semibold text-foreground">M-2</span> under that product.</p>
          <ol className="mt-3 space-y-3">
            {cells.map((cell, i) => (
              <li key={i} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cell {i + 1}</p>
                  {cells.length > 1 && (
                    <button type="button" onClick={() => setCells((all) => all.filter((_, j) => j !== i))} aria-label={`Remove cell ${i + 1}`}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="size-4" /></button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cell.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary">
                      {known.get(id)?.name ?? "Product"}
                      <button type="button" onClick={() => setCell(i, cell.filter((x) => x !== id))} aria-label={`Remove ${known.get(id)?.name ?? "product"}`}
                        className="rounded-full p-0.5 hover:bg-primary/10"><X className="size-3" /></button>
                    </span>
                  ))}
                  {cell.length === 0 && <span className="text-xs text-muted-foreground">No products yet</span>}
                </div>
                <select value="" onChange={(e) => e.target.value && setCell(i, [...cell, e.target.value])} disabled={available.length === 0}
                  aria-label={`Add a product to cell ${i + 1}`} className="mt-2 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
                  <option value="">{available.length ? "+ Add a product…" : "All products are in a cell"}</option>
                  {preOrders.length > 0 && <optgroup label="Pre-order products">{preOrders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                  {others.length > 0 && <optgroup label="Other products">{others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                </select>
              </li>
            ))}
          </ol>
          <Button type="button" variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setCells((all) => [...all, []])}>
            <Plus className="size-4" />Add Size / Qty cell
          </Button>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}{initial ? "Save changes" : "Create form"}
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => router.back()}>Cancel</Button>
          {initial && (
            <Button type="button" variant="outline" disabled={pending} onClick={remove} className="ml-auto gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5">
              <Trash2 className="size-4" />Delete form
            </Button>
          )}
        </div>
      </div>

      {/* Preview of the header row */}
      <section aria-label="Preview" className="min-w-0 rounded-2xl border border-border bg-card">
        <p className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
        <div className="p-4">
          <p className="font-serif text-base font-semibold">{title.trim() || "Untitled form"}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead className="text-muted-foreground">
                <tr className="bg-muted/40">
                  {["Name", "Yr / Course", "Contact Number"].map((h) => <th key={h} rowSpan={2} className="border border-border px-2 py-1.5 text-left font-medium">{h}</th>)}
                  <th colSpan={Math.max(1, columns.flat().length)} className="border border-border px-2 py-1.5 text-center font-medium">Size / Quantity (qty)</th>
                  {["Amount Paid", "Remarks", "Date"].map((h) => <th key={h} rowSpan={2} className="border border-border px-2 py-1.5 text-left font-medium">{h}</th>)}
                </tr>
                <tr className="bg-muted/40">
                  {columns.length === 0
                    ? <th className="border border-border px-2 py-1.5 font-normal italic">Add products</th>
                    : columns.flatMap((c, ci) => c.map((id, pi) => (
                      <th key={id} className={cn("border-y border-border px-2 py-1.5 text-center font-semibold text-foreground", pi === 0 ? "border-l" : "border-l border-l-border/40", ci === columns.length - 1 && pi === c.length - 1 && "border-r")}>
                        {known.get(id)?.name ?? "Product"}
                      </th>
                    )))}
                </tr>
              </thead>
              <tbody>
                <tr className="text-foreground">
                  <td className="border border-border px-2 py-1.5">Juan Dela Cruz</td>
                  <td className="border border-border px-2 py-1.5">BSIT 2</td>
                  <td className="border border-border px-2 py-1.5">0917…</td>
                  {columns.length === 0
                    ? <td className="border border-border px-2 py-1.5" />
                    : columns.flat().map((id, k) => <td key={id} className="border border-border px-2 py-1.5 text-center font-semibold">{k === 0 ? "M-2" : ""}</td>)}
                  <td className="border border-border px-2 py-1.5">₱500</td>
                  <td className="border border-border px-2 py-1.5">Purchased</td>
                  <td className="border border-border px-2 py-1.5">Oct 14</td>
                </tr>
              </tbody>
            </table>
          </div>
          {products.length === 0 && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Package className="size-4" />Add products to your store first.</p>
          )}
        </div>
      </section>
    </div>
  )
}
