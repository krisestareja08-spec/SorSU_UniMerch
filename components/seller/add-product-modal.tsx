"use client"

import { useState, useRef } from "react"
import { Plus, X, Upload, FileText, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { addProduct } from "@/app/seller/products/actions"

const CATEGORIES = ["Shirts & Uniforms", "Accessories", "Merch & Souvenirs", "Events & Tickets", "Office Supplies", "Food & Beverages", "Lace & ID Accessories", "Other"]
const BADGES = ["Available", "Pre-Order", "Interest Check"]
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "One Size"]

export function AddProductModal({ sellerId }: { sellerId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [stock, setStock] = useState("")
  const [badge, setBadge] = useState("Available")
  const [sku, setSku] = useState("")
  const [tags, setTags] = useState("")
  const [sizes, setSizes] = useState<string[]>([])
  const [customVariant, setCustomVariant] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setName(""); setDescription(""); setCategory(""); setPrice(""); setStock(""); setBadge("Available")
    setSku(""); setTags(""); setSizes([]); setCustomVariant("")
    setImageFile(null); setImagePreview(null); setError(null)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5 MB."); return }
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError("Product name is required."); return }
    if (!category) { setError("Please select a category."); return }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) { setError("Enter a valid price."); return }
    const stockNum = parseInt(stock, 10)
    if (isNaN(stockNum) || stockNum < 0) { setError("Enter a valid stock quantity."); return }

    setLoading(true)
    try {
      let imageUrl: string | null = null

      if (imageFile) {
        const supabase = createClient()
        const ext = imageFile.name.split(".").pop() || "jpg"
        const path = `${sellerId}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, imageFile, { cacheControl: "3600", upsert: false })

        if (uploadError) {
          setError("Image upload failed. Make sure the product-images bucket exists in Supabase.")
          setLoading(false)
          return
        }

        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path)
        imageUrl = urlData.publicUrl
      }

      const formData = new FormData()
      formData.set("name", name.trim())
      formData.set("description", description.trim())
      formData.set("category", category)
      formData.set("price", String(priceNum))
      formData.set("stock", String(stockNum))
      formData.set("badge", badge)
      if (sku.trim()) formData.set("sku", sku.trim())
      if (tags.trim()) formData.set("tags", tags.trim())
      const allVariants = [...sizes, ...(customVariant.trim() ? customVariant.split(",").map((s) => s.trim()).filter(Boolean) : [])]
      if (allVariants.length > 0) formData.set("variations", JSON.stringify(allVariants))
      if (imageUrl) formData.set("image_url", imageUrl)

      await addProduct(formData)
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-foreground">Add New Product</h2>
            <p className="text-xs text-muted-foreground">Submitted products go to BAO for review before going live.</p>
          </div>
          <button onClick={() => { setOpen(false); reset() }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Image upload */}
          <div className="flex flex-col gap-2">
            <Label>Product Image</Label>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
            {imagePreview ? (
              <div className="relative h-40 w-full overflow-hidden rounded-xl border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = "" }}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-8 transition-colors hover:border-primary/50 hover:bg-muted/60"
              >
                <Upload className="size-8 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">Click to upload image</span>
                <span className="text-xs text-muted-foreground/60">PNG, JPG, WEBP up to 5 MB</span>
              </button>
            )}
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
              <Input id="p-price" type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-stock">Stock Quantity *</Label>
              <Input id="p-stock" type="number" min="0" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} required />
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

          <div className="flex flex-col gap-2">
            <Label>Size Variations</Label>
            <div className="flex flex-wrap gap-2">
              {SIZE_OPTIONS.map((s) => (
                <button key={s} type="button"
                  onClick={() => setSizes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                  className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                    sizes.includes(s) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
            <Input placeholder="Custom variations (comma-separated, e.g. 27, 28, 29)" value={customVariant} onChange={(e) => setCustomVariant(e.target.value)} className="text-xs" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => { setOpen(false); reset() }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? <><Loader2 className="size-4 animate-spin" /> Submitting...</> : <><FileText className="size-4" /> Submit for Review</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
