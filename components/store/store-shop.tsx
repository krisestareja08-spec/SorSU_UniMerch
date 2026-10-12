"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ManagementShell } from "@/components/management/management-shell"
import type { DashboardCtx } from "@/lib/modules"
import { ACCENTS, DEFAULT_THEME, type StorefrontAccent, type StorefrontTheme } from "@/lib/storefront-theme"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertCircle, ArrowLeft, Check, ImageIcon, LayoutGrid, List, Loader2, MapPin, Palette, QrCode, Store, Upload, Wallet, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ShopProfile = {
  org_name: string; description: string; gcash_number: string
  gcash_qr_url: string | null; bank_qr_url: string | null
  bank_account_name: string; bank_account_number: string
  logo_url: string | null; banner_url: string | null
  pickup_location: string | null; pickup_notes: string | null
  store_hours: string | null; claim_window_days: number
  /** Penalty for an unclaimed pre-order (scripts/29) */
  preorder_penalty?: number
  theme: StorefrontTheme
}

type ImageKind = "logo" | "banner" | "gcash" | "bank"

const SECTIONS = [
  { id: "shop-info", label: "Shop info" },
  { id: "branding", label: "Branding" },
  { id: "pickup", label: "Pickup & pre-orders" },
  { id: "payments", label: "Payments" },
] as const

const textareaClass =
  "mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"

const BASE_COLUMNS = "org_name, description, gcash_number, gcash_qr_url, bank_qr_url, bank_account_name, bank_account_number"
const ALL_COLUMNS = `${BASE_COLUMNS}, logo_url, banner_url, theme, pickup_location, pickup_notes, store_hours, claim_window_days, preorder_penalty`

/**
 * Storefront editor (opened from the Storefront page's "Edit storefront"). Grouped sections with
 * quick links, a save bar that shows unsaved changes, and saving returns to the storefront view.
 */
export function StoreShop({ ctx, viewHref }: { ctx: DashboardCtx; viewHref: string }) {
  const router = useRouter()
  const storeId = ctx.storeId
  const [loaded, setLoaded] = useState(false)
  const [shop, setShop] = useState<Partial<ShopProfile>>({})
  const [initial, setInitial] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<ImageKind | null>(null)
  const [brandingAvailable, setBrandingAvailable] = useState(true)
  const [pickupAvailable, setPickupAvailable] = useState(true)
  const [hoursAvailable, setHoursAvailable] = useState(true)
  const [penaltyAvailable, setPenaltyAvailable] = useState(true)

  useEffect(() => {
    if (!storeId) return
    const supabase = createClient()
    const load = async () => {
      // Everything in one request; older databases (missing columns) fall back to what exists
      const full = await supabase.from("seller_profiles").select(ALL_COLUMNS).eq("id", storeId).maybeSingle()
      let row: Record<string, unknown> | null = full.data as Record<string, unknown> | null
      if (full.error) {
        const pick = async (cols: string) => {
          const { data, error: err } = await supabase.from("seller_profiles").select(cols).eq("id", storeId).maybeSingle()
          return err ? null : (data as Record<string, unknown> | null)
        }
        const [base, branding, pickup, hours, penalty] = await Promise.all([
          pick(BASE_COLUMNS), pick("logo_url, banner_url, theme"), pick("pickup_location, pickup_notes"),
          pick("store_hours, claim_window_days"), pick("preorder_penalty"),
        ])
        setBrandingAvailable(!!branding); setPickupAvailable(!!pickup); setHoursAvailable(!!hours); setPenaltyAvailable(!!penalty)
        row = base ? { ...base, ...branding, ...pickup, ...hours, ...penalty } : null
      }
      const next: Partial<ShopProfile> = row ? {
        ...(row as Partial<ShopProfile>),
        ...(row.preorder_penalty != null ? { preorder_penalty: Number(row.preorder_penalty) } : {}),
        theme: { ...DEFAULT_THEME, ...((row.theme as Partial<StorefrontTheme> | null) ?? {}) },
      } : { theme: DEFAULT_THEME }
      setShop(next)
      setInitial(JSON.stringify(next))
      setLoaded(true)
    }
    load()
  }, [storeId])

  const dirty = useMemo(() => loaded && JSON.stringify(shop) !== initial, [loaded, shop, initial])

  // Don't lose edits by closing the tab
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const theme = shop.theme ?? DEFAULT_THEME
  const set = (patch: Partial<ShopProfile>) => setShop((s) => ({ ...s, ...patch }))
  const setTheme = (patch: Partial<StorefrontTheme>) => setShop((s) => ({ ...s, theme: { ...(s.theme ?? DEFAULT_THEME), ...patch } }))

  async function upload(kind: ImageKind, file: File) {
    if (!storeId) return
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return }
    if (file.size > 5 * 1024 * 1024) { setError("Images must be under 5 MB."); return }
    setUploading(kind)
    setError(null)
    const supabase = createClient()
    const ext = file.name.split(".").pop() || "png"
    const path = kind === "logo" || kind === "banner"
      ? `${storeId}/storefront-${kind}-${file.lastModified}-${file.size}.${ext}`
      : `${storeId}/${kind}-qr-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: true })
    setUploading(null)
    if (upErr) { setError(`The image couldn't be uploaded: ${upErr.message}`); return }
    const url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl
    set(kind === "logo" || kind === "banner" ? { [`${kind}_url`]: url } : { [`${kind}_qr_url`]: url })
  }

  async function handleSave() {
    if (!storeId) return
    if (!shop.org_name?.trim()) { setError("Enter your shop name."); document.getElementById("org_name")?.focus(); return }
    setSaving(true)
    setError(null)
    // Section 8 — QR upload logic: mark the e-wallet QR active once any QR image is on file.
    const qrStatus = shop.gcash_qr_url || shop.bank_qr_url ? "active" : "inactive"
    const { logo_url, banner_url, theme: shopTheme, pickup_location, pickup_notes, store_hours, claim_window_days, preorder_penalty, ...rest } = shop
    const payload = {
      ...rest,
      ...(brandingAvailable ? { logo_url, banner_url, theme: shopTheme ?? DEFAULT_THEME } : {}),
      ...(pickupAvailable ? { pickup_location: pickup_location?.trim() || null, pickup_notes: pickup_notes?.trim() || null } : {}),
      ...(hoursAvailable ? { store_hours: store_hours?.trim() || null, claim_window_days: Math.min(7, Math.max(3, Math.round(Number(claim_window_days) || 7))) } : {}),
      ...(penaltyAvailable ? { preorder_penalty: Math.min(10000, Math.max(0, Math.round((Number(preorder_penalty) || 0) * 100) / 100)) } : {}),
      org_name: shop.org_name.trim(),
      qr_status: qrStatus,
      qr_updated_at: new Date().toISOString(),
    }
    const { error: saveErr } = await createClient().from("seller_profiles").update(payload).eq("id", storeId)
    if (saveErr) { setError(saveErr.message); setSaving(false); return }
    setInitial(JSON.stringify(shop)) // nothing unsaved any more: leave without the warning
    router.push(viewHref)
    router.refresh()
  }

  function cancel() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return
    router.push(viewHref)
  }

  return (
    <ManagementShell ctx={ctx}>
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={cancel} className="mb-3 inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to storefront
        </button>
        <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Edit storefront</h1>
        <p className="mt-1 text-sm text-muted-foreground">Changes appear on your storefront after you save.</p>

        {/* Quick links to each section */}
        <nav aria-label="Storefront settings sections" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}
              className="shrink-0 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary/5">
              {s.label}
            </a>
          ))}
        </nav>

        {!loaded ? (
          <div className="mt-6 space-y-4" aria-busy="true" aria-label="Loading storefront settings">
            {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted/60" />)}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* ── Shop info ── */}
            <Section id="shop-info" icon={Store} title="Shop info" description="Your shop's name and what you sell.">
              <div>
                <Label htmlFor="org_name">Shop name <span className="text-destructive">*</span></Label>
                <Input id="org_name" className="mt-1.5" placeholder="e.g. CICT Student Council" value={shop.org_name ?? ""} onChange={(e) => set({ org_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <textarea id="description" rows={3} className={textareaClass} placeholder="What does your shop sell? Who runs it?"
                  value={shop.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="tagline">Tagline</Label>
                <Input id="tagline" className="mt-1.5" disabled={!brandingAvailable} placeholder="e.g. Official merch of the CICT Student Council"
                  value={theme.tagline ?? ""} onChange={(e) => setTheme({ tagline: e.target.value })} />
                <Hint>A short line shown under your shop name.</Hint>
              </div>
            </Section>

            {/* ── Branding ── */}
            <Section id="branding" icon={Palette} title="Branding" description="Logo, banner and colors buyers see at the top of your storefront.">
              {!brandingAvailable && <Notice>Run <code>scripts/11_storefront.sql</code> in Supabase to enable logo, banner and theme settings.</Notice>}
              <div className="grid gap-5 sm:grid-cols-[9rem_1fr]">
                <ImageField label="Logo" hint="Square, at least 256 × 256" url={shop.logo_url ?? null} kind="logo" shape="square"
                  disabled={!brandingAvailable} uploading={uploading} onUpload={upload} onRemove={() => set({ logo_url: null })} />
                <ImageField label="Banner" hint="Wide, about 1500 × 400" url={shop.banner_url ?? null} kind="banner" shape="wide"
                  disabled={!brandingAvailable} uploading={uploading} onUpload={upload} onRemove={() => set({ banner_url: null })} />
              </div>

              <fieldset disabled={!brandingAvailable}>
                <legend className="text-sm font-medium">Accent color</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(ACCENTS) as StorefrontAccent[]).map((a) => (
                    <button key={a} type="button" onClick={() => setTheme({ accent: a })} aria-pressed={theme.accent === a}
                      className={cn("flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
                        theme.accent === a ? "border-primary bg-primary/5 font-semibold ring-2 ring-primary/20" : "border-border hover:bg-muted")}>
                      <span className={cn("size-5 rounded-full bg-linear-to-r", ACCENTS[a].banner)} />{ACCENTS[a].label}
                      {theme.accent === a && <Check className="size-4 text-primary" />}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-5 sm:grid-cols-2">
                <fieldset disabled={!brandingAvailable}>
                  <legend className="text-sm font-medium">Product layout</legend>
                  <div className="mt-2 inline-flex rounded-lg border border-border p-1">
                    {([["grid", "Grid", LayoutGrid], ["list", "List", List]] as const).map(([value, label, Icon]) => (
                      <button key={value} type="button" onClick={() => setTheme({ layout: value })} aria-pressed={theme.layout === value}
                        className={cn("flex min-h-9 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium",
                          theme.layout === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                        <Icon className="size-4" />{label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 sm:self-end">
                  <span className="text-sm font-medium">Show banner</span>
                  <input type="checkbox" className="size-4 accent-primary" disabled={!brandingAvailable}
                    checked={theme.showBanner} onChange={(e) => setTheme({ showBanner: e.target.checked })} />
                </label>
              </div>
            </Section>

            {/* ── Pickup & pre-orders ── */}
            <Section id="pickup" icon={MapPin} title="Pickup & pre-orders" description="Shown to buyers at checkout, on receipts and on order details.">
              {!pickupAvailable && <Notice>Run <code>scripts/13_orders_pickup.sql</code> in Supabase to enable pickup locations.</Notice>}
              <div>
                <Label htmlFor="pickup_location">Pickup address</Label>
                <textarea id="pickup_location" rows={2} disabled={!pickupAvailable} className={textareaClass}
                  placeholder="e.g. CICT Building, Room 204, SorSU Bulan Campus"
                  value={shop.pickup_location ?? ""} onChange={(e) => set({ pickup_location: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="pickup_notes">Pickup instructions <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <textarea id="pickup_notes" rows={2} disabled={!pickupAvailable} className={textareaClass}
                  placeholder="e.g. Look for the council officer on duty."
                  value={shop.pickup_notes ?? ""} onChange={(e) => set({ pickup_notes: e.target.value })} />
              </div>
              {!hoursAvailable && <Notice>Run <code>scripts/22_preorder_pickup.sql</code> in Supabase to enable store hours and pre-order pick-up dates.</Notice>}
              <div>
                <Label htmlFor="store_hours">Store hours</Label>
                <textarea id="store_hours" rows={2} disabled={!hoursAvailable} className={textareaClass}
                  placeholder="e.g. Mon–Fri, 8:00 AM – 5:00 PM (closed 12:00 – 1:00 PM)"
                  value={shop.store_hours ?? ""} onChange={(e) => set({ store_hours: e.target.value })} />
                <Hint>Buyers see this at checkout, so they know when they can walk in to claim a pre-order.</Hint>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold">Pre-orders</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="claim_window_days">Pick-up window (days)</Label>
                    <Input id="claim_window_days" type="number" min={3} max={7} disabled={!hoursAvailable} className="mt-1.5 w-28"
                      value={shop.claim_window_days ?? 7} onChange={(e) => set({ claim_window_days: Number(e.target.value) })} />
                    <Hint>3 to 7. Buyers pick a date from tomorrow up to this many days ahead.</Hint>
                  </div>
                  <div>
                    <Label htmlFor="preorder_penalty">Unclaimed pre-order penalty (₱)</Label>
                    <Input id="preorder_penalty" type="number" min={0} step="0.01" disabled={!penaltyAvailable} className="mt-1.5 w-28"
                      value={shop.preorder_penalty ?? 10} onChange={(e) => set({ preorder_penalty: Number(e.target.value) })} />
                    <Hint>
                      {penaltyAvailable
                        ? "Charged when an approved pre-order isn't picked up by its date. The buyer can't order from you until it's paid."
                        : "Run scripts/29_preorder_id_penalties.sql in Supabase to enable pre-order penalties."}
                    </Hint>
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Payments ── */}
            <Section id="payments" icon={Wallet} title="Payments" description="How buyers pay you online. Add at least one QR code so buyers can pay by GCash or bank transfer.">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-4 rounded-xl border border-border p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><QrCode className="size-4 text-gold" />GCash</h3>
                  <div>
                    <Label htmlFor="gcash_number">GCash number</Label>
                    <Input id="gcash_number" inputMode="numeric" className="mt-1.5" placeholder="09XXXXXXXXX"
                      value={shop.gcash_number ?? ""} onChange={(e) => set({ gcash_number: e.target.value })} />
                  </div>
                  <ImageField label="GCash QR code" url={shop.gcash_qr_url ?? null} kind="gcash" shape="qr"
                    uploading={uploading} onUpload={upload} onRemove={() => set({ gcash_qr_url: null })} />
                </div>
                <div className="space-y-4 rounded-xl border border-border p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><QrCode className="size-4 text-primary" />Bank transfer</h3>
                  <div>
                    <Label htmlFor="bank_account_name">Account name</Label>
                    <Input id="bank_account_name" className="mt-1.5" placeholder="Juan Dela Cruz"
                      value={shop.bank_account_name ?? ""} onChange={(e) => set({ bank_account_name: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="bank_account_number">Account number</Label>
                    <Input id="bank_account_number" inputMode="numeric" className="mt-1.5" placeholder="0000 0000 0000"
                      value={shop.bank_account_number ?? ""} onChange={(e) => set({ bank_account_number: e.target.value })} />
                  </div>
                  <ImageField label="Bank QR code" url={shop.bank_qr_url ?? null} kind="bank" shape="qr"
                    uploading={uploading} onUpload={upload} onRemove={() => set({ bank_qr_url: null })} />
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* Save bar: always reachable, shows whether there are unsaved changes */}
        {loaded && (
          <div className="sticky bottom-20 z-30 mt-6 lg:bottom-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
              <p className={cn("flex items-center gap-2 text-sm", error ? "text-destructive" : "text-muted-foreground")} role={error ? "alert" : "status"}>
                {error ? <><AlertCircle className="size-4 shrink-0" />{error}</>
                  : dirty ? <><span className="size-2 rounded-full bg-amber-500" />You have unsaved changes</>
                  : <><Check className="size-4 text-emerald-600" />All changes saved</>}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={cancel} disabled={saving}>Cancel</Button>
                <Button type="button" onClick={handleSave} disabled={saving || !dirty || !!uploading} className="gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ManagementShell>
  )
}

function Section({ id, icon: Icon, title, description, children }: {
  id: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string; children: React.ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-6 border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-serif text-lg"><Icon className="size-5 text-primary" />{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{children}</p>
}

/** Image upload with a clear preview and explicit Upload / Replace / Remove actions. */
function ImageField({ label, hint, url, kind, shape, disabled = false, uploading, onUpload, onRemove }: {
  label: string; hint?: string; url: string | null; kind: ImageKind; shape: "square" | "wide" | "qr"
  disabled?: boolean; uploading: ImageKind | null; onUpload: (kind: ImageKind, file: File) => void; onRemove: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const busy = uploading === kind
  const box = shape === "wide" ? "h-28 w-full" : shape === "square" ? "size-32" : "size-40"
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input ref={ref} type="file" accept="image/*" className="sr-only" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(kind, f); e.target.value = "" }} />
      <button type="button" disabled={disabled || busy} onClick={() => ref.current?.click()} aria-label={url ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        className={cn("relative mt-2 flex items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary/50 disabled:opacity-50", box)}>
        {busy ? <Loader2 className="size-6 animate-spin text-muted-foreground" />
          : url ? <Image src={url} alt={label} fill className={shape === "qr" ? "object-contain p-2" : "object-cover"} sizes="320px" />
          : <span className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground">
              {shape === "qr" ? <QrCode className="size-7" /> : <ImageIcon className="size-6" />}Upload
            </span>}
      </button>
      {url && !busy && (
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={disabled} onClick={() => ref.current?.click()}><Upload className="size-3.5" />Replace</Button>
          <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" disabled={disabled} onClick={onRemove}><X className="size-3.5" />Remove</Button>
        </div>
      )}
    </div>
  )
}
