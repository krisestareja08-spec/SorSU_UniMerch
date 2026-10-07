"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, Ruler, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { saveVariants } from "@/app/seller/products/actions"
import { unwrap } from "@/lib/action-result"
import { loadVariants } from "@/lib/variants"
import type { ModuleKey } from "@/lib/modules"
import { VariantEditor, draftFromVariant, draftsToInputs, emptyDraft, validateDrafts, type VariantDraft } from "@/components/seller/variant-editor"

/** "Sizes & Prices" on a store's product card: edit each size's price, stock, SKU and image. */
export function EditVariantsButton({
  productId,
  productName,
  storeId,
  module,
  basePrice,
  legacySizes = [],
}: {
  productId: string
  productName: string
  storeId: string
  module: ModuleKey
  basePrice: number
  /** Size names saved before variants existed; offered as a starting point */
  legacySizes?: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<VariantDraft[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openEditor() {
    setOpen(true)
    setError(null)
    setRows(null)
    const map = await loadVariants(createClient(), [productId])
    if (!map) { setError("Sizes with their own price and stock need scripts/28_product_variants.sql. Ask the admin to run it in Supabase."); setRows([]); return }
    const variants = map.get(productId) ?? []
    setRows(variants.length
      ? variants.map(draftFromVariant)
      : legacySizes.length
        ? legacySizes.map((s) => ({ ...emptyDraft(s), price: String(basePrice) }))
        : [emptyDraft()])
  }

  async function save() {
    if (!rows) return
    const problem = validateDrafts(rows)
    if (problem) { setError(problem); return }
    setSaving(true)
    setError(null)
    try {
      const inputs = await draftsToInputs(createClient(), storeId, rows)
      unwrap(await saveVariants(productId, module, JSON.stringify(inputs)))
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the sizes.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" onClick={openEditor}
        className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-primary/20 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/8">
        <Ruler className="size-3" />Sizes &amp; Prices
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Sizes for ${productName}`}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-serif text-lg font-semibold text-foreground">Sizes &amp; Prices</h2>
                <p className="truncate text-xs text-muted-foreground">{productName}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <p className="text-xs text-muted-foreground">Each size has its own price, stock, SKU and optional photo. Buyers see the range until they pick a size.</p>
              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />{error}
                </p>
              )}
              {rows === null ? <Loader2 className="mx-auto my-6 size-6 animate-spin text-primary" /> : <VariantEditor rows={rows} onChange={setRows} />}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="button" className="flex-1 gap-2" disabled={saving || !rows?.length} onClick={save}>
                  {saving && <Loader2 className="size-4 animate-spin" />}Save sizes
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
