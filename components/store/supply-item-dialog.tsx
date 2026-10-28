"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, Check, Minus, Package, Palette, Plus, Search, Shirt, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog } from "@/components/ui/dialog"
import { ProductThumb } from "@/components/ui/product-thumb"
import { ITEM_KIND_LABEL, type PickProduct, type SupplyItemKind } from "@/lib/supply-request-shape"
import { cn } from "@/lib/utils"

/** One item of a supply request while it's being written. Sizes are quantities per size. */
export type ItemDraft = {
  key: string; kind: SupplyItemKind; productId: string; name: string; notes: string
  usesLogo: boolean; listOnMarketplace: boolean
  /** Product items: variant id (or "one") → units */
  qty: Record<string, string>
  /** New designs: free sizes */
  lines: { key: string; size: string; qty: string }[]
}

export const KIND_INFO: Record<SupplyItemKind, { icon: typeof Package; help: string }> = {
  catalog: { icon: Package, help: "Something the Supply Office already sells, as it is." },
  modified: { icon: Wrench, help: "A Supply Office item with changes — your print, colour or logo." },
  custom: { icon: Palette, help: "A new design you want made, e.g. an organization uniform." },
  collab_stock: { icon: Shirt, help: "More stock for one of your collaboration products." },
}

export const newKey = () => Math.random().toString(36).slice(2, 10)
export const emptyDraft = (kind: SupplyItemKind): ItemDraft => ({
  key: newKey(), kind, productId: "", name: "", notes: "", usesLogo: false, listOnMarketplace: false, qty: {},
  lines: kind === "custom" ? [{ key: newKey(), size: "", qty: "" }] : [],
})
const QUICK_SIZES = ["XS", "S", "M", "L", "XL", "2XL"]

function Qty({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const n = Number(value) || 0
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(String(Math.max(0, n - 1)))} aria-label={`Fewer ${label}`}
        className="flex size-8 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40" disabled={n <= 0}><Minus className="size-3.5" /></button>
      <input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" aria-label={`Units of ${label}`}
        className="h-8 w-14 rounded-lg border border-input bg-background text-center text-sm font-semibold tabular-nums" />
      <button type="button" onClick={() => onChange(String(n + 1))} aria-label={`More ${label}`}
        className="flex size-8 items-center justify-center rounded-lg border border-border hover:bg-muted"><Plus className="size-3.5" /></button>
    </div>
  )
}

/**
 * Adding (or editing) one item of a supply request, step by step: what kind of item, which product
 * (picked by photo) or design, then how many of each size.
 */
export function SupplyItemDialog({ open, onClose, onSave, initial, kinds, catalog, collab, designImage, allowMarketplace }: {
  open: boolean; onClose: () => void; onSave: (d: ItemDraft) => void; initial?: ItemDraft | null
  kinds: SupplyItemKind[]; catalog: PickProduct[]; collab: PickProduct[]; designImage?: string | null; allowMarketplace: boolean
}) {
  const [draft, setDraft] = useState<ItemDraft | null>(initial ?? null)
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<ItemDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  const products = draft?.kind === "collab_stock" ? collab : catalog
  const product = products.find((p) => p.id === draft?.productId)
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => products.filter((p) => !q || p.name.toLowerCase().includes(q)), [products, q])
  const units = draft ? (draft.kind === "custom" ? draft.lines.reduce((n, l) => n + (Number(l.qty) || 0), 0) : Object.values(draft.qty).reduce((n, v) => n + (Number(v) || 0), 0)) : 0

  function save() {
    if (!draft) return
    if (draft.kind === "custom" && !draft.name.trim()) return setError("Name the design.")
    if (draft.kind !== "custom" && !draft.productId) return setError("Pick a product.")
    if (units < 1) return setError("Enter how many you need.")
    onSave(draft)
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg"
      title={!draft ? "Add an item" : initial ? `Edit: ${ITEM_KIND_LABEL[draft.kind]}` : ITEM_KIND_LABEL[draft.kind]}
      description={!draft ? "What kind of item do you need?" : KIND_INFO[draft.kind].help}
      footer={draft ? <>
        {!initial && <Button type="button" variant="ghost" className="gap-1.5" onClick={() => { setDraft(null); setError(null) }}><ArrowLeft className="size-4" />Type</Button>}
        <span className="ml-auto text-sm text-muted-foreground">{units} unit{units === 1 ? "" : "s"}</span>
        <Button type="button" onClick={save} className="gap-1.5"><Check className="size-4" />{initial ? "Save item" : "Add to request"}</Button>
      </> : undefined}>
      {!draft ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {kinds.map((k) => {
            const Icon = KIND_INFO[k].icon
            return (
              <button key={k} type="button" onClick={() => setDraft(emptyDraft(k))}
                className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
                <span><span className="block font-semibold">{ITEM_KIND_LABEL[k]}</span><span className="block text-xs text-muted-foreground">{KIND_INFO[k].help}</span></span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1 · Which product / design */}
          {draft.kind === "custom" ? (
            <div className="flex items-start gap-3">
              <ProductThumb src={designImage} alt="" size="lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Design name, e.g. CICT Org Hoodie" aria-label="Design name" />
                <textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} maxLength={2000} aria-label="Describe the design"
                  placeholder="Colours, materials, print, where the logo goes… (add photos in Design files)" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          ) : product ? (
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <ProductThumb src={product.image} alt={product.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.sizes.length ? `${product.sizes.length} sizes` : "One size"}{draft.kind === "catalog" ? ` · from ₱${Math.min(product.price, ...product.sizes.map((s) => s.price)).toLocaleString()}` : ""}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => set({ productId: "", qty: {} })}>Change</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search products" aria-label="Search products"
                  className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm" />
              </div>
              {shown.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {products.length === 0 ? (draft.kind === "collab_stock" ? "You have no collaboration products yet." : "The Supply Office has no products yet.") : "No products match."}
                </p>
              ) : (
                <ul className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {shown.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => { set({ productId: p.id, qty: {} }); setError(null) }}
                        className="flex w-full flex-col overflow-hidden rounded-xl border border-border text-left transition-colors hover:border-primary/50">
                        <span className="flex aspect-square w-full items-center justify-center bg-muted">
                          {p.image
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={p.image} alt="" loading="lazy" className="size-full object-cover" />
                            : <Package className="size-8 text-muted-foreground/40" />}
                        </span>
                        <span className="px-2 py-1.5">
                          <span className="line-clamp-2 text-xs font-semibold leading-snug">{p.name}</span>
                          <span className="block text-[11px] text-muted-foreground">{p.sizes.length ? `${p.sizes.length} sizes` : "One size"}{draft.kind === "catalog" ? ` · ₱${p.price.toLocaleString()}` : ""}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 2 · How many of each size */}
          {(draft.kind === "custom" || product) && (
            <section className="space-y-2">
              <p className="text-sm font-semibold">How many?</p>
              {draft.kind === "custom" ? (
                <>
                  <ul className="space-y-1.5">
                    {draft.lines.map((l) => (
                      <li key={l.key} className="flex items-center gap-2">
                        <Input value={l.size} onChange={(e) => set({ lines: draft.lines.map((x) => (x.key === l.key ? { ...x, size: e.target.value } : x)) })}
                          placeholder="Size (optional)" aria-label="Size" className="h-8 w-32 text-sm" />
                        <Qty label={l.size || "this size"} value={l.qty} onChange={(v) => set({ lines: draft.lines.map((x) => (x.key === l.key ? { ...x, qty: v } : x)) })} />
                        {draft.lines.length > 1 && (
                          <button type="button" onClick={() => set({ lines: draft.lines.filter((x) => x.key !== l.key) })} aria-label="Remove size" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Add sizes:</span>
                    {QUICK_SIZES.filter((s) => !draft.lines.some((l) => l.size.toUpperCase() === s)).map((s) => (
                      <button key={s} type="button" className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium hover:bg-muted"
                        onClick={() => set({ lines: [...draft.lines.filter((l) => l.size || l.qty), { key: newKey(), size: s, qty: "" }] })}>+ {s}</button>
                    ))}
                    <button type="button" className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-medium hover:bg-muted"
                      onClick={() => set({ lines: [...draft.lines, { key: newKey(), size: "", qty: "" }] })}>+ Other</button>
                  </div>
                </>
              ) : product!.sizes.length ? (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {product!.sizes.map((s) => (
                    <li key={s.id} className={cn("flex items-center gap-3 px-3 py-2", Number(draft.qty[s.id]) > 0 && "bg-primary/5")}>
                      <span className="min-w-12 rounded-md bg-muted px-2 py-0.5 text-center text-sm font-semibold">{s.name}</span>
                      {draft.kind === "catalog" && <span className="text-xs text-muted-foreground">₱{s.price.toLocaleString()}</span>}
                      <div className="ml-auto"><Qty label={s.name} value={draft.qty[s.id] ?? ""} onChange={(v) => set({ qty: { ...draft.qty, [s.id]: v } })} /></div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Qty label={product!.name} value={draft.qty.one ?? ""} onChange={(v) => set({ qty: { one: v } })} />
              )}
            </section>
          )}

          {/* 3 · Changes and options */}
          {draft.kind === "modified" && product && (
            <textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} maxLength={2000} aria-label="What to change"
              placeholder="What to change: print, colour, embroidery, name tags…" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          )}
          {draft.kind === "custom" && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.usesLogo} onChange={(e) => set({ usesLogo: e.target.checked })} className="size-4 accent-primary" />
              Uses the official university logo <span className="text-xs text-muted-foreground">(royalty applies)</span></label>
          )}
          {allowMarketplace && (draft.kind === "custom" || (draft.kind === "modified" && product)) && (
            <label className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm">
              <input type="checkbox" checked={draft.listOnMarketplace} onChange={(e) => set({ listOnMarketplace: e.target.checked })} className="mt-0.5 size-4 accent-primary" />
              <span><span className="font-medium">Also sell it on the marketplace</span>
                <span className="block text-xs text-muted-foreground">When it&apos;s delivered, a product draft with its photos, sizes and the delivered units appears in your Products — set the price and submit it for BAO review. Leave unticked for a one-time order.</span></span>
            </label>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </Dialog>
  )
}
