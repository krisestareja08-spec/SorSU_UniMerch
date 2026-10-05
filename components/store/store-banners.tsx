"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { CalendarClock, ImagePlus, Loader2, Megaphone, Pencil, Plus, Trash2, X } from "lucide-react"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import type { DashboardCtx } from "@/lib/modules"
import { cn } from "@/lib/utils"

type Banner = { id: string; title: string; subtitle: string | null; image_url: string | null; link_url: string | null; starts_at: string; ends_at: string }
type Draft = { id?: string; title: string; subtitle: string; image_url: string | null; link_url: string; starts_at: string; ends_at: string }

const MAX_DAYS = 90
const MAX_BYTES = 5 * 1024 * 1024

/** datetime-local value for a Date, in the viewer's time zone */
function local(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}
function phase(b: Banner, now: number) {
  if (now < new Date(b.starts_at).getTime()) return { label: "Scheduled", cls: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" }
  if (now > new Date(b.ends_at).getTime()) return { label: "Ended", cls: "bg-muted text-muted-foreground" }
  return { label: "Live", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" }
}

/** Store staff upload, schedule, edit and delete homepage banners (scripts/26 → store_banners). */
export function StoreBanners({ ctx }: { ctx: DashboardCtx }) {
  const storeId = ctx.storeId ?? ""
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(0)

  const load = useCallback(async () => {
    const { data, error: err } = await createClient().from("store_banners")
      .select("id, title, subtitle, image_url, link_url, starts_at, ends_at").eq("seller_id", storeId).order("starts_at", { ascending: false })
    if (err) setError(err.message.includes("store_banners") ? "Banners aren't set up yet. Run scripts/26_reviews_banners_cart.sql in Supabase." : err.message)
    else setBanners(data ?? [])
    setNow(Date.now())
    setLoading(false)
  }, [storeId])

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  function startNew() {
    const start = new Date()
    const end = new Date(start.getTime() + 7 * 86_400_000)
    setError(null)
    setDraft({ title: "", subtitle: "", image_url: null, link_url: `/seller/${storeId}`, starts_at: local(start), ends_at: local(end) })
  }

  function edit(b: Banner) {
    setError(null)
    setDraft({ id: b.id, title: b.title, subtitle: b.subtitle ?? "", image_url: b.image_url, link_url: b.link_url ?? "", starts_at: local(new Date(b.starts_at)), ends_at: local(new Date(b.ends_at)) })
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !draft) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Use a JPG, PNG or WebP image."); return }
    if (file.size > MAX_BYTES) { setError("Images must be 5 MB or smaller."); return }
    setBusy(true)
    const supabase = createClient()
    const path = `${storeId}/${crypto.randomUUID()}.${file.type.split("/")[1]}`
    const { error: err } = await supabase.storage.from("store-banners").upload(path, file, { contentType: file.type })
    setBusy(false)
    if (err) { setError(err.message); return }
    setDraft({ ...draft, image_url: supabase.storage.from("store-banners").getPublicUrl(path).data.publicUrl })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    const starts = new Date(draft.starts_at), ends = new Date(draft.ends_at)
    if (!draft.title.trim()) { setError("Add a title."); return }
    if (!(ends > starts)) { setError("The end date must be after the start date."); return }
    if (ends.getTime() - starts.getTime() > MAX_DAYS * 86_400_000) { setError(`A banner can run for at most ${MAX_DAYS} days.`); return }
    const link = draft.link_url.trim()
    if (link && !link.startsWith("/")) { setError("Links must be pages on UniMerch, e.g. /seller/… or /marketplace/product/…"); return }
    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const row = {
      title: draft.title.trim(), subtitle: draft.subtitle.trim() || null, image_url: draft.image_url, link_url: link || null,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(), updated_at: new Date().toISOString(),
    }
    const { error: err } = draft.id
      ? await supabase.from("store_banners").update(row).eq("id", draft.id)
      : await supabase.from("store_banners").insert({ ...row, seller_id: storeId, created_by: user?.id })
    setBusy(false)
    if (err) { setError(err.message); return }
    setDraft(null)
    load()
  }

  async function remove(b: Banner) {
    if (!window.confirm(`Delete the banner "${b.title}"? It will disappear from the marketplace.`)) return
    const supabase = createClient()
    const { error: err } = await supabase.from("store_banners").delete().eq("id", b.id)
    if (err) { setError(err.message); return }
    // Remove the image file too when it lives in our bucket
    const marker = "/store-banners/"
    if (b.image_url?.includes(marker)) await supabase.storage.from("store-banners").remove([b.image_url.split(marker)[1]])
    load()
  }

  return (
    <ManagementShell ctx={ctx}>
      <PageHeading title="Marketplace Banners" description="Promote your store on the marketplace homepage. Banners show only between their start and end dates." />

      <div className="mt-6 flex justify-end">
        {!draft && <Button onClick={startNew} className="gap-1.5"><Plus className="size-4" />New banner</Button>}
      </div>
      {error && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}

      {draft && (
        <form onSubmit={save} className="mt-4 space-y-4 rounded-2xl border border-primary/15 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-base font-semibold">{draft.id ? "Edit banner" : "New banner"}</h2>
            <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Close"><X className="size-4" /></button>
          </div>

          {/* Live preview */}
          <div className="relative flex min-h-36 flex-col justify-end overflow-hidden rounded-xl bg-linear-to-br from-primary to-primary/80 p-5">
            {draft.image_url && <Image src={draft.image_url} alt="" fill className="object-cover" sizes="600px" />}
            {draft.image_url && <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />}
            <div className="relative">
              <p className="font-serif text-xl font-bold text-white">{draft.title || "Banner title"}</p>
              {draft.subtitle && <p className="mt-1 text-sm text-white/80">{draft.subtitle}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-title">Title</Label>
              <Input id="b-title" maxLength={80} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Foundation Day shirts are here" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-sub">Subtitle (optional)</Label>
              <Input id="b-sub" maxLength={160} value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} placeholder="A short line about the promotion" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-start">Starts</Label>
              <Input id="b-start" type="datetime-local" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-end">Ends</Label>
              <Input id="b-end" type="datetime-local" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-link">Opens when tapped</Label>
              <Input id="b-link" value={draft.link_url} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} placeholder={`/seller/${storeId}`} />
              <p className="text-xs text-muted-foreground">Your storefront by default. You can paste a product page path, e.g. /marketplace/product/…</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <p className="text-sm font-medium">Image (optional, wide 3:1 works best)</p>
              <div className="flex gap-2">
                <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted", busy && "pointer-events-none opacity-60")}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}{draft.image_url ? "Replace image" : "Upload image"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="sr-only" />
                </label>
                {draft.image_url && <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, image_url: null })}>Remove image</Button>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{draft.id ? "Save changes" : "Publish banner"}</Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          [1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)
        ) : banners.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Megaphone className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No banners yet. Create one to appear in the homepage carousel.</p>
          </div>
        ) : (
          banners.map((b) => {
            const ph = phase(b, now)
            return (
              <div key={b.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
                <div className="relative h-20 w-full shrink-0 overflow-hidden rounded-xl bg-linear-to-br from-primary to-primary/80 sm:w-48">
                  {b.image_url && <Image src={b.image_url} alt="" fill className="object-cover" sizes="192px" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{b.title}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", ph.cls)}>{ph.label}</span>
                  </div>
                  {b.subtitle && <p className="truncate text-sm text-muted-foreground">{b.subtitle}</p>}
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />{fmt(b.starts_at)} → {fmt(b.ends_at)}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => edit(b)} className="gap-1"><Pencil className="size-3.5" />Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => remove(b)} className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/5"><Trash2 className="size-3.5" />Delete</Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </ManagementShell>
  )
}
