"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ManagementShell } from "@/components/management/management-shell"
import { PageHeading } from "@/components/management/dashboard-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Boxes, Check, Loader2 } from "lucide-react"
import type { UserRole } from "@/lib/roles"

const STORAGE_KEY = "unimerch_supply_settings"

type SupplySettings = { lowStockThreshold: string; notifyOnRestock: boolean }
const DEFAULTS: SupplySettings = { lowStockThreshold: "10", notifyOnRestock: true }

export default function SupplyOfficeSettingsPage() {
  const router = useRouter()
  const [account, setAccount] = useState<{ role: UserRole; fullName: string | null; email: string } | null>(null)
  const [settings, setSettings] = useState<SupplySettings>(() => {
    if (typeof window === "undefined") return DEFAULTS
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : DEFAULTS
    } catch {
      return DEFAULTS
    }
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/auth/login"); return }
      const { data } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle()
      setAccount({ role: (data?.role as UserRole) ?? "supply_office", fullName: data?.full_name ?? null, email: user.email ?? "" })
    })
  }, [router])

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!account) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>

  return (
    <ManagementShell role={account.role} fullName={account.fullName} email={account.email}>
      <PageHeading title="Supply Office Settings" description="Restock thresholds and notification preferences for this device." />
      <div className="mt-6 max-w-xl space-y-5">
        <Card className="border-primary/10">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-serif text-base"><Boxes className="size-4 text-primary" />Inventory Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>Default low-stock threshold</Label>
              <Input type="number" min="0" value={settings.lowStockThreshold} onChange={(e) => setSettings((s) => ({ ...s, lowStockThreshold: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.notifyOnRestock} onChange={(e) => setSettings((s) => ({ ...s, notifyOnRestock: e.target.checked }))} />
              Notify when items are restocked
            </label>
            <Button onClick={handleSave} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {saved ? <Check className="size-4" /> : <Boxes className="size-4" />}
              {saved ? "Saved" : "Save Preferences"}
            </Button>
            <p className="text-xs text-muted-foreground">Saved to this browser only — connect to a settings table to sync across devices.</p>
          </CardContent>
        </Card>
      </div>
    </ManagementShell>
  )
}

