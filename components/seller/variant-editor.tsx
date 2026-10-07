"use client"

import { useRef, useState } from "react"
import { ImagePlus, Plus, X } from "lucide-react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { variantName, type Variant, type VariantInput } from "@/lib/variants"

/** One size row while the seller is editing (numbers stay strings until saved). */
export type VariantDraft = {
  key: string
  id?: string
  size: string
  color: string
  price: string
  stock: string
  sku: string
  imageUrl: string | null
  imageFile: File | null
  preview: string | null
}

let seq = 0
const newKey = () => `v${Date.now()}-${seq++}`

export function emptyDraft(size = ""): VariantDraft {
  return { key: newKey(), size, color: "", price: "", stock: "", sku: "", imageUrl: null, imageFile: null, preview: null }
}

export function draftFromVariant(v: Variant): VariantDraft {
  return {
    key: newKey(), id: v.id, size: v.size ?? v.name, color: v.color ?? "", price: String(v.price), stock: String(v.stock),
    sku: v.sku ?? "", imageUrl: v.imageUrl, imageFile: null, preview: v.imageUrl,
  }
}

/** First problem with the rows, or null when they can be saved. */
export function validateDrafts(rows: VariantDraft[]): string | null {
  if (rows.length === 0) return "Add at least one size."
  const names = new Set<string>()
  for (const r of rows) {
    if (!r.size.trim()) return "Every variant needs a size."
    const name = variantName(r.size, r.color).toLowerCase()
    if (names.has(name)) return `"${variantName(r.size, r.color)}" is listed twice.`
    names.add(name)
    const price = Number.parseFloat(r.price)
    if (!Number.isFinite(price) || price < 0) return `Enter a price for ${variantName(r.size, r.color)}.`
    const stock = Number.parseInt(r.stock, 10)
    if (!Number.isFinite(stock) || stock < 0) return `Enter the stock for ${variantName(r.size, r.color)}.`
    if (r.imageFile && r.imageFile.size > 5 * 1024 * 1024) return "Each variant image must be under 5 MB."
  }
  return null
}

/** Uploads any new variant images and returns the rows ready for the server action. */
export async function draftsToInputs(supabase: SupabaseClient, storeId: string, rows: VariantDraft[]): Promise<VariantInput[]> {
  const out: VariantInput[] = []
  for (const r of rows) {
    let imageUrl = r.imageUrl
    if (r.imageFile) {
      const ext = r.imageFile.name.split(".").pop() || "jpg"
      const path = `${storeId}/variants/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from("product-images").upload(path, r.imageFile, { cacheControl: "3600", upsert: false })
      if (error) throw new Error("A variant image couldn't be uploaded. Please try again.")
      imageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl
    }
    out.push({
      id: r.id, size: r.size.trim(), color: r.color.trim() || null, price: Number.parseFloat(r.price),
      stock: Number.parseInt(r.stock, 10), sku: r.sku.trim() || null, imageUrl,
    })
  }
  return out
}

/** Seller's table of sizes: each with its own price, stock, SKU and optional image. */
export function VariantEditor({ rows, onChange }: { rows: VariantDraft[]; onChange: (rows: VariantDraft[]) => void }) {
  const [quick, setQuick] = useState("")
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const update = (key: string, patch: Partial<VariantDraft>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  function addQuick() {
    const sizes = quick.split(",").map((s) => s.trim()).filter(Boolean)
    const existing = new Set(rows.map((r) => r.size.trim().toLowerCase()))
    const fresh = sizes.filter((s) => !existing.has(s.toLowerCase())).map((s) => emptyDraft(s))
    // A single empty starter row is replaced by the typed sizes
    const base = rows.length === 1 && !rows[0].size && !rows[0].price && !rows[0].stock ? [] : rows
    onChange([...base, ...fresh])
    setQuick("")
  }

  const totalStock = rows.reduce((n, r) => n + (Number.parseInt(r.stock, 10) || 0), 0)
  const prices = rows.map((r) => Number.parseFloat(r.price)).filter(Number.isFinite)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input placeholder="Add sizes quickly, e.g. S, M, L, XL" value={quick} onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQuick() } }} className="text-xs" aria-label="Add sizes" />
        <Button type="button" variant="outline" size="sm" onClick={addQuick} disabled={!quick.trim()} className="shrink-0 gap-1">
          <Plus className="size-3.5" />Add
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.key} className="rounded-xl border border-border bg-muted/20 p-2.5">
            <div className="flex items-start gap-2.5">
              {/* Optional image for this size */}
              <input ref={(el) => { fileRefs.current[r.key] = el }} type="file" accept="image/*" className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) update(r.key, { imageFile: file, preview: URL.createObjectURL(file) })
                }} />
              <button type="button" onClick={() => fileRefs.current[r.key]?.click()} aria-label={`Image for ${r.size || `variant ${i + 1}`}`}
                className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-background hover:border-primary/50">
                {r.preview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={r.preview} alt="" className="h-full w-full object-cover" />
                  : <ImagePlus className="size-5 text-muted-foreground/60" />}
              </button>

              <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3">
                <Input value={r.size} onChange={(e) => update(r.key, { size: e.target.value })} placeholder="Size *" aria-label="Size" className="h-8 text-xs" />
                <Input value={r.color} onChange={(e) => update(r.key, { color: e.target.value })} placeholder="Colour (optional)" aria-label="Colour" className="h-8 text-xs" />
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                  <Input type="number" min="0" step="0.01" value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} placeholder="Price *" aria-label="Price" className="h-8 pl-6 text-xs" />
                </div>
                <Input type="number" min="0" step="1" value={r.stock} onChange={(e) => update(r.key, { stock: e.target.value })} placeholder="Stock *" aria-label="Stock" className="h-8 text-xs" />
                <Input value={r.sku} onChange={(e) => update(r.key, { sku: e.target.value })} placeholder="SKU / item code" aria-label="SKU" className="col-span-2 h-8 text-xs sm:col-span-2" />
              </div>

              <button type="button" onClick={() => onChange(rows.filter((x) => x.key !== r.key))} aria-label={`Remove ${r.size || `variant ${i + 1}`}`}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive">
                <X className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rows, emptyDraft()])} className="gap-1 text-xs">
          <Plus className="size-3.5" />Add another size
        </Button>
        {rows.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {rows.length} size{rows.length === 1 ? "" : "s"} · {totalStock} in stock
            {prices.length > 0 && <> · ₱{Math.min(...prices).toLocaleString()}{Math.max(...prices) !== Math.min(...prices) && <>–₱{Math.max(...prices).toLocaleString()}</>}</>}
          </p>
        )}
      </div>
    </div>
  )
}
