"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, X, Upload, FileText, Loader2, AlertCircle, Save, Store, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { addProduct } from "@/app/seller/products/actions"
import { computeRoyalty } from "@/lib/access"
import type { PaymentMode } from "@/lib/product-pricing"
import { cn } from "@/lib/utils"
import { unwrap } from "@/lib/action-result"
import { VariantEditor, draftsToInputs, validateDrafts, type VariantDraft } from "@/components/seller/variant-editor"

const CATEGORIES = ["Shirts & Uniforms", "Accessories", "Merch & Souvenirs", "Events & Tickets", "Office Supplies", "Food & Beverages", "Lace & ID Accessories", "Other"]
const BADGES = ["Available", "Pre-Order", "Interest Check"]
const MAX_IMAGES = 5
// How buyers may pay. Cashier and Supply Office are walk-in counters first; online is optional.
const PAYMENT_CHOICES: { value: string; modes: PaymentMode[]; label: string; hint: string }[] = [
  { value: "walk_in", modes: ["walk_in"],           label: "Walk-in only", hint: "Buyer pays at your counter" },
  { value: "online",  modes: ["online"],            label: "Online only",  hint: "GCash / bank transfer" },
  { value: "both",    modes: ["walk_in", "online"], label: "Both",         hint: "Buyer chooses at checkout" },
]

// Verified affiliations are unlocked when the Verification Admin approves a user's ID/COR.
const RESTRICTABLE: { value: string; label: string }[] = [
  { value: "student", label: "Verified Student" },
  { value: "faculty", label: "Verified Faculty (teaching)" },
  { value: "staff",   label: "Verified Staff (non-teaching)" },
  { value: "alumni",  label: "Verified Alumni" },
]

export function AddProductModal({ sellerId, module = "seller" }: { sellerId: string; module?: "seller" | "cashier" | "supply_office" }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [stock, setStock] = useState("")
  const [badge, setBadge] = useState("Available")
  const [sku, setSku] = useState("")
  const [tags, setTags] = useState("")
  // Sizes: each is its own variant with its own price, stock, SKU and optional image
  const [variantRows, setVariantRows] = useState<VariantDraft[]>([])
  // Optional: as soon as one size is added, price and stock are set per size
  const hasVariants = variantRows.length > 0
  const defaultPayment = module === "seller" ? "both" : "walk_in"
  const [payment, setPayment] = useState(defaultPayment)
  const [isRestricted, setIsRestricted] = useState(false)
  const [allowedRoles, setAllowedRoles] = useState<string[]>([])
  const [hasLogo, setHasLogo] = useState(false)
  const [royaltyPercentage, setRoyaltyPercentage] = useState(3)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase.from("bao_settings").select("global_royalty_percentage").eq("id", 1).maybeSingle()
      .then(({ data }) => { if (data?.global_royalty_percentage != null) setRoyaltyPercentage(Number(data.global_royalty_percentage)) })
  }, [open])

  function reset() {
    setName(""); setDescription(""); setCategory(""); setPrice(""); setStock(""); setBadge("Available")
    setSku(""); setTags(""); setVariantRows([]); setPayment(defaultPayment)
    setImageFiles([]); setImagePreviews([]); setError(null)
    setIsRestricted(false); setAllowedRoles([]); setHasLogo(false)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const room = MAX_IMAGES - imageFiles.length
    if (room <= 0) { setError(`You can upload up to ${MAX_IMAGES} images.`); return }
    const accepted = files.slice(0, room)
    for (const file of accepted) {
      if (file.size > 5 * 1024 * 1024) { setError("Each image must be under 5 MB."); return }
      if (!file.type.startsWith("image/")) { setError("Please select image files only."); return }
    }
    setImageFiles((prev) => [...prev, ...accepted])
    setImagePreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))])
    setError(null)
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  // Pre-orders are paid upfront online, so they always allow online payment
  const isPreOrder = badge === "Pre-Order"
  const paymentModes: PaymentMode[] = PAYMENT_CHOICES.find((c) => c.value === payment)!.modes
  const effectiveModes: PaymentMode[] = isPreOrder && !paymentModes.includes("online") ? [...paymentModes, "online"] : paymentModes

  function toggleAllowedRole(role: string) {
    setAllowedRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role])
  }

  async function handleSubmit(e: React.FormEvent, draft: boolean) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError("Product name is required."); return }
    if (!category) { setError("Please select a category."); return }
    // With sizes, each size carries its own price and stock (the product shows the range and total)
    if (hasVariants) {
      const problem = validateDrafts(variantRows)
      if (problem) { setError(problem); return }
    }
    const priceNum = hasVariants ? Math.min(...variantRows.map((r) => parseFloat(r.price))) : parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) { setError("Enter a valid price."); return }
    const stockNum = hasVariants ? variantRows.reduce((n, r) => n + parseInt(r.stock, 10), 0) : parseInt(stock, 10)
    if (isNaN(stockNum) || stockNum < 0) { setError("Enter a valid stock quantity."); return }
    if (imageFiles.length === 0) { setError("At least one product image is required."); return }
    if (isRestricted && allowedRoles.length === 0) { setError("Select who can buy this restricted product."); return }

    setLoading(true)
    try {
      const supabase = createClient()
      const imageUrls: string[] = []
      for (const file of imageFiles) {
        const ext = file.name.split(".").pop() || "jpg"
        const path = `${sellerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, file, { cacheControl: "3600", upsert: false })
        if (uploadError) {
          setError("Image upload failed. Make sure the product-images bucket exists in Supabase.")
          setLoading(false)
          return
        }
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path)
        imageUrls.push(urlData.publicUrl)
      }

      const formData = new FormData()

      formData.set("module", module)
      formData.set("name", name.trim())
      formData.set("description", description.trim())
      formData.set("category", category)
      formData.set("price", String(priceNum))
      formData.set("stock", String(stockNum))
      formData.set("badge", badge)
      if (sku.trim()) formData.set("sku", sku.trim())
      if (tags.trim()) formData.set("tags", tags.trim())
      if (hasVariants) formData.set("variants", JSON.stringify(await draftsToInputs(supabase, sellerId, variantRows)))
      formData.set("payment_modes", JSON.stringify(effectiveModes))
      formData.set("images", imageUrls.join(","))
      formData.set("draft", String(draft))
      formData.set("is_restricted", String(isRestricted))
      if (isRestricted) formData.set("allowed_roles", JSON.stringify(allowedRoles))
      formData.set("has_logo", String(hasLogo))

      unwrap(await addProduct(formData))
      reset()
      setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="shrink-0 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
        <Plus className="size-4" /> Add Product
      </Button>
    )
  }

  const priceNum = hasVariants && variantRows.length > 0
    ? Math.min(...variantRows.map((r) => parseFloat(r.price) || 0))
    : parseFloat(price) || 0
  const royaltyPreview = computeRoyalty(priceNum, hasLogo, royaltyPercentage)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-foreground">Add New Product</h2>
            <p className="text-xs text-muted-foreground">Save as draft, or publish to send it to BAO for review.</p>
          </div>
          <button onClick={() => { setOpen(false); reset() }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="flex flex-col gap-4 p-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Image upload (1-5) */}
          <div className="flex flex-col gap-2">
            <Label>Product Images * ({imagePreviews.length}/{MAX_IMAGES})</Label>
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleImageChange} />
            <div className="grid grid-cols-3 gap-2">
              {imagePreviews.map((src, i) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Preview ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {imagePreviews.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/30 transition-colors hover:border-primary/50 hover:bg-muted/60"
                >
                  <Upload className="size-6 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground">Add image</span>
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground/60">PNG, JPG, WEBP up to 5 MB each. First image is the cover photo.</span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="p-name">Product Name *</Label>
            <Input id="p-name" placeholder="e.g. CICT Department Shirt 2024" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="p-desc">Description</Label>
            <textarea
              id="p-desc"
              rows={3}
              placeholder="Describe your product, sizes, colors, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(value) => setCategory(value ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Listing Type</Label>
              <Select value={badge} onValueChange={(value) => setBadge(value ?? "Available")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BADGES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-price">Price (₱) *</Label>
              {hasVariants ? (
                <p className="flex h-8 items-center rounded-lg border border-dashed border-border px-2.5 text-xs text-muted-foreground">Set per size below</p>
              ) : (
                <Input id="p-price" type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} required />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-stock">Stock Quantity *</Label>
              {hasVariants ? (
                <p className="flex h-8 items-center rounded-lg border border-dashed border-border px-2.5 text-xs text-muted-foreground">Set per size below</p>
              ) : (
                <Input id="p-stock" type="number" min="0" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} required />
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-sku">SKU / Item Code</Label>
              <Input id="p-sku" placeholder="e.g. CICT-SHIRT-2024" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-tags">Tags (comma-separated)</Label>
              <Input id="p-tags" placeholder="e.g. shirt, uniform, CICT" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          </div>

          {/* Sizes: each one is a separate variant with its own price, stock, SKU and image */}
          <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <Label>Sizes / Variants <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <p className="text-[11px] text-muted-foreground">
              Add sizes if this product comes in different sizes. Each size gets its own price, stock and SKU, and optionally a photo. Buyers see the price range until they pick a size, then that size&apos;s exact price and stock.
            </p>
            <VariantEditor rows={variantRows} onChange={setVariantRows} />
          </div>

          {/* Payment modes the buyer can use for this product */}
          <div className="flex flex-col gap-2">
            <Label>Mode of Payment</Label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Mode of payment">
              {PAYMENT_CHOICES.map((c) => (
                <button key={c.value} type="button" role="radio" aria-checked={payment === c.value} onClick={() => setPayment(c.value)}
                  className={cn("flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-center transition-colors",
                    payment === c.value ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40")}>
                  <span className="flex items-center gap-1 text-xs font-semibold">
                    {c.modes.includes("walk_in") && <Store className="size-3.5" />}{c.modes.includes("online") && <Smartphone className="size-3.5" />}
                    {c.label}
                  </span>
                  <span className="text-[10px] leading-tight">{c.hint}</span>
                </button>
              ))}
            </div>
            {isPreOrder && !paymentModes.includes("online") && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">Pre-orders are paid upfront online, so online payment will also be allowed for this product.</p>
            )}
          </div>

          {/* Restricted access */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" checked={isRestricted} onChange={(e) => setIsRestricted(e.target.checked)} />
              Restrict this product to verified users
            </label>
            {isRestricted && (
              <div className="flex flex-wrap gap-2 pt-1">
                {RESTRICTABLE.map(({ value: r, label }) => (
                  <label key={r} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${allowedRoles.includes(r) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    <input type="checkbox" checked={allowedRoles.includes(r)} onChange={() => toggleAllowedRole(r)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Logo royalty */}
          <div className="flex flex-col gap-2 rounded-xl border border-gold/30 bg-gold/5 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" checked={hasLogo} onChange={(e) => setHasLogo(e.target.checked)} />
              Uses official university logo
            </label>
            {hasLogo && (
              <p className="text-xs text-muted-foreground">
                A {royaltyPercentage}% BAO royalty applies. Buyers pay ₱{priceNum.toLocaleString()}; ₱{royaltyPreview.royaltyAmount.toLocaleString()} per sale goes to BAO and you receive ₱{royaltyPreview.finalPrice.toLocaleString()}.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => { setOpen(false); reset() }}>
              Cancel
            </Button>
            <Button type="button" variant="outline" disabled={loading} className="flex-1 gap-2" onClick={(e) => handleSubmit(e, true)}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save as Draft
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? <><Loader2 className="size-4 animate-spin" /> Submitting...</> : <><FileText className="size-4" /> Publish</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
