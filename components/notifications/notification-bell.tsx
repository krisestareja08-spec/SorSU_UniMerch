"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { NOTIFICATION_EVENT } from "./live-alerts"

type Notification = { id: string; kind: string; title: string; body: string | null; href: string | null; read_at: string | null; created_at: string }

const POLL_MS = 30_000

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
}

/**
 * Bell icon with unread count and a dropdown of the latest notifications.
 * Notifications are created by the database (scripts/17_notifications.sql); this polls every 30s.
 * `tone` adapts the icon to a dark (maroon header) or light background.
 */
export function NotificationBell({ tone = "light" }: { tone?: "light" | "dark" }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from("notifications")
      .select("id, kind, title, body, href, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
    if (error) { setUnavailable(true); return }
    setUnavailable(false)
    setItems((data ?? []) as Notification[])
  }, [])

  useEffect(() => {
    // Initial fetch + polling; all state updates happen after the awaited request.
    const first = setTimeout(load, 0)
    const id = setInterval(load, POLL_MS)
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    window.addEventListener(NOTIFICATION_EVENT, onFocus) // LiveAlerts saw a new one arrive
    return () => { clearTimeout(first); clearInterval(id); window.removeEventListener("focus", onFocus); window.removeEventListener(NOTIFICATION_EVENT, onFocus) }
  }, [load])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey) }
  }, [open])

  const unread = items.filter((n) => !n.read_at).length

  async function markAllRead() {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id)
    if (!ids.length) return
    setLoading(true)
    const now = new Date().toISOString()
    await createClient().from("notifications").update({ read_at: now }).in("id", ids)
    setItems((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    setLoading(false)
  }

  async function openItem(n: Notification) {
    if (!n.read_at) {
      const now = new Date().toISOString()
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)))
      await createClient().from("notifications").update({ read_at: now }).eq("id", n.id)
    }
    setOpen(false)
    if (n.href) router.push(n.href)
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) load() }}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className={cn(
          "relative rounded-lg p-2 transition-colors active:scale-95",
          tone === "dark" ? "text-primary-foreground/80 hover:bg-primary-foreground/10" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-4 text-primary">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button type="button" onClick={markAllRead} disabled={!unread || loading}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">
              {loading ? <Loader2 className="size-3 animate-spin" /> : <CheckCheck className="size-3.5" />}Mark all read
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {unavailable && <li className="px-4 py-6 text-center text-xs text-muted-foreground">Notifications aren&apos;t set up yet (run scripts/17_notifications.sql).</li>}
            {!unavailable && items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openItem(n)}
                  className={cn("flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-muted/50", !n.read_at && "bg-primary/5")}>
                  <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => { setOpen(false); router.push("/marketplace/notifications") }}
            className="block w-full border-t border-border px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-muted/50">
            View all notifications
          </button>
        </div>
      )}
    </div>
  )
}
