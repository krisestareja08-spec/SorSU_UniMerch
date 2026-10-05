"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Bell, CheckCheck, FileText, Loader2, MessageCircle, Package, ShieldCheck, ShoppingBag, Trash2, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Notification = { id: string; kind: string; title: string; body: string | null; href: string | null; read_at: string | null; created_at: string }

const PAGE = 30
const TABS = [
  { id: "all", label: "All", kinds: null },
  { id: "orders", label: "Orders", kinds: ["order"] },
  { id: "messages", label: "Messages", kinds: ["message"] },
  { id: "account", label: "Account", kinds: ["verification", "violation", "report", "product", "info"] },
] as const
type TabId = (typeof TABS)[number]["id"] | "unread"

const KIND_ICON: Record<string, LucideIcon> = {
  order: ShoppingBag, message: MessageCircle, verification: ShieldCheck, product: Package, report: FileText, violation: AlertTriangle,
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

/** Full notification inbox: filter by type, mark read, delete. Updates live when a new one arrives. */
export function NotificationCenter() {
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>([])
  const [tab, setTab] = useState<TabId>("all")
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (offset = 0) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/auth/login"); return }
    let q = supabase.from("notifications").select("id, kind, title, body, href, read_at, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).range(offset, offset + PAGE - 1)
    const kinds = TABS.find((t) => t.id === tab)?.kinds
    if (kinds) q = q.in("kind", [...kinds])
    if (tab === "unread") q = q.is("read_at", null)
    const { data, error: err } = await q
    if (err) setError("Notifications aren't set up yet. Run scripts/17_notifications.sql in Supabase.")
    else {
      setError(null)
      setItems((prev) => (offset === 0 ? data ?? [] : [...prev, ...(data ?? [])]))
      setMore((data ?? []).length === PAGE)
    }
    setLoading(false)
  }, [tab, router])

  useEffect(() => {
    const supabase = createClient()
    const first = setTimeout(() => load(0), 0)
    // New notifications appear without a refresh (scripts/25 adds the table to Realtime)
    const channel = supabase.channel("notification-center")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => load(0))
      .subscribe()
    return () => { clearTimeout(first); supabase.removeChannel(channel) }
  }, [load])

  function switchTab(id: TabId) {
    setTab(id)
    setLoading(true)
    setItems([])
  }

  async function open(n: Notification) {
    if (!n.read_at) {
      const now = new Date().toISOString()
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)))
      await createClient().from("notifications").update({ read_at: now }).eq("id", n.id)
    }
    if (n.href) router.push(n.href)
  }

  async function markAllRead() {
    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    if (user) await supabase.from("notifications").update({ read_at: now }).eq("user_id", user.id).is("read_at", null)
    setItems((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    setBusy(false)
  }

  async function remove(id: string) {
    setItems((list) => list.filter((n) => n.id !== id))
    await createClient().from("notifications").delete().eq("id", id)
  }

  async function clearRead() {
    if (!window.confirm("Delete all read notifications?")) return
    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from("notifications").delete().eq("user_id", user.id).not("read_at", "is", null)
    setItems((list) => list.filter((n) => !n.read_at))
    setBusy(false)
  }

  const unreadShown = items.some((n) => !n.read_at)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1" role="tablist" aria-label="Notification type">
          {[...TABS.map((t) => ({ id: t.id as TabId, label: t.label })), { id: "unread" as TabId, label: "Unread" }].map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => switchTab(t.id)}
              className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={markAllRead} disabled={busy || !unreadShown} className="gap-1 text-xs">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}Mark all read
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearRead} disabled={busy} className="gap-1 text-xs text-muted-foreground">
            <Trash2 className="size-3.5" />Clear read
          </Button>
        </div>
      </div>

      <ul className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <li key={i} className="flex gap-3 border-b border-border p-4 last:border-0">
              <div className="size-9 animate-pulse rounded-xl bg-muted" />
              <div className="flex-1 space-y-2"><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /><div className="h-3 w-3/4 animate-pulse rounded bg-muted" /></div>
            </li>
          ))
        ) : error ? (
          <li className="p-8 text-center text-sm text-muted-foreground">{error}</li>
        ) : items.length === 0 ? (
          <li className="flex flex-col items-center p-10 text-center text-sm text-muted-foreground">
            <Bell className="mb-2 size-8 text-muted-foreground/40" />
            {tab === "unread" ? "You're all caught up." : "No notifications here yet."}
          </li>
        ) : (
          items.map((n) => {
            const Icon = KIND_ICON[n.kind] ?? Bell
            return (
              <li key={n.id} className={cn("group flex items-start gap-3 border-b border-border p-4 last:border-0", !n.read_at && "bg-primary/5")}>
                <button type="button" onClick={() => open(n)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="size-4 text-primary" />
                    {!n.read_at && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card" aria-label="Unread" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm leading-snug", n.read_at ? "font-medium" : "font-semibold")}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted-foreground">{when(n.created_at)}</span>
                  </span>
                </button>
                <button type="button" onClick={() => remove(n.id)} aria-label="Delete notification"
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                  <Trash2 className="size-4" />
                </button>
              </li>
            )
          })
        )}
      </ul>

      {more && !loading && (
        <div className="mt-4 text-center">
          <Button type="button" variant="outline" size="sm" onClick={() => load(items.length)}>Load more</Button>
        </div>
      )}
    </div>
  )
}
