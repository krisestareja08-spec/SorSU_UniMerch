"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MessageCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { formatOrderTime } from "@/lib/order-status"
import { cn } from "@/lib/utils"

type Message = { id: string; sender_id: string; from_store: boolean; message: string; created_at: string }

/**
 * Conversation about one order between the buyer and the store (scripts/23_order_chat.sql).
 * `asStore` sends messages as the store's staff; otherwise as the buyer.
 */
export function OrderChat({ orderId, asStore = false, otherParty, className }: { orderId: string; asStore?: boolean; otherParty: string; className?: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    const add = (m: Message) => setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))

    supabase
      .from("order_messages")
      .select("id, sender_id, from_store, message, created_at")
      .eq("order_id", orderId)
      .order("created_at")
      .then(({ data, error: err }) => {
        if (err) setError(err.message.includes("order_messages") ? "Chat isn't set up yet. Run scripts/23_order_chat.sql in Supabase." : err.message)
        else setMessages(data ?? [])
        setLoading(false)
      })

    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => add(payload.new as Message))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orderId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setSending(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error: err } = await supabase
        .from("order_messages")
        .insert({ order_id: orderId, sender_id: user.id, from_store: asStore, message: text })
        .select("id, sender_id, from_store, message, created_at")
        .single()
      if (err) setError(err.message)
      else {
        setMessages((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]))
        setInput("")
      }
    }
    setSending(false)
  }

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-xl border border-border bg-background", className)}>
      <div ref={listRef} className="h-64 space-y-2 overflow-y-auto p-3" aria-live="polite">
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className={cn("h-10 w-2/3 animate-pulse rounded-2xl bg-muted", i === 2 && "ml-auto")} />)}</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
            <MessageCircle className="mb-2 size-6 text-muted-foreground/40" />
            No messages yet. Ask {otherParty} about this order.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.from_store === asStore
            return (
              <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                <div className={cn("max-w-[80%] whitespace-pre-line wrap-break-word rounded-2xl px-3.5 py-2 text-sm",
                  mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground")}>
                  {!mine && <p className="mb-0.5 text-[10px] font-bold text-primary/70">{otherParty}</p>}
                  {m.message}
                </div>
                <span className="mt-0.5 text-[10px] text-muted-foreground">{formatOrderTime(m.created_at)}</span>
              </div>
            )
          })
        )}
      </div>
      {error && <p className="border-t border-border bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
      <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder={`Message ${otherParty}…`}
          aria-label={`Message ${otherParty}`}
          className="h-9 flex-1 rounded-xl border border-border bg-background px-3 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()} className="shrink-0 rounded-xl" aria-label="Send message">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  )
}
