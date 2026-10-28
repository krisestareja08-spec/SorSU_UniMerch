"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileText, ImagePlus, Link2, Loader2, Pencil, Plus, Send, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProductThumb } from "@/components/ui/product-thumb"
import { createClient } from "@/lib/supabase/client"
import { compressImage } from "@/lib/image-compress"
import { submitSupplyRequest, type SupplyPayload } from "@/app/supply-request-actions"
import { unwrap } from "@/lib/action-result"
import { toast } from "@/components/ui/toaster"
import type { ModuleKey } from "@/lib/modules"
import { ITEM_KIND_LABEL, type PickProduct, type SupplyAttachment, type SupplyItemKind, type SupplyRequest } from "@/lib/supply-request-shape"
import { KIND_INFO, SupplyItemDialog, newKey, type ItemDraft } from "@/components/store/supply-item-dialog"
import { cn } from "@/lib/utils"

type FileDraft = { key: string; file?: File; existing?: SupplyAttachment; preview?: string }
const field = "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"

/** Rebuild the form's items from a saved request (sizes of one item share a design group). */
function draftsFrom(req: SupplyRequest): ItemDraft[] {
  const groups = new Map<string, ItemDraft>()
  for (const it of req.items) {
    const k = it.design_group ?? it.id
    const d = groups.get(k) ?? {
      key: k, kind: it.kind, productId: it.product_id ?? "", name: it.name, notes: it.notes ?? "",
      usesLogo: it.uses_logo, listOnMarketplace: it.list_on_marketplace, qty: {}, lines: [],
    }
    if (it.kind === "custom") d.lines.push({ key: newKey(), size: it.size ?? "", qty: String(it.quantity) })
    else d.qty[it.variant_id ?? "one"] = String(it.quantity)
    groups.set(k, d)
  }
  return [...groups.values()]
}

/** Numbered section of the form */
function Section({ n, title, hint, children, aside }: { n: number; title: string; hint?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-base font-semibold leading-7">{title}</h2>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * New / edited supply request to the Main Supply Office, in three steps: the items (picked by
 * photo, with quantities per size), the details (what for, when, pick-up or delivery), and optional
 * design files. A summary stays in view with the Send button.
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
  const [items, setItems] = useState<ItemDraft[]>(initial ? draftsFrom(initial) : [])
  const [images, setImages] = useState<FileDraft[]>((initial?.attachments ?? []).filter((a) => a.kind === "image").map((a) => ({ key: newKey(), existing: a, preview: a.url })))
  const [docs, setDocs] = useState<FileDraft[]>((initial?.attachments ?? []).filter((a) => a.kind === "document").map((a) => ({ key: newKey(), existing: a })))
  const [dialog, setDialog] = useState<{ editing: ItemDraft | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const imgRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)

  const kinds: SupplyItemKind[] = ["catalog", "modified", "custom", ...(module === "seller" && collab.length ? ["collab_stock" as const] : [])]
  const productOf = (d: ItemDraft) => (d.kind === "collab_stock" ? collab : catalog).find((p) => p.id === d.productId)
  const designImage = images[0]?.preview ?? null
  const unitsOf = (d: ItemDraft) => (d.kind === "custom" ? d.lines.reduce((n, l) => n + (Number(l.qty) || 0), 0) : Object.values(d.qty).reduce((n, v) => n + (Number(v) || 0), 0))
  const sizesOf = (d: ItemDraft) => {
    if (d.kind === "custom") return d.lines.filter((l) => Number(l.qty) > 0).map((l) => `${l.size || "One size"} × ${l.qty}`)
    const p = productOf(d)
    return Object.entries(d.qty).filter(([, v]) => Number(v) > 0).map(([id, v]) => `${id === "one" ? "One size" : p?.sizes.find((s) => s.id === id)?.name ?? "Size"} × ${v}`)
  }
  const totalUnits = items.reduce((n, d) => n + unitsOf(d), 0)
  // Catalog items have a price already; the Main office prices the rest in its quote
  const estimate = items.filter((d) => d.kind === "catalog").reduce((n, d) => {
    const p = productOf(d)
    return n + Object.entries(d.qty).reduce((m, [id, v]) => m + (Number(v) || 0) * (id === "one" ? p?.price ?? 0 : p?.sizes.find((s) => s.id === id)?.price ?? 0), 0)
  }, 0)

  function saveItem(d: ItemDraft) {
    setItems((all) => (all.some((x) => x.key === d.key) ? all.map((x) => (x.key === d.key ? d : x)) : [...all, d]))
    setDialog(null)
  }

  function validate(): string | null {
    if (items.length === 0) return "Add at least one item."
    if (!title.trim()) return "Give the request a title, e.g. Foundation Day shirts."
    if (fulfilment === "delivery" && !address.trim()) return "Add where it should be delivered."
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
          items: items.flatMap((d): SupplyPayload["items"] => {
            const common = { kind: d.kind, design_group: d.key, notes: d.notes, uses_logo: d.usesLogo,
              list_on_marketplace: (d.kind === "custom" || d.kind === "modified") && d.listOnMarketplace }
            if (d.kind === "custom") return d.lines.filter((l) => Number(l.qty) > 0).map((l) => ({ ...common, name: d.name, size: l.size, quantity: Number(l.qty) }))
            return Object.entries(d.qty).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ ...common, product_id: d.productId, variant_id: id === "one" ? null : id, quantity: Number(v) }))
          }),
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

  const sendBar = (
    <>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{items.length} item{items.length === 1 ? "" : "s"} · {totalUnits} unit{totalUnits === 1 ? "" : "s"}</p>
        <p className="text-xs text-muted-foreground">{estimate > 0 ? `About ₱${estimate.toLocaleString()} for catalog items · ` : ""}The Main office sends the full quote.</p>
      </div>
      <Button type="button" onClick={submit} disabled={pending} className="gap-2">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{initial ? "Send again" : "Send request"}
      </Button>
    </>
  )

  return (
    <div className="mt-5 pb-24 lg:pb-0">
      {initial?.main_note && initial.status === "changes_requested" && (
        <p className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-500/20 dark:bg-orange-500/5 dark:text-orange-200">
          <span className="font-semibold">The Main Supply Office asked for changes:</span> {initial.main_note}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="space-y-4">
          <Section n={1} title="What do you need?" hint="Supply Office items, modified items, new designs or stock for your collaboration products."
            aside={items.length > 0 ? <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setDialog({ editing: null })}><Plus className="size-4" />Add item</Button> : undefined}>
            {items.length === 0 ? (
              <button type="button" onClick={() => setDialog({ editing: null })}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Plus className="size-6" /></span>
                <span className="font-semibold">Add your first item</span>
                <span className="text-sm text-muted-foreground">Pick a product by its photo, or describe a new design.</span>
              </button>
            ) : (
              <ul className="space-y-2">
                {items.map((d) => {
                  const p = productOf(d)
                  const Icon = KIND_INFO[d.kind].icon
                  return (
                    <li key={d.key} className="flex gap-3 rounded-xl border border-border p-3">
                      <ProductThumb src={d.kind === "custom" ? designImage : p?.image} alt="" size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{d.kind === "custom" ? d.name : p?.name ?? "Product"}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Icon className="size-3" />{ITEM_KIND_LABEL[d.kind]}
                          {d.usesLogo && " · official logo"}{d.listOnMarketplace && " · to sell on the marketplace"}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {sizesOf(d).map((t) => <span key={t} className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">{t}</span>)}
                        </div>
                        {d.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.notes}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button type="button" onClick={() => setDialog({ editing: d })} aria-label="Edit item" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="size-4" /></button>
                        <button type="button" onClick={() => setItems((all) => all.filter((x) => x.key !== d.key))} aria-label="Remove item" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="size-4" /></button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section n={2} title="Details">
            <div className="space-y-4">
              <label className="block"><span className="text-sm font-medium">Title *</span>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="e.g. Foundation Day shirts, new CICT uniform" className="mt-1.5" /></label>
              <label className="block"><span className="text-sm font-medium">What it&apos;s for <span className="font-normal text-muted-foreground">(optional)</span></span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={3000}
                  placeholder="The event, deadlines, anything the Supply Office should know." className={field} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium">Needed by <span className="font-normal text-muted-foreground">(optional)</span></span>
                  <Input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className="mt-1.5" /></label>
                <div>
                  <span className="text-sm font-medium">How you&apos;ll get it</span>
                  <div role="radiogroup" aria-label="Pick-up or delivery" className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
                    {(["pickup", "delivery"] as const).map((f) => (
                      <button key={f} type="button" role="radio" aria-checked={fulfilment === f} onClick={() => setFulfilment(f)}
                        className={cn("rounded-lg py-2 text-sm font-medium", fulfilment === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                        {f === "pickup" ? "Walk-in pick-up" : "Delivery"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {fulfilment === "delivery" && (
                <label className="block"><span className="text-sm font-medium">Deliver to *</span>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. CICT Office, Bulan Campus" className="mt-1.5" /></label>
              )}
            </div>
          </Section>

          <Section n={3} title="Design files" hint="Optional: photos of the design, a proposal document, or a link to a folder.">
            <div className="space-y-4">
              <div>
                <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                  const files = [...(e.target.files ?? [])].filter((f) => f.size <= 10 * 1024 * 1024)
                  setImages((all) => [...all, ...files.map((f) => ({ key: newKey(), file: f, preview: URL.createObjectURL(f) }))].slice(0, 10))
                  e.target.value = ""
                }} />
                <div className="flex flex-wrap gap-2">
                  {images.map((img) => (
                    <div key={img.key} className="relative size-20 overflow-hidden rounded-xl border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {img.preview && <img src={img.preview} alt="" className="size-full object-cover" />}
                      <button type="button" onClick={() => setImages((all) => all.filter((x) => x.key !== img.key))} aria-label="Remove photo"
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"><X className="size-3" /></button>
                    </div>
                  ))}
                  {images.length < 10 && (
                    <button type="button" onClick={() => imgRef.current?.click()} className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gold/40 text-[11px] text-muted-foreground hover:border-gold/70">
                      <ImagePlus className="size-5 text-gold/70" />Photos
                    </button>
                  )}
                </div>
              </div>
              <div>
                <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f && f.size > 20 * 1024 * 1024) setError("Each document must be under 20 MB.")
                  else if (f) setDocs((all) => [...all, { key: newKey(), file: f }].slice(0, 5))
                  e.target.value = ""
                }} />
                {docs.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {docs.map((d) => (
                      <li key={d.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                        <FileText className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{d.file?.name ?? d.existing?.name}</span>
                        <button type="button" onClick={() => setDocs((all) => all.filter((x) => x.key !== d.key))} aria-label="Remove document" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
                {docs.length < 5 && <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => docRef.current?.click()}><FileText className="size-4" />Add proposal document</Button>}
              </div>
              <label className="block"><span className="flex items-center gap-1.5 text-sm font-medium"><Link2 className="size-4" />Link</span>
                <Input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="e.g. a Google Drive folder with the designs" className="mt-1.5" /></label>
            </div>
          </Section>
          {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
        </div>

        {/* Summary + send: beside the form on desktops, a bar at the bottom on phones */}
        <aside className="sticky top-20 hidden space-y-3 rounded-2xl border border-border bg-card p-4 lg:block">
          <p className="font-serif text-base font-semibold">Summary</p>
          <ul className="space-y-2">
            {items.map((d) => (
              <li key={d.key} className="flex items-center gap-2 text-sm">
                <ProductThumb src={d.kind === "custom" ? designImage : productOf(d)?.image} alt="" size="xs" />
                <span className="min-w-0 flex-1 truncate">{d.kind === "custom" ? d.name : productOf(d)?.name}</span>
                <span className="text-xs font-semibold tabular-nums">× {unitsOf(d)}</span>
              </li>
            ))}
            {items.length === 0 && <li className="text-sm text-muted-foreground">No items yet.</li>}
          </ul>
          <div className="flex flex-col gap-3 border-t border-border pt-3">{sendBar}</div>
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">{sendBar}</div>

      {dialog && (
        <SupplyItemDialog key={dialog.editing?.key ?? "new"} open onClose={() => setDialog(null)} onSave={saveItem} initial={dialog.editing}
          kinds={kinds} catalog={catalog} collab={collab} designImage={designImage} allowMarketplace />
      )}
    </div>
  )
}
