"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import Image from "next/image"
import { MessageCircle, Package, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type Product = { id: string; name: string; status: string; image_url: string | null }
type Message = { id: string; sender_id: string; message: string; created_at: string }

const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected: "bg-destructive/10 text-destructive",
}

export function SellerChatPanel({ products, sellerId }: { products: Product[]; sellerId: string }) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0] ?? null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedProduct) return
    const supabase = createClient()

    async function loadMessages() {
      const { data } = await supabase
        .from("product_messages")
        .select("id, sender_id, message, created_at")
        .eq("product_id", selectedProduct!.id)
        .order("created_at", { ascending: true })
      setMessages(data ?? [])
    }
    loadMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel(`product-messages-${selectedProduct.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "product_messages", filter: `product_id=eq.${selectedProduct.id}` },
        (payload) => setMessages((m) => [...m, payload.new as Message])
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedProduct])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !selectedProduct) return
    setSending(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from("product_messages").insert({
        product_id: selectedProduct.id,
        sender_id: user.id,
        message: input.trim(),
      })
    }
    setInput("")
    setSending(false)
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-16 text-center">
        <MessageCircle className="size-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">No products yet</p>
        <p className="text-xs text-muted-foreground/60">Submit a product to start a conversation with BAO.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] overflow-hidden rounded-2xl border border-primary/10 shadow-sm">
      {/* Product list sidebar */}
      <div className="w-60 shrink-0 overflow-y-auto border-r border-border bg-card">
        <p className="px-4 pb-2 pt-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Products</p>
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProduct(p)}
            className={cn(
              "flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/40",
              selectedProduct?.id === p.id && "bg-primary/5"
            )}
          >
            <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
              {p.image_url ? (
                <Image src={p.image_url} alt={p.name} fill className="object-cover" />
              ) : (
                <Package className="m-auto size-5 text-muted-foreground/40" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{p.name}</p>
              <span className={cn("mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold", STATUS_COLORS[p.status] ?? STATUS_COLORS.pending)}>
                {p.status}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col bg-background">
        {selectedProduct ? (
          <>
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <MessageCircle className="size-4 text-primary" />
              <p className="text-sm font-medium text-foreground">{selectedProduct.name}</p>
              <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_COLORS[selectedProduct.status] ?? STATUS_COLORS.pending)}>
                {selectedProduct.status}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 p-4">
              {messages.length === 0 && (
                <p className="text-center text-xs text-muted-foreground">No messages yet. Start the conversation with BAO.</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.sender_id === sellerId ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-xs rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                    m.sender_id === sellerId
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}>
                    {m.sender_id !== sellerId && <p className="mb-0.5 text-[10px] font-bold text-primary/70">BAO Admin</p>}
                    {m.message}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-border p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message to BAO..."
                className="flex-1 h-9 rounded-xl border border-border bg-background px-3 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim()} className="shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a product to view its conversation.
          </div>
        )}
      </div>
    </div>
  )
}
