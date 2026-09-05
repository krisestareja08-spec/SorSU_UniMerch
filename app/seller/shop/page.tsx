"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Store, QrCode, Upload, Check, Loader2, X } from "lucide-react"

type ShopProfile = {
  org_name: string; description: string; gcash_number: string
  gcash_qr_url: string | null; bank_qr_url: string | null
  bank_account_name: string; bank_account_number: string
}

export default function SellerShopPage() {
  const [profile, setProfile] = useState<{ role: string; full_name: string | null; email: string } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [shop, setShop] = useState<Partial<ShopProfile>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState<"gcash" | "bank" | null>(null)
  const gcashRef = useRef<HTMLInputElement>(null)
  const bankRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const { data: p } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle()
      setProfile({ role: p?.role ?? "seller", full_name: p?.full_name ?? null, email: user.email ?? "" })
      const { data: sp } = await supabase.from("seller_profiles").select("org_name, description, gcash_number, gcash_qr_url, bank_qr_url, bank_account_name, bank_account_number").eq("id", user.id).maybeSingle()
      if (sp) setShop(sp)
    })
  }, [])

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
    const supabase = createClient()
    await supabase.from("seller_profiles").upsert({ id: userId, ...shop }, { onConflict: "id" })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!profile) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>

  return (
    <ManagementShell role={profile.role as "seller"} fullName={profile.full_name} email={profile.email}>
      <PageHeading title="Shop Settings" description="Configure your shop details and payment options shown to buyers." />

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

        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : <Store className="size-4" />}
          {saved ? "Saved!" : "Save Shop Settings"}
        </Button>
      </div>
    </ManagementShell>
  )
}
