"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { MessageCircle, Package, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { STATUS_LABEL, STATUS_STYLE, chatSetupError, chatTime, type ConversationStatus, type ConversationSummary } from "@/lib/messages"
import { ConversationThread } from "./conversation-thread"

const FILTERS: { id: "all" | "unread" | ConversationStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "pending", label: "Awaiting reply" },
  { id: "closed", label: "Closed" },
]

/**
 * Conversation list + thread. Buyers see their conversations with stores; store staff
 * (`storeId` set) see the store's conversations with buyers. `?c=<id>` selects a conversation.
 */
export function Inbox({ perspective, storeId, basePath, initialId, emptyHint }: {
  perspective: "buyer" | "store"
  storeId?: string | null
  /** Page path used to keep ?c= in the address bar */
  basePath: string
  initialId?: string | null
  emptyHint?: React.ReactNode
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(initialId ?? null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [query, setQuery] = useState("")

  const load = useCallback(async () => {
    const { data, error: err } = await createClient().rpc("list_conversations", { p_store: perspective === "store" ? storeId : null })
    if (err) setError(chatSetupError(err.message))
    else { setError(null); setConversations((data ?? []) as ConversationSummary[]) }
    setLoading(false)
  }, [perspective, storeId])

  useEffect(() => {
    const supabase = createClient()
    // Close stale conversations first so the list shows the right status
    supabase.rpc("close_inactive_conversations").then(() => load())

    // Any change to one of our conversations (new message, status) refreshes the list
    const channel = supabase
      .channel(`inbox-${perspective}-${storeId ?? "me"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", ...(perspective === "store" && storeId ? { filter: `seller_id=eq.${storeId}` } : {}) },
        () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, perspective, storeId])

  function select(id: string | null) {
    setActiveId(id)
    window.history.replaceState(null, "", id ? `${basePath}?c=${id}` : basePath)
  }

  const q = query.trim().toLowerCase()
  const shown = conversations.filter((c) => {
    if (filter === "unread" && c.unread === 0) return false
    if (filter !== "all" && filter !== "unread" && c.status !== filter) return false
    if (!q) return true
    return [c.product_name, c.store_name, c.buyer_name, c.last_message].some((s) => s?.toLowerCase().includes(q))
  })

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-112 overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:h-[calc(100dvh-9rem)]">
      {/* Conversation list (hidden on mobile while a thread is open) */}
      <aside className={cn("flex w-full flex-col border-border lg:w-80 lg:shrink-0 lg:border-r", activeId && "hidden lg:flex")} aria-label="Conversations">
        <div className="space-y-2 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations"
              aria-label="Search conversations"
              className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
                className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  filter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <li key={i} className="flex gap-3 border-b border-border p-3">
                <div className="size-11 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2"><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 w-full animate-pulse rounded bg-muted" /></div>
              </li>
            ))
          ) : error ? (
            <li className="p-6 text-center text-xs text-muted-foreground">{error}</li>
          ) : shown.length === 0 ? (
            <li className="p-8 text-center text-sm text-muted-foreground">
              {conversations.length === 0 ? (emptyHint ?? "No conversations yet.") : "No conversations match."}
            </li>
          ) : (
            shown.map((c) => {
              const name = perspective === "store" ? c.buyer_name : c.store_name ?? "Seller"
              const mineLast = c.last_from_store === (perspective === "store")
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => select(c.id)} aria-current={c.id === activeId ? "true" : undefined}
                    className={cn("flex w-full gap-3 border-b border-border p-3 text-left transition-colors hover:bg-muted/50", c.id === activeId && "bg-primary/5")}>
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {c.product_image ? <Image src={c.product_image} alt="" fill className="object-cover" sizes="44px" /> : <Package className="m-auto mt-2.5 size-6 text-muted-foreground/40" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn("truncate text-sm", c.unread ? "font-bold" : "font-semibold")}>{name}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{chatTime(c.last_message_at)}</span>
                      </div>
                      <p className="truncate text-xs text-primary/80">{c.product_name ?? "Product removed"}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className={cn("min-w-0 flex-1 truncate text-xs", c.unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                          {c.last_message ? `${mineLast ? "You: " : ""}${c.last_message}` : "No messages yet"}
                        </p>
                        {c.unread > 0 ? (
                          <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-5 text-primary-foreground" aria-label={`${c.unread} unread`}>
                            {c.unread > 99 ? "99+" : c.unread}
                          </span>
                        ) : (
                          <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold", STATUS_STYLE[c.status])}>{STATUS_LABEL[c.status]}</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </aside>

      {/* Thread */}
      <section className={cn("min-w-0 flex-1", !activeId && "hidden lg:block")}>
        {activeId ? (
          <ConversationThread key={activeId} conversationId={activeId} perspective={perspective} onActivity={load} onBack={() => select(null)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
            <MessageCircle className="mb-3 size-10 text-muted-foreground/30" />
            <p>Select a conversation to start chatting.</p>
            {perspective === "buyer" && (
              <p className="mt-1 text-xs">Have a question about a product? Tap <span className="font-medium text-foreground">Message Seller</span> on its page. Questions about an order go in the <Link href="/marketplace/orders" className="text-primary hover:underline">order&apos;s chat</Link>.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
