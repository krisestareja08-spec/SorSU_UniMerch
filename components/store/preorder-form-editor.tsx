"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Package, Plus, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog } from "@/components/ui/dialog"
import { ProductThumb } from "@/components/ui/product-thumb"
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
  const [picking, setPicking] = useState<number | null>(null)

  // Products saved on the form but since deleted still show by their saved name
  const known = new Map(products.map((p) => [p.id, p]))
  for (const c of initial?.columns ?? []) for (const p of c.products) if (!known.has(p.id)) known.set(p.id, { id: p.id, name: `${p.name} (deleted)`, preOrder: false, image: null })
  const used = new Set(cells.flat())
  const available = products.filter((p) => !used.has(p.id))

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
                <ul className="mt-2 space-y-1.5">
                  {cell.map((id) => (
                    <li key={id} className="flex items-center gap-2.5 rounded-lg border border-border bg-background p-1.5 pr-2">
                      <ProductThumb src={known.get(id)?.image} alt="" size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{known.get(id)?.name ?? "Product"}</span>
                      <button type="button" onClick={() => setCell(i, cell.filter((x) => x !== id))} aria-label={`Remove ${known.get(id)?.name ?? "product"}`}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"><X className="size-4" /></button>
                    </li>
                  ))}
                </ul>
                <Button type="button" size="sm" variant="outline" className="mt-2 w-full gap-1.5 border-dashed" disabled={available.length === 0} onClick={() => setPicking(i)}>
                  <Plus className="size-4" />{available.length ? (cell.length ? "Add another product" : "Add a product") : "All products are in a cell"}
                </Button>
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

      {picking != null && (
        <ProductPicker products={available} cell={picking + 1} onClose={() => setPicking(null)}
          onPick={(ids) => { setCell(picking, [...cells[picking], ...ids]); setPicking(null) }} />
      )}

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

/** Pick the products of a Size / Qty cell by their photos; pre-order products first. */
function ProductPicker({ products, cell, onClose, onPick }: {
  products: PickableProduct[]; cell: number; onClose: () => void; onPick: (ids: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const [chosen, setChosen] = useState<string[]>([])
  const q = query.trim().toLowerCase()
  const shown = products.filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => Number(b.preOrder) - Number(a.preOrder))
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  return (
    <Dialog open onClose={onClose} size="lg" title={`Add products to cell ${cell}`} description="Each product becomes a sub-column where buyers' sizes are written."
      footer={<>
        <Button type="button" variant="outline" className="ml-auto" onClick={onClose}>Cancel</Button>
        <Button type="button" disabled={chosen.length === 0} onClick={() => onPick(chosen)}>Add {chosen.length || ""} product{chosen.length === 1 ? "" : "s"}</Button>
      </>}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search your products" aria-label="Search your products"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm" />
        </div>
        {shown.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No products found.</p> : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {shown.map((p) => {
              const on = chosen.includes(p.id)
              return (
                <li key={p.id}>
                  <button type="button" aria-pressed={on} onClick={() => toggle(p.id)}
                    className={cn("relative flex w-full flex-col overflow-hidden rounded-xl border text-left transition-colors", on ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/40")}>
                    <span className="flex aspect-square w-full items-center justify-center bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.image ? <img src={p.image} alt="" loading="lazy" className="size-full object-cover" /> : <Package className="size-8 text-muted-foreground/40" />}
                    </span>
                    <span className="p-2">
                      <span className="line-clamp-2 text-xs font-semibold leading-tight">{p.name}</span>
                      {p.preOrder && <span className="mt-1 inline-block rounded-full bg-gold/15 px-1.5 text-[10px] font-semibold text-gold">Pre-order</span>}
                    </span>
                    {on && <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
