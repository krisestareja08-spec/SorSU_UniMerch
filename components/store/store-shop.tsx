"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { ManagementShell } from "@/components/management/management-shell"
import type { DashboardCtx } from "@/lib/modules"
import Link from "next/link"
import { ACCENTS, DEFAULT_THEME, storefrontHref, type StorefrontAccent, type StorefrontTheme } from "@/lib/storefront-theme"
import { Eye, ImageIcon, MapPin, Palette } from "lucide-react"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Store, QrCode, Upload, Check, Loader2, X, AlertCircle } from "lucide-react"

type ShopProfile = {
  org_name: string; description: string; gcash_number: string
  gcash_qr_url: string | null; bank_qr_url: string | null
  bank_account_name: string; bank_account_number: string
  logo_url: string | null; banner_url: string | null
  pickup_location: string | null; pickup_notes: string | null
  store_hours: string | null; claim_window_days: number
  theme: StorefrontTheme
}

export function StoreShop({ ctx }: { ctx: DashboardCtx }) {
  const [profile, setProfile] = useState<{ role: string; full_name: string | null; email: string } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [shop, setShop] = useState<Partial<ShopProfile>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<"gcash" | "bank" | "logo" | "banner" | null>(null)
  const [brandingAvailable, setBrandingAvailable] = useState(true)
  const [pickupAvailable, setPickupAvailable] = useState(true)
  const [hoursAvailable, setHoursAvailable] = useState(true)
  const logoRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)
  const gcashRef = useRef<HTMLInputElement>(null)
  const bankRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      // The storefront belongs to the organization (store), not to the signed-in member.
      setUserId(ctx.storeId)
      setProfile({ role: "", full_name: ctx.dashboardName, email: ctx.email })
      const base = "org_name, description, gcash_number, gcash_qr_url, bank_qr_url, bank_account_name, bank_account_number"
      let { data: sp, error } = await supabase.from("seller_profiles").select(`${base}, logo_url, banner_url, theme`).eq("id", ctx.storeId ?? "").maybeSingle()
      if (error) {
        // Branding columns arrive with scripts/11_storefront.sql
        setBrandingAvailable(false)
        ;({ data: sp } = await supabase.from("seller_profiles").select(base).eq("id", ctx.storeId ?? "").maybeSingle())
      }
      // Pickup location columns arrive with scripts/13_orders_pickup.sql
      const { data: pickup, error: pickupError } = await supabase.from("seller_profiles").select("pickup_location, pickup_notes").eq("id", ctx.storeId ?? "").maybeSingle()
      if (pickupError) setPickupAvailable(false)
      // Store hours + claim window arrive with scripts/22_preorder_pickup.sql
      const { data: hours, error: hoursError } = await supabase.from("seller_profiles").select("store_hours, claim_window_days").eq("id", ctx.storeId ?? "").maybeSingle()
      if (hoursError) setHoursAvailable(false)
      if (sp) setShop({ ...sp, ...(pickup ?? {}), ...(hours ?? {}), theme: { ...DEFAULT_THEME, ...((sp as { theme?: Partial<StorefrontTheme> }).theme ?? {}) } })
    })
  }, [])

  async function uploadBranding(type: "logo" | "banner", file: File) {
    if (!userId) return
    setUploading(type)
    const supabase = createClient()
    const ext = file.name.split(".").pop() || "png"
    const path = `${userId}/storefront-${type}-${file.lastModified}-${file.size}.${ext}`
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true })
    if (error) { alert("Upload failed: " + error.message); setUploading(null); return }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path)
    setShop((s) => ({ ...s, [`${type}_url`]: urlData.publicUrl }))
    setUploading(null)
  }

  const theme = shop.theme ?? DEFAULT_THEME
  const setTheme = (patch: Partial<StorefrontTheme>) => setShop((s) => ({ ...s, theme: { ...(s.theme ?? DEFAULT_THEME), ...patch } }))

  async function uploadQr(type: "gcash" | "bank", file: File) {
    if (!userId) return
    setUploading(type)
    const supabase = createClient()
    const ext = file.name.split(".").pop() || "png"
    const path = `${userId}/${type}-qr-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true })
    if (error) { alert("Upload failed: " + error.message); setUploading(null); return }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path)
    setShop((s) => ({ ...s, [`${type}_qr_url`]: urlData.publicUrl }))
    setUploading(null)
  }

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    // Section 8 — QR upload logic: mark the e-wallet QR active once any QR image is on file.
    const qrStatus = shop.gcash_qr_url || shop.bank_qr_url ? "active" : "inactive"
    // Update only this dashboard's store (the store record is created together with the seller).
    const { logo_url, banner_url, theme: shopTheme, pickup_location, pickup_notes, store_hours, claim_window_days, ...rest } = shop
    const payload = {
      ...rest,
      ...(brandingAvailable ? { logo_url, banner_url, theme: shopTheme ?? DEFAULT_THEME } : {}),
      ...(pickupAvailable ? { pickup_location: pickup_location?.trim() || null, pickup_notes: pickup_notes?.trim() || null } : {}),
      ...(hoursAvailable ? { store_hours: store_hours?.trim() || null, claim_window_days: Math.min(60, Math.max(1, Math.round(Number(claim_window_days) || 7))) } : {}),
      org_name: shop.org_name?.trim() || profile?.full_name || "My Shop",
      qr_status: qrStatus,
      qr_updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from("seller_profiles").update(payload).eq("id", userId)
    if (error) { setSaveError(error.message); setSaving(false); return }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!profile) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>

  return (
    <ManagementShell ctx={ctx}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeading title="Storefront" description="Your public shop page, branding and payment options shown to buyers." />
        {userId && (
          <Link href={storefrontHref(userId)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <Eye className="size-4" /> View storefront
          </Link>
        )}
      </div>

      <div className="mt-6 space-y-5 max-w-2xl">
        {/* Shop info */}
        <Card className="border-primary/10">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-serif text-base"><Store className="size-4 text-primary" />Shop Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Organization / Shop Name</Label><Input className="mt-1" placeholder="e.g. CICT Student Council" value={shop.org_name ?? ""} onChange={(e) => setShop((s) => ({ ...s, org_name: e.target.value }))} /></div>
            <div><Label>Shop Description</Label>
              <textarea rows={3} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Describe your shop..." value={shop.description ?? ""} onChange={(e) => setShop((s) => ({ ...s, description: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        {/* Pickup location — shown on receipts and order details */}
        <Card className="border-primary/10">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-serif text-base"><MapPin className="size-4 text-gold" />Pickup Location</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!pickupAvailable && (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Run <code>scripts/13_orders_pickup.sql</code> in Supabase to enable pickup locations.</p>
            )}
            <div>
              <Label htmlFor="pickup_location">Pickup address</Label>
              <textarea id="pickup_location" rows={2} disabled={!pickupAvailable}
                className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. CICT Building, Room 204, SorSU Bulan Campus"
                value={shop.pickup_location ?? ""} onChange={(e) => setShop((s) => ({ ...s, pickup_location: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="pickup_notes">Pickup schedule / instructions (optional)</Label>
              <textarea id="pickup_notes" rows={2} disabled={!pickupAvailable}
                className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Mon–Fri, 8:00 AM – 5:00 PM. Look for the council officer on duty."
                value={shop.pickup_notes ?? ""} onChange={(e) => setShop((s) => ({ ...s, pickup_notes: e.target.value }))} />
            </div>
            {!hoursAvailable && (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Run <code>scripts/22_preorder_pickup.sql</code> in Supabase to enable store hours and pre-order claim deadlines.</p>
            )}
            <div>
              <Label htmlFor="store_hours">Store hours</Label>
              <textarea id="store_hours" rows={2} disabled={!hoursAvailable}
                className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Mon–Fri, 8:00 AM – 5:00 PM (closed 12:00 – 1:00 PM)"
                value={shop.store_hours ?? ""} onChange={(e) => setShop((s) => ({ ...s, store_hours: e.target.value }))} />
              <p className="mt-1 text-xs text-muted-foreground">Shown to buyers at checkout so they know when they can walk in to claim a pre-order.</p>
            </div>
            <div>
              <Label htmlFor="claim_window_days">Claim deadline (days after ordering)</Label>
              <Input id="claim_window_days" type="number" min={1} max={60} disabled={!hoursAvailable} className="mt-1 w-28"
                value={shop.claim_window_days ?? 7} onChange={(e) => setShop((s) => ({ ...s, claim_window_days: Number(e.target.value) }))} />
              <p className="mt-1 text-xs text-muted-foreground">Pre-orders not claimed within this many days of being placed may be cancelled.</p>
            </div>
            <p className="text-xs text-muted-foreground">Buyers see this on their receipt and order details. New orders keep the location that was set when they were placed.</p>
          </CardContent>
        </Card>

        {/* Branding / customization */}
        <Card className="border-primary/10">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-serif text-base"><Palette className="size-4 text-primary" />Storefront Branding</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!brandingAvailable && (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Run <code>scripts/11_storefront.sql</code> in Supabase to enable logo, banner and theme settings.</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {(["logo", "banner"] as const).map((kind) => {
                const url = kind === "logo" ? shop.logo_url : shop.banner_url
                const ref = kind === "logo" ? logoRef : bannerRef
                return (
                  <div key={kind}>
                    <Label>{kind === "logo" ? "Shop logo" : "Banner image"}</Label>
                    <input ref={ref} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBranding(kind, f) }} />
                    <button type="button" disabled={!brandingAvailable || uploading === kind} onClick={() => ref.current?.click()}
                      className={`relative mt-1 flex w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 hover:border-primary/40 disabled:opacity-50 ${kind === "logo" ? "aspect-square max-w-32" : "h-24"}`}>
                      {uploading === kind ? <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        : url ? <Image src={url} alt="" fill className="object-cover" sizes="256px" />
                        : <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground"><ImageIcon className="size-5" />Upload</span>}
                    </button>
                    {url && <button type="button" className="mt-1 text-xs text-destructive" onClick={() => setShop((s) => ({ ...s, [`${kind}_url`]: null }))}>Remove</button>}
                  </div>
                )
              })}
            </div>
            <div><Label>Tagline</Label><Input className="mt-1" disabled={!brandingAvailable} placeholder="e.g. Official merch of the CICT Student Council" value={theme.tagline ?? ""} onChange={(e) => setTheme({ tagline: e.target.value })} /></div>
            <div>
              <Label>Accent color</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(ACCENTS) as StorefrontAccent[]).map((a) => (
                  <button key={a} type="button" disabled={!brandingAvailable} onClick={() => setTheme({ accent: a })}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs ${theme.accent === a ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
                    <span className={`size-4 rounded-full bg-linear-to-r ${ACCENTS[a].banner}`} />{ACCENTS[a].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <Label>Product layout</Label>
                <div className="mt-2 flex gap-1 rounded-lg border border-border p-1">
                  {(["grid", "list"] as const).map((l) => (
                    <button key={l} type="button" disabled={!brandingAvailable} onClick={() => setTheme({ layout: l })}
                      className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${theme.layout === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 self-end pb-1 text-sm">
                <input type="checkbox" disabled={!brandingAvailable} checked={theme.showBanner} onChange={(e) => setTheme({ showBanner: e.target.checked })} />
                Show banner
              </label>
            </div>
          </CardContent>
        </Card>

        {/* GCash */}
        <Card className="border-primary/10">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-serif text-base"><QrCode className="size-4 text-gold" />GCash Payment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>GCash Number</Label><Input className="mt-1" placeholder="09XXXXXXXXX" value={shop.gcash_number ?? ""} onChange={(e) => setShop((s) => ({ ...s, gcash_number: e.target.value }))} /></div>
            <div>
              <Label>GCash QR Code Image</Label>
              <input ref={gcashRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQr("gcash", f) }} />
              {shop.gcash_qr_url ? (
                <div className="mt-2 flex items-start gap-3">
                  <Image src={shop.gcash_qr_url} alt="GCash QR" width={128} height={128} className="size-32 rounded-xl border border-border object-contain" />
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" onClick={() => gcashRef.current?.click()} disabled={uploading === "gcash"}>
                      {uploading === "gcash" ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />} Replace
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setShop((s) => ({ ...s, gcash_qr_url: null }))}>
                      <X className="size-3" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => gcashRef.current?.click()} disabled={uploading === "gcash"}
                  className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-8 hover:border-primary/40">
                  {uploading === "gcash" ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : <><QrCode className="size-8 text-muted-foreground/50" /><span className="text-sm text-muted-foreground">Upload GCash QR</span></>}
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bank transfer */}
        <Card className="border-primary/10">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-serif text-base"><QrCode className="size-4 text-primary" />Bank Transfer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Account Name</Label><Input className="mt-1" placeholder="Juan Dela Cruz" value={shop.bank_account_name ?? ""} onChange={(e) => setShop((s) => ({ ...s, bank_account_name: e.target.value }))} /></div>
              <div><Label>Account Number</Label><Input className="mt-1" placeholder="0000 0000 0000" value={shop.bank_account_number ?? ""} onChange={(e) => setShop((s) => ({ ...s, bank_account_number: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Bank QR Code Image</Label>
              <input ref={bankRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQr("bank", f) }} />
              {shop.bank_qr_url ? (
                <div className="mt-2 flex items-start gap-3">
                  <Image src={shop.bank_qr_url} alt="Bank QR" width={128} height={128} className="size-32 rounded-xl border border-border object-contain" />
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" onClick={() => bankRef.current?.click()} disabled={uploading === "bank"}>
                      {uploading === "bank" ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />} Replace
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setShop((s) => ({ ...s, bank_qr_url: null }))}>
                      <X className="size-3" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => bankRef.current?.click()} disabled={uploading === "bank"}
                  className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-8 hover:border-primary/40">
                  {uploading === "bank" ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : <><QrCode className="size-8 text-muted-foreground/50" /><span className="text-sm text-muted-foreground">Upload Bank QR</span></>}
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {saveError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {saveError}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : <Store className="size-4" />}
          {saved ? "Saved!" : "Save Shop Settings"}
        </Button>
      </div>
    </ManagementShell>
  )
}
