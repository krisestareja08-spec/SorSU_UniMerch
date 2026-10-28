"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Message = { id: string; from_main: boolean; message: string; created_at: string }
const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

/**
 * Conversation about one supply request between the requester and the Main Supply Office
 * (scripts/31). The database marks who sent each message and notifies the other side.
 */
export function SupplyRequestChat({ requestId, asMain, otherParty }: { requestId: string; asMain: boolean; otherParty: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data, error: err } = await createClient().from("supply_request_messages")
      .select("id, from_main, message, created_at").eq("request_id", requestId).order("created_at")
    if (err) setError(err.message)
    else setMessages(data ?? [])
    setLoading(false)
  }, [requestId])

  // Check for new messages every 15 seconds while the page is open
  useEffect(() => {
    const first = setTimeout(load, 0)
    const t = setInterval(load, 15000)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [load])
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }) }, [messages.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setSending(true)
    setError(null)
    const { error: err } = await createClient().from("supply_request_messages").insert({ request_id: requestId, message: text.slice(0, 2000) })
    setSending(false)
    if (err) { setError(err.message); return }
    setInput("")
    load()
  }

  return (
    <div className="space-y-2">
      <div ref={listRef} className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3">
        {loading ? <Loader2 className="mx-auto size-5 animate-spin text-primary" />
          : messages.length === 0 ? <p className="text-center text-xs text-muted-foreground">No messages yet. Ask about the design, sizes, price or dates.</p>
          : messages.map((m) => {
            const mine = m.from_main === asMain
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "border border-border bg-card")}>
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  <p className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{mine ? "You" : otherParty} · {when(m.created_at)}</p>
                </div>
              </div>
            )
          })}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <form onSubmit={send} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} aria-label="Message"
          placeholder={`Message ${otherParty}`} className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm" />
        <Button type="submit" disabled={sending || !input.trim()} className="gap-1.5">{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Send</Button>
      </form>
    </div>
  )
}
