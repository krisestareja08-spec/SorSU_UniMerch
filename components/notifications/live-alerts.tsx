"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { showSystemNotification } from "@/lib/pwa"

type Alert = { id: string; title: string; body: string | null; href: string | null }

export const BROWSER_ALERTS_KEY = "browser-alerts"
/** Fired so the bell (and anything else) can refresh when a notification arrives */
export const NOTIFICATION_EVENT = "unimerch-notification"
const SHOW_MS = 6000

export function browserAlertsOn() {
  try {
    return typeof Notification !== "undefined" && Notification.permission === "granted" && localStorage.getItem(BROWSER_ALERTS_KEY) !== "off"
  } catch {
    return false
  }
}

/**
 * Real-time alerts for order status, payments, pickups and messages: listens for the user's new
 * notifications (Supabase Realtime) and shows an in-app toast, plus a system notification when
 * the tab is in the background and browser alerts are allowed (Settings → Notifications).
 * Works while UniMerch is open in any tab; alerts to a closed browser need Web Push (future).
 */
export function LiveAlerts() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    const pending = timers.current

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      channel = supabase
        .channel(`live-alerts-${user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
          const n = payload.new as Alert
          window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT))
          // Already looking at it (e.g. the open chat) — no need to interrupt
          if (n.href && n.href.split("#")[0] === window.location.pathname + window.location.search) return

          if (document.visibilityState !== "visible" && browserAlertsOn()) {
            showSystemNotification(n.title, n.body, n.href, n.id)
          }
          setAlerts((list) => [n, ...list].slice(0, 3))
          pending.set(n.id, setTimeout(() => dismiss(n.id), SHOW_MS))
        })
        .subscribe()
    })

    return () => {
      if (channel) supabase.removeChannel(channel)
      pending.forEach(clearTimeout)
      pending.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once per mount
  }, [])

  function dismiss(id: string) {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setAlerts((list) => list.filter((a) => a.id !== id))
  }

  if (alerts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-3 top-16 z-60 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:top-20" aria-live="polite" role="region" aria-label="Alerts">
      {alerts.map((a) => (
        <div key={a.id} role="status" className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Bell className="size-4 text-primary" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{a.title}</p>
            {a.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>}
            {a.href && (
              <button type="button" onClick={() => { dismiss(a.id); router.push(a.href!) }} className="mt-1.5 text-xs font-semibold text-primary hover:underline">View</button>
            )}
          </div>
          <button type="button" onClick={() => dismiss(a.id)} aria-label="Dismiss alert" className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>
      ))}
    </div>
  )
}
