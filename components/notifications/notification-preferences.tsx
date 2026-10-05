"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Prefs = { order_updates: boolean; messages: boolean }

const ROWS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "order_updates", label: "Order updates", desc: "Order status changes, and new orders for stores you manage" },
  { key: "messages",      label: "New messages",  desc: "When a seller (or a buyer, for your store) sends you a message" },
]

/** Saved switches for which notifications the database creates (scripts/24_product_chat.sql). */
export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Prefs>({ order_updates: true, messages: true })
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from("notification_preferences").select("order_updates, messages").eq("user_id", user.id).maybeSingle()
      if (data) setPrefs(data)
    })
  }, [])

  async function toggle(key: keyof Prefs, value: boolean) {
    if (!userId) return
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    const { error } = await createClient().from("notification_preferences")
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() })
    if (error) {
      setPrefs(prefs)
      setStatus(error.message.includes("notification_preferences") ? "Couldn't save. Run scripts/24_product_chat.sql in Supabase." : error.message)
    } else setStatus("Saved")
  }

  return (
    <>
      {ROWS.map(({ key, label, desc }) => (
        <div key={key} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
          <label className="relative shrink-0 cursor-pointer">
            <input type="checkbox" checked={prefs[key]} disabled={!userId} onChange={(e) => toggle(key, e.target.checked)} className="peer sr-only" aria-label={label} />
            <div className="h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
            <div className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </label>
        </div>
      ))}
      {status && <p className="pt-2 text-xs text-muted-foreground" role="status">{status}</p>}
    </>
  )
}
