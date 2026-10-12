"use client"

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { AlertCircle, AlertTriangle, ImagePlus, Loader2, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { updateProduct } from "@/app/seller/products/actions"
import { unwrap } from "@/lib/action-result"
import { compressImage } from "@/lib/image-compress"
import type { ModuleKey } from "@/lib/modules"
import type { PaymentMode } from "@/lib/product-pricing"
import { cn } from "@/lib/utils"
import { BADGES, CATEGORIES, MAX_IMAGES, PAYMENT_CHOICES, RESTRICTABLE } from "@/components/seller/add-product-modal"

/** The product row as the store's Products page loads it (select *) */
export type EditableProduct = {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  badge: string
  status: string
  image_url: string | null
  images?: string[] | null
  sku?: string | null
  tags?: string[] | null
  payment_modes?: string[] | null
  is_restricted?: boolean | null
  allowed_roles?: string[] | null
  has_logo?: boolean | null
  supply_office_collab?: boolean | null
  variations?: unknown
}

type Photo = { url: string; file?: File }

const fieldClass = "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"

/**
 * "Edit product" on a store's product card. Badge, payment and price changes stay live; changing the
 * name, description, category, photos, logo or restriction of a live product sends it to BAO again.
 */
export function EditProductButton({ product, storeId, module }: { product: EditableProduct; storeId: string; module: ModuleKey }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const initialPhotos = (): Photo[] =>
    (product.images?.length ? product.images : product.image_url ? [product.image_url] : []).map((url) => ({ url }))
  const initialPayment = () => {
    const modes = [...(product.payment_modes ?? ["walk_in", "online"])].sort().join(",")
    return PAYMENT_CHOICES.find((c) => [...c.modes].sort().join(",") === modes)?.value ?? "both"
  }

  const [name, setName] = useState(product.name)
  const [description, setDescription] = useState(product.description ?? "")
  const [category, setCategory] = useState(product.category)
  const [price, setPrice] = useState(String(product.price))
  const [badge, setBadge] = useState(product.badge)
  const [sku, setSku] = useState(product.sku ?? "")
  const [tags, setTags] = useState((product.tags ?? []).join(", "))
  const [payment, setPayment] = useState(initialPayment)
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [isRestricted, setIsRestricted] = useState(!!product.is_restricted)
  const [allowedRoles, setAllowedRoles] = useState<string[]>(product.allowed_roles ?? [])
  const [hasLogo, setHasLogo] = useState(!!product.has_logo)
  const [collab, setCollab] = useState(!!product.supply_office_collab)

  const hasSizes = Array.isArray(product.variations) && product.variations.length > 0
  const canCollab = module === "seller"
  const live = product.status === "approved"
  const resubmits = product.status === "rejected" || product.status === "pulled"

  // Would saving send a live product back to BAO? (same fields the server checks)
  const sameList = (a: string[], b: string[]) => [...a].sort().join("|") === [...b].sort().join("|")
  const reviewedChange =
    name.trim() !== product.name || description.trim() !== (product.description ?? "") || category !== product.category
    || !sameList(photos.map((p) => p.url), initialPhotos().map((p) => p.url))
    || hasLogo !== !!product.has_logo || (canCollab && hasLogo && collab) !== !!product.supply_office_collab
    || isRestricted !== !!product.is_restricted || !sameList(isRestricted ? allowedRoles : [], product.is_restricted ? product.allowed_roles ?? [] : [])

  function openForm() {
    // Start from the saved product every time
    setName(product.name); setDescription(product.description ?? ""); setCategory(product.category)
    setPrice(String(product.price)); setBadge(product.badge); setSku(product.sku ?? ""); setTags((product.tags ?? []).join(", "))
    setPayment(initialPayment()); setPhotos(initialPhotos()); setIsRestricted(!!product.is_restricted)
    setAllowedRoles(product.allowed_roles ?? []); setHasLogo(!!product.has_logo); setCollab(!!product.supply_office_collab)
    setError(null); setNotice(null); setOpen(true)
  }

  function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    const room = MAX_IMAGES - photos.length
    if (room <= 0) { setError(`You can have up to ${MAX_IMAGES} photos.`); return }
    for (const f of files) {
      if (!f.type.startsWith("image/")) { setError("Please select image files only."); return }
      if (f.size > 5 * 1024 * 1024) { setError("Each image must be under 5 MB."); return }
    }
    setError(null)
    setPhotos((prev) => [...prev, ...files.slice(0, room).map((file) => ({ url: URL.createObjectURL(file), file }))])
  }

  async function save() {
    setError(null)
    if (!name.trim()) { setError("Product name is required."); return }
    if (photos.length === 0) { setError("Keep at least one photo."); return }
    if (isRestricted && allowedRoles.length === 0) { setError("Select who can buy this restricted product."); return }
    if (!hasSizes && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) { setError("Enter a valid price."); return }
    setSaving(true)
    try {
      // Upload new photos; keep the order the store arranged
      const supabase = createClient()
      const urls: string[] = []
      for (const p of photos) {
        if (!p.file) { urls.push(p.url); continue }
        const file = await compressImage(p.file)
        const ext = file.name.split(".").pop() || "jpg"
        const path = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false })
        if (upErr) throw new Error("A photo couldn't be uploaded. Please try again.")
        urls.push(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl)
      }

      const fd = new FormData()
      fd.set("module", module)
      fd.set("product_id", product.id)
      fd.set("name", name.trim())
      fd.set("description", description.trim())
      fd.set("category", category)
      if (!hasSizes) fd.set("price", price)
      fd.set("badge", badge)
      fd.set("sku", sku.trim())
      fd.set("tags", tags)
      fd.set("payment_modes", JSON.stringify(PAYMENT_CHOICES.find((c) => c.value === payment)?.modes ?? (["walk_in", "online"] as PaymentMode[])))
      fd.set("images", urls.join(","))
      fd.set("is_restricted", String(isRestricted))
      if (isRestricted) fd.set("allowed_roles", JSON.stringify(allowedRoles))
      fd.set("has_logo", String(hasLogo))
      fd.set("supply_office_collab", String(canCollab && hasLogo && collab))

      const result = unwrap(await updateProduct(fd))
      router.refresh()
      if (result.sentForReview) {
        setNotice("Saved and sent to BAO for review. It will be back on the marketplace once approved.")
      } else {
        setOpen(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the product.")
    } finally {
      setSaving(false)
    }
  }

  const categories = CATEGORIES.includes(product.category) ? CATEGORIES : [product.category, ...CATEGORIES]
  const badges = BADGES.includes(product.badge) ? BADGES : [...BADGES, product.badge]

  return (
    <>
      <button type="button" onClick={openForm}
        className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
        <Pencil className="size-3" />Edit product
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 backdrop-blur-sm"
          role="dialog" aria-modal="true" aria-labelledby={`edit-${product.id}`}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 id={`edit-${product.id}`} className="font-serif text-lg font-semibold">Edit product</h2>
                <p className="truncate text-xs text-muted-foreground">{product.name}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
            </div>

            {notice ? (
              <div className="space-y-4 p-5">
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{notice}</p>
                <Button type="button" className="w-full" onClick={() => setOpen(false)}>Done</Button>
              </div>
            ) : (
              <div className="space-y-5 p-5">
                {/* Live product: say up front what will need BAO */}
                {live && reviewedChange && (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    You changed details BAO reviews (name, description, category, photos, logo or restriction). Saving takes this product off the marketplace until BAO approves it again.
                  </p>
                )}
                {resubmits && (
                  <p className="rounded-lg bg-primary/5 p-3 text-xs text-foreground">Saving resubmits this product to BAO for review.</p>
                )}

                <div>
                  <Label htmlFor={`name-${product.id}`}>Product name</Label>
                  <Input id={`name-${product.id}`} className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor={`desc-${product.id}`}>Description</Label>
                  <textarea id={`desc-${product.id}`} rows={3} className={cn(fieldClass, "resize-none")} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`cat-${product.id}`}>Category</Label>
                    <select id={`cat-${product.id}`} className={cn(fieldClass, "h-10")} value={category} onChange={(e) => setCategory(e.target.value)}>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={`badge-${product.id}`}>Availability</Label>
                    <select id={`badge-${product.id}`} className={cn(fieldClass, "h-10")} value={badge} onChange={(e) => setBadge(e.target.value)}>
                      {badges.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor={`price-${product.id}`}>Price (₱)</Label>
                  {hasSizes ? (
                    <p className="mt-1.5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">This product has sizes — set each size&apos;s price and stock with <strong className="text-foreground">Sizes &amp; Prices</strong>.</p>
                  ) : (
                    <Input id={`price-${product.id}`} type="number" min="0" step="0.01" inputMode="decimal" className="mt-1.5 w-40" value={price} onChange={(e) => setPrice(e.target.value)} />
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">Stock is changed on the Inventory page, so every change is recorded.</p>
                </div>

                {/* Photos */}
                <div>
                  <p className="text-sm font-medium">Photos <span className="font-normal text-muted-foreground">({photos.length}/{MAX_IMAGES} · the first is the cover)</span></p>
                  <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {photos.map((p, i) => (
                      <div key={p.url} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                        <Image src={p.url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="96px" unoptimized={!!p.file} />
                        {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-semibold text-white">Cover</span>}
                        <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}
                          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><X className="size-3.5" /></button>
                      </div>
                    ))}
                    {photos.length < MAX_IMAGES && (
                      <button type="button" onClick={() => fileRef.current?.click()}
                        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-[11px] font-medium text-muted-foreground hover:border-primary/50">
                        <ImagePlus className="size-5" />Add
                      </button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={addPhotos} />
                </div>

                <fieldset>
                  <legend className="text-sm font-medium">How buyers pay</legend>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {PAYMENT_CHOICES.map((c) => (
                      <button key={c.value} type="button" onClick={() => setPayment(c.value)} aria-pressed={payment === c.value}
                        className={cn("rounded-lg border px-2 py-2 text-xs font-medium", payment === c.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`sku-${product.id}`}>SKU <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input id={`sku-${product.id}`} className="mt-1.5" value={sku} onChange={(e) => setSku(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor={`tags-${product.id}`}>Tags <span className="font-normal text-muted-foreground">(comma-separated)</span></Label>
                    <Input id={`tags-${product.id}`} className="mt-1.5" value={tags} onChange={(e) => setTags(e.target.value)} />
                  </div>
                </div>

                {/* Restriction */}
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-primary" checked={isRestricted} onChange={(e) => setIsRestricted(e.target.checked)} />
                    Restrict who can buy this product
                  </label>
                  {isRestricted && (
                    <div className="flex flex-wrap gap-2">
                      {RESTRICTABLE.map(({ value, label }) => (
                        <button key={value} type="button" aria-pressed={allowedRoles.includes(value)}
                          onClick={() => setAllowedRoles((prev) => prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value])}
                          className={cn("rounded-lg border px-2.5 py-1.5 text-xs", allowedRoles.includes(value) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Logo royalty */}
                <div className="space-y-2 rounded-xl border border-gold/30 bg-gold/5 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-primary" checked={hasLogo} onChange={(e) => setHasLogo(e.target.checked)} />
                    Uses official university logo
                  </label>
                  {hasLogo && canCollab && (
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={collab} onChange={(e) => setCollab(e.target.checked)} />
                      <span>In collaboration with the Main Supply Office <span className="block text-xs text-muted-foreground">The Supply Office pays this product&apos;s royalty.</span></span>
                    </label>
                  )}
                  {hasLogo && <p className="text-xs text-muted-foreground">A BAO royalty applies to each sale at the current rate.</p>}
                </div>

                {error && (
                  <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />{error}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                  <Button type="button" className="flex-1 gap-2" onClick={save} disabled={saving}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {resubmits || (live && reviewedChange) ? "Save & send to BAO" : "Save changes"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
