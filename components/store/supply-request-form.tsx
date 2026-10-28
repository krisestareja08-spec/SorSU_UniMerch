"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileText, ImagePlus, Link2, Loader2, Package, Palette, Plus, Shirt, Trash2, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { compressImage } from "@/lib/image-compress"
import { submitSupplyRequest, type SupplyPayload } from "@/app/supply-request-actions"
import { unwrap } from "@/lib/action-result"
import { toast } from "@/components/ui/toaster"
import type { ModuleKey } from "@/lib/modules"
import { ITEM_KIND_LABEL, type PickProduct, type SupplyAttachment, type SupplyItemKind, type SupplyRequest } from "@/lib/supply-request-shape"
import { cn } from "@/lib/utils"

type Line = { key: string; variantId: string; size: string; qty: string }
type Draft = {
  key: string; kind: SupplyItemKind; productId: string; name: string; notes: string
  usesLogo: boolean; listOnMarketplace: boolean; lines: Line[]
}
type FileDraft = { key: string; file?: File; existing?: SupplyAttachment; preview?: string }

const newKey = () => Math.random().toString(36).slice(2, 10)
const line = (variantId = "", size = "", qty = ""): Line => ({ key: newKey(), variantId, size, qty })
const textareaCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"

const KIND_HELP: Record<SupplyItemKind, { icon: typeof Package; help: string }> = {
  catalog: { icon: Package, help: "An item the Supply Office already sells, as it is." },
  modified: { icon: Wrench, help: "A Supply Office item with changes — e.g. your print, colour or logo." },
  custom: { icon: Palette, help: "A new design you want made, e.g. an organization uniform." },
  collab_stock: { icon: Shirt, help: "More stock for one of your collaboration products." },
}

/** Rebuild the form's items from a saved request (sizes of one item share a design group). */
function draftsFrom(req: SupplyRequest): Draft[] {
  const groups = new Map<string, Draft>()
  for (const it of req.items) {
    const k = it.design_group ?? it.id
    const d = groups.get(k) ?? {
      key: k, kind: it.kind, productId: it.product_id ?? "", name: it.name, notes: it.notes ?? "",
      usesLogo: it.uses_logo, listOnMarketplace: it.list_on_marketplace, lines: [],
    }
    d.lines.push(line(it.variant_id ?? "", it.size ?? "", String(it.quantity)))
    groups.set(k, d)
  }
  return [...groups.values()]
}

/**
 * New / edited supply request to the Main Supply Office: what it's for, the items (Supply Office
 * items as they are or modified, new designs, or stock for collaboration products) with sizes and
 * quantities, photos, a proposal document, a link, and pick-up or delivery.
 */
export function SupplyRequestForm({ module, storeId, basePath, catalog, collab, initial }: {
  module: ModuleKey; storeId: string; basePath: string; catalog: PickProduct[]; collab: PickProduct[]; initial?: SupplyRequest
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [neededBy, setNeededBy] = useState(initial?.needed_by ?? "")
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">(initial?.fulfilment ?? "pickup")
  const [address, setAddress] = useState(initial?.delivery_address ?? "")
  const [link, setLink] = useState(initial?.link_url ?? "")
  const [items, setItems] = useState<Draft[]>(initial ? draftsFrom(initial) : [])
  const [images, setImages] = useState<FileDraft[]>((initial?.attachments ?? []).filter((a) => a.kind === "image").map((a) => ({ key: newKey(), existing: a, preview: a.url })))
  const [docs, setDocs] = useState<FileDraft[]>((initial?.attachments ?? []).filter((a) => a.kind === "document").map((a) => ({ key: newKey(), existing: a })))
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const imgRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)

  const productsFor = (kind: SupplyItemKind) => (kind === "collab_stock" ? collab : catalog)
  const kinds: SupplyItemKind[] = ["catalog", "modified", "custom", ...(module === "seller" && collab.length ? ["collab_stock" as const] : [])]

  const update = (key: string, patch: Partial<Draft>) => setItems((all) => all.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  const updateLine = (key: string, lk: string, patch: Partial<Line>) =>
    setItems((all) => all.map((d) => (d.key === key ? { ...d, lines: d.lines.map((l) => (l.key === lk ? { ...l, ...patch } : l)) } : d)))
  const add = (kind: SupplyItemKind) => setItems((all) => [...all, { key: newKey(), kind, productId: "", name: "", notes: "", usesLogo: false, listOnMarketplace: false, lines: [line()] }])

  function validate(): string | null {
    if (!title.trim()) return "Give the request a title, e.g. Foundation Day shirts."
    if (items.length === 0) return "Add at least one item."
    if (fulfilment === "delivery" && !address.trim()) return "Add where it should be delivered."
    for (const d of items) {
      if (d.kind === "custom" ? !d.name.trim() : !d.productId) return d.kind === "custom" ? "Name every new design." : "Pick a product for every item."
      const p = productsFor(d.kind).find((x) => x.id === d.productId)
      for (const l of d.lines) {
        if (!(Number(l.qty) >= 1)) return "Every size needs a quantity of 1 or more."
        if (p?.sizes.length && !l.variantId) return `Pick a size for ${p.name}.`
      }
    }
    return null
  }

  async function uploads(): Promise<SupplyPayload["attachments"]> {
    const supabase = createClient()
    const out: SupplyPayload["attachments"] = []
    for (const img of images) {
      if (img.existing) { out.push({ url: img.existing.url, name: img.existing.name, kind: "image" }); continue }
      const file = await compressImage(img.file!)
      const ext = file.name.split(".").pop() || "jpg"
      const path = `${storeId}/supply/${crypto.randomUUID()}.${ext}`
      const { error: e } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false })
      if (e) throw new Error("A photo couldn't be uploaded. Please try again.")
      out.push({ url: supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl, name: img.file!.name, kind: "image" })
    }
    for (const doc of docs) {
      if (doc.existing) { out.push({ path: doc.existing.path, name: doc.existing.name, kind: "document" }); continue }
      const safe = doc.file!.name.replace(/[^\w.\- ]+/g, "_").slice(-80)
      const path = `${storeId}/${crypto.randomUUID()}/${safe}`
      const { error: e } = await supabase.storage.from("supply-requests").upload(path, doc.file!, { upsert: false })
      if (e) throw new Error(/bucket/i.test(e.message) ? "File uploads need the latest scripts/31_supply_office_branches.sql." : "The document couldn't be uploaded. Please try again.")
      out.push({ path, name: doc.file!.name, kind: "document" })
    }
    return out
  }

  function submit() {
    const problem = validate()
    setError(problem)
    if (problem) return
    start(async () => {
      try {
        const payload: SupplyPayload = {
          title, description, link_url: link, needed_by: neededBy, fulfilment, delivery_address: address,
          attachments: await uploads(),
          items: items.flatMap((d) => d.lines.map((l) => {
            const p = productsFor(d.kind).find((x) => x.id === d.productId)
            return {
              kind: d.kind, product_id: d.kind === "custom" ? undefined : d.productId,
              variant_id: p?.sizes.length ? l.variantId : null, design_group: d.key,
              name: d.kind === "custom" ? d.name : undefined, size: d.kind === "custom" ? l.size : undefined,
              quantity: Number(l.qty), notes: d.notes, uses_logo: d.usesLogo,
              list_on_marketplace: (d.kind === "custom" || d.kind === "modified") && d.listOnMarketplace,
            }
          })),
        }
        const { id } = unwrap(await submitSupplyRequest({ module, payload, requestId: initial?.id }))
        toast({ title: initial ? "Request sent again" : "Request sent to the Main Supply Office" })
        router.push(`${basePath}/supply-requests/${id}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "The request couldn't be sent.")
      }
    })
  }

  return (
    <div className="mt-5 space-y-6">
      {initial?.main_note && initial.status === "changes_requested" && (
        <p className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-500/20 dark:bg-orange-500/5 dark:text-orange-200">
          <span className="font-semibold">Main Supply Office:</span> {initial.main_note}
        </p>
      )}

      {/* What it's for */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-serif text-base font-semibold">About the request</h2>
        <label className="block"><span className="text-sm font-medium">Title *</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="e.g. Foundation Day shirts, new CICT uniform" className="mt-1" /></label>
        <label className="block"><span className="text-sm font-medium">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={3000}
            placeholder="What it's for, the event, deadlines, anything the Supply Office should know." className={cn(textareaCls, "mt-1")} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-medium">Needed by</span>
            <Input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className="mt-1" /></label>
          <div>
            <span className="text-sm font-medium">How you&apos;ll get it</span>
            <div role="radiogroup" aria-label="Pick-up or delivery" className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
              {(["pickup", "delivery"] as const).map((f) => (
                <button key={f} type="button" role="radio" aria-checked={fulfilment === f} onClick={() => setFulfilment(f)}
                  className={cn("rounded-md py-1.5 text-sm font-medium", fulfilment === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                  {f === "pickup" ? "Walk-in pick-up" : "Delivery"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {fulfilment === "delivery" && (
          <label className="block"><span className="text-sm font-medium">Deliver to *</span>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. CICT Office, Bulan Campus" className="mt-1" /></label>
        )}
      </section>

      {/* Items */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-serif text-base font-semibold">Items</h2>
        {items.length === 0 && <p className="text-sm text-muted-foreground">Add what you need below.</p>}
        <ol className="space-y-3">
          {items.map((d, i) => {
            const products = productsFor(d.kind)
            const p = products.find((x) => x.id === d.productId)
            const Icon = KIND_HELP[d.kind].icon
            return (
              <li key={d.key} className="space-y-2.5 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" />{i + 1}. {ITEM_KIND_LABEL[d.kind]}</p>
                  <button type="button" onClick={() => setItems((all) => all.filter((x) => x.key !== d.key))} aria-label={`Remove item ${i + 1}`}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="size-4" /></button>
                </div>

                {d.kind === "custom" ? (
                  <Input value={d.name} onChange={(e) => update(d.key, { name: e.target.value })} placeholder="Design name, e.g. CICT Org Hoodie" aria-label="Design name" />
                ) : (
                  <select value={d.productId} onChange={(e) => update(d.key, { productId: e.target.value, lines: [line()] })} aria-label="Product"
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
                    <option value="">{products.length ? "Choose a product…" : "No products to choose from yet"}</option>
                    {products.map((x) => <option key={x.id} value={x.id}>{x.name}{x.sizes.length ? "" : ` — ₱${x.price.toLocaleString()}`}</option>)}
                  </select>
                )}

                {(d.kind === "modified" || d.kind === "custom") && (
                  <textarea value={d.notes} onChange={(e) => update(d.key, { notes: e.target.value })} rows={2} maxLength={2000} aria-label="Details"
                    placeholder={d.kind === "custom" ? "Describe the design: colours, materials, print, where the logo goes…" : "What to change: print, colour, embroidery, name tags…"}
                    className={textareaCls} />
                )}

                {/* Sizes and quantities */}
                <div className="space-y-1.5">
                  {d.lines.map((l) => (
                    <div key={l.key} className="flex items-center gap-2">
                      {d.kind === "custom" ? (
                        <Input value={l.size} onChange={(e) => updateLine(d.key, l.key, { size: e.target.value })} placeholder="Size (optional), e.g. M" aria-label="Size" className="h-8 w-40 text-sm" />
                      ) : p?.sizes.length ? (
                        <select value={l.variantId} onChange={(e) => updateLine(d.key, l.key, { variantId: e.target.value })} aria-label="Size" className="h-8 w-40 rounded-lg border border-input bg-background px-2 text-sm">
                          <option value="">Size…</option>
                          {p.sizes.map((s) => <option key={s.id} value={s.id}>{s.name}{d.kind === "catalog" ? ` — ₱${s.price.toLocaleString()}` : ""}</option>)}
                        </select>
                      ) : <span className="w-40 text-xs text-muted-foreground">{p ? "One size" : ""}</span>}
                      <Input type="number" min={1} value={l.qty} onChange={(e) => updateLine(d.key, l.key, { qty: e.target.value })} placeholder="Qty" aria-label="Quantity" className="h-8 w-24 text-sm" />
                      {d.lines.length > 1 && (
                        <button type="button" onClick={() => update(d.key, { lines: d.lines.filter((x) => x.key !== l.key) })} aria-label="Remove size"
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
                      )}
                    </div>
                  ))}
                  {(d.kind === "custom" || (p?.sizes.length ?? 0) > 1) && (
                    <button type="button" onClick={() => update(d.key, { lines: [...d.lines, line()] })} className="text-xs font-medium text-primary hover:underline">+ Another size</button>
                  )}
                </div>

                {d.kind === "custom" && (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.usesLogo} onChange={(e) => update(d.key, { usesLogo: e.target.checked })} className="size-4 accent-primary" />
                    Uses the official university logo <span className="text-xs text-muted-foreground">(royalty applies)</span></label>
                )}
                {(d.kind === "custom" || d.kind === "modified") && (
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={d.listOnMarketplace} onChange={(e) => update(d.key, { listOnMarketplace: e.target.checked })} className="mt-0.5 size-4 accent-primary" />
                    <span>Also sell it on the marketplace <span className="block text-xs text-muted-foreground">When it&apos;s delivered, a product draft (photos, sizes and the delivered units as stock) appears in your Products. Set the price and submit it for BAO review as usual. Leave unticked for a one-time order.</span></span></label>
                )}
              </li>
            )
          })}
        </ol>
        <div className="grid gap-2 sm:grid-cols-2">
          {kinds.map((k) => {
            const Icon = KIND_HELP[k].icon
            return (
              <button key={k} type="button" onClick={() => add(k)}
                className="flex items-start gap-2 rounded-xl border border-dashed border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
                <Plus className="mt-0.5 size-4 shrink-0 text-primary" />
                <span><span className="flex items-center gap-1.5 text-sm font-medium"><Icon className="size-3.5" />{ITEM_KIND_LABEL[k]}</span>
                  <span className="block text-xs text-muted-foreground">{KIND_HELP[k].help}</span></span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Files */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-serif text-base font-semibold">Design &amp; proposal <span className="text-xs font-normal text-muted-foreground">(optional)</span></h2>
        <div>
          <p className="text-sm font-medium">Photos / design images</p>
          <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
            const files = [...(e.target.files ?? [])].filter((f) => f.size <= 10 * 1024 * 1024)
            setImages((all) => [...all, ...files.map((f) => ({ key: newKey(), file: f, preview: URL.createObjectURL(f) }))].slice(0, 10))
            e.target.value = ""
          }} />
          <div className="mt-1.5 flex flex-wrap gap-2">
            {images.map((img) => (
              <div key={img.key} className="relative size-20 overflow-hidden rounded-lg border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img.preview && <img src={img.preview} alt="" className="size-full object-cover" />}
                <button type="button" onClick={() => setImages((all) => all.filter((x) => x.key !== img.key))} aria-label="Remove photo"
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"><X className="size-3" /></button>
              </div>
            ))}
            {images.length < 10 && (
              <button type="button" onClick={() => imgRef.current?.click()} className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gold/40 text-[11px] text-muted-foreground hover:border-gold/70">
                <ImagePlus className="size-5 text-gold/70" />Add
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Proposal document</p>
          <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]
            if (f && f.size > 20 * 1024 * 1024) setError("Each document must be under 20 MB.")
            else if (f) setDocs((all) => [...all, { key: newKey(), file: f }].slice(0, 5))
            e.target.value = ""
          }} />
          <ul className="mt-1.5 space-y-1">
            {docs.map((d) => (
              <li key={d.key} className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate">{d.file?.name ?? d.existing?.name}</span>
                <button type="button" onClick={() => setDocs((all) => all.filter((x) => x.key !== d.key))} aria-label="Remove document" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
              </li>
            ))}
          </ul>
          {docs.length < 5 && <Button type="button" size="sm" variant="outline" className="mt-1.5 gap-1.5" onClick={() => docRef.current?.click()}><FileText className="size-4" />Upload document</Button>}
        </div>
        <label className="block"><span className="flex items-center gap-1.5 text-sm font-medium"><Link2 className="size-4" />Link</span>
          <Input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="e.g. a Google Drive folder with the designs" className="mt-1" /></label>
      </section>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={submit} disabled={pending} className="gap-2">{pending && <Loader2 className="size-4 animate-spin" />}{initial ? "Send again" : "Send request"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
      </div>
    </div>
  )
}
