"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, BadgeCheck, ImagePlus, Loader2, Lock, LockOpen, Package, Send, ShieldCheck, ShoppingBag, Store, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { storefrontHref } from "@/lib/storefront-theme"
import { AFFILIATION_LABELS, type Affiliation } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { ChatBuyButton, type BuyableProduct } from "./chat-buy-button"
import {
  CLOSED_REASON, MESSAGE_COLUMNS, STATUS_LABEL, STATUS_STYLE, chatSetupError, chatTime,
  type ChatMessage, type ConversationDetails,
} from "@/lib/messages"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function peso(n: number) {
  return `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * One product conversation. `perspective` decides who "me" is: the buyer, or the store's staff.
 * Messages arrive live (Supabase Realtime) and are marked read while the thread is on screen.
 */
export function ConversationThread({ conversationId, perspective, onActivity, onBack }: {
  conversationId: string
  perspective: "buyer" | "store"
  /** Called after anything that changes the inbox list (new message, read, status) */
  onActivity?: () => void
  /** Mobile: back to the conversation list */
  onBack?: () => void
}) {
  const asStore = perspective === "store"
  const [details, setDetails] = useState<ConversationDetails | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [products, setProducts] = useState<Record<string, BuyableProduct>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [uploading, setUploading] = useState(false)
  const [picker, setPicker] = useState<BuyableProduct[] | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const onActivityRef = useRef(onActivity)
  useEffect(() => { onActivityRef.current = onActivity }, [onActivity])

  const markRead = useCallback(async () => {
    if (document.visibilityState !== "visible") return
    await createClient().rpc("mark_conversation_read", { p_conv: conversationId })
    onActivityRef.current?.()
  }, [conversationId])

  const loadDetails = useCallback(async () => {
    const { data, error: err } = await createClient().rpc("conversation_details", { p_conv: conversationId })
    if (err) { setError(chatSetupError(err.message)); return }
    if (!data) { setError("This conversation doesn't exist or you no longer have access to it."); return }
    const d = data as ConversationDetails
    // variations is free-form jsonb; anything but a list of strings is treated as "no variants"
    if (d.product) d.product.variations = Array.isArray(d.product.variations) ? d.product.variations.filter((v) => typeof v === "string") : []
    setDetails(d)
  }, [conversationId])

  // Product cards: fetch any products referenced by messages that we haven't loaded yet
  const loadProducts = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    const { data } = await createClient().from("products").select("id, name, price, image_url, badge, stock, variations, status").in("id", ids)
    setProducts((prev) => {
      const next = { ...prev }
      for (const p of data ?? []) {
        next[p.id] = { ...p, price: Number(p.price), variations: Array.isArray(p.variations) ? p.variations.filter((v: unknown) => typeof v === "string") : [], available: p.status === "approved" }
      }
      return next
    })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    const upsert = (m: ChatMessage) => setMessages((prev) => {
      const i = prev.findIndex((p) => p.id === m.id)
      if (i === -1) return [...prev, m]
      const copy = [...prev]; copy[i] = m; return copy
    })

    const messagesQuery = supabase.from("conversation_messages").select(MESSAGE_COLUMNS).eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }).limit(300)
    Promise.all([messagesQuery, Promise.resolve().then(loadDetails)]).then(([{ data, error: err }]) => {
      if (cancelled) return
      if (err) setError(chatSetupError(err.message))
      const rows = ((data ?? []) as ChatMessage[]).reverse()
      setMessages(rows)
      setLoading(false)
      loadProducts([...new Set(rows.filter((m) => m.product_id).map((m) => m.product_id as string))])
      markRead()
    })

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as ChatMessage
        upsert(m)
        if (m.product_id) loadProducts([m.product_id])
        if (m.kind === "system") loadDetails()
        if (m.kind !== "system" && m.from_store !== asStore) markRead()
        else onActivityRef.current?.()
      })
      // Read receipts flip is_read on our own messages
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => upsert(payload.new as ChatMessage))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` },
        () => loadDetails())
      .subscribe()

    const onVisible = () => { if (document.visibilityState === "visible") markRead() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [conversationId, asStore, loadDetails, loadProducts, markRead])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages.length])

  async function insertMessage(fields: Pick<ChatMessage, "kind"> & Partial<Pick<ChatMessage, "content" | "image_url" | "product_id">>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError("Your session expired. Sign in again."); return false }
    // Optimistic: show the message immediately, swap in the stored row when it comes back
    const tempId = `temp-${crypto.randomUUID()}`
    const temp: ChatMessage = {
      id: tempId, conversation_id: conversationId, sender_id: user.id, from_store: asStore, kind: fields.kind,
      content: fields.content ?? null, image_url: fields.image_url ?? null, product_id: fields.product_id ?? null,
      is_read: false, created_at: new Date().toISOString(), pending: true,
    }
    setMessages((prev) => [...prev, temp])
    const { data, error: err } = await supabase
      .from("conversation_messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, from_store: asStore, ...fields })
      .select(MESSAGE_COLUMNS)
      .single()
    if (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setError(chatSetupError(err.message))
      return false
    }
    setMessages((prev) => {
      const without = prev.filter((m) => m.id !== tempId)
      return without.some((m) => m.id === data.id) ? without : [...without, data as ChatMessage]
    })
    setError(null)
    onActivityRef.current?.()
    return true
  }

  async function sendText(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput("")
    if (!(await insertMessage({ kind: "text", content: text }))) setInput(text)
  }

  async function sendImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) { setError("Only images can be sent."); return }
    if (file.size > MAX_IMAGE_BYTES) { setError("Photos must be 5 MB or smaller."); return }
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
      const path = `${user.id}/${conversationId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from("chat-images").upload(path, file, { contentType: file.type })
      if (upErr) setError(upErr.message.includes("Bucket") ? "Photo uploads aren't set up yet. Run scripts/24_product_chat.sql." : upErr.message)
      else await insertMessage({ kind: "image", image_url: supabase.storage.from("chat-images").getPublicUrl(path).data.publicUrl })
    }
    setUploading(false)
  }

  async function openPicker() {
    if (!details) return
    setPicker([])
    const { data } = await createClient().from("products").select("id, name, price, image_url, badge, stock, variations, status")
      .eq("seller_id", details.store.id).eq("status", "approved").order("created_at", { ascending: false }).limit(50)
    setPicker((data ?? []).map((p) => ({ ...p, price: Number(p.price), variations: Array.isArray(p.variations) ? p.variations : [], available: true })))
  }

  async function shareProduct(p: BuyableProduct) {
    setPicker(null)
    setProducts((prev) => ({ ...prev, [p.id]: p }))
    await insertMessage({ kind: "product", product_id: p.id })
  }

  async function toggleClosed() {
    if (!details) return
    setStatusBusy(true)
    const { error: err } = await createClient().rpc("set_conversation_status", { p_conv: conversationId, p_close: details.status !== "closed" })
    if (err) setError(err.message)
    await loadDetails()
    onActivityRef.current?.()
    setStatusBusy(false)
  }

  const product = details?.product ?? null
  const storeName = details?.store.name ?? "Seller"
  const otherName = asStore ? details?.buyer.name ?? "Buyer" : storeName
  const lastMine = [...messages].reverse().find((m) => m.kind !== "system" && m.from_store === asStore)

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header: who you're talking to + status */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:px-4">
        {onBack && (
          <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden" aria-label="Back to conversations">
            <ArrowLeft className="size-5" />
          </button>
        )}
        <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
          {!asStore && details?.store.logo_url
            ? <Image src={details.store.logo_url} alt="" fill className="object-cover" sizes="36px" />
            : asStore ? <span className="text-xs font-bold text-primary">{otherName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>
            : <Store className="size-4 text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {!asStore && details ? <Link href={storefrontHref(details.store.id)} className="truncate hover:underline">{otherName}</Link> : otherName}
            {asStore && details?.buyer.verified && <BadgeCheck className="size-4 shrink-0 text-emerald-600" aria-label="Verified buyer" />}
          </p>
          {details && (
            <p className="truncate text-xs text-muted-foreground">
              {asStore
                ? [AFFILIATION_LABELS[details.buyer.affiliation as Affiliation] ?? details.buyer.affiliation, details.buyer.course, details.buyer.campus].filter(Boolean).join(" · ") || "Buyer"
                : "Seller"}
            </p>
          )}
        </div>
        {details && (
          <>
            <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline", STATUS_STYLE[details.status])}>{STATUS_LABEL[details.status]}</span>
            <Button type="button" variant="ghost" size="sm" onClick={toggleClosed} disabled={statusBusy} className="shrink-0 gap-1 text-xs"
              title={details.status === "closed" ? "Reopen conversation" : "Close conversation"}>
              {statusBusy ? <Loader2 className="size-3.5 animate-spin" /> : details.status === "closed" ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
              <span className="hidden sm:inline">{details.status === "closed" ? "Reopen" : "Close"}</span>
            </Button>
          </>
        )}
      </div>

      {/* Product this conversation is about */}
      {product && (
        <div className="flex items-start gap-3 border-b border-border bg-muted/30 px-3 py-2.5 sm:px-4">
          <Link href={`/marketplace/product/${product.id}`} className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
            {product.image_url ? <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="56px" /> : <Package className="m-auto mt-4 size-6 text-muted-foreground/40" />}
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/marketplace/product/${product.id}`} className="line-clamp-1 text-sm font-medium hover:text-primary">{product.name}</Link>
            <p className="text-sm font-bold text-gold">{peso(product.price)}</p>
            <p className="text-[11px] text-muted-foreground">
              {!product.available ? "No longer listed" : product.badge === "Pre-Order" ? "Pre-Order" : product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
              {asStore && details && ` · ${details.buyer.orders_with_store} completed order${details.buyer.orders_with_store === 1 ? "" : "s"} with your store`}
            </p>
          </div>
          {!asStore && details && (
            <div className="w-40 shrink-0 sm:w-48"><ChatBuyButton product={product} sellerId={details.store.id} storeName={storeName} compact /></div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4" aria-live="polite" aria-label="Messages">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className={cn("h-10 w-2/3 animate-pulse rounded-2xl bg-muted", i % 2 === 0 && "ml-auto")} />)}</div>
        ) : (
          messages.map((m) => {
            if (m.kind === "system") {
              return <p key={m.id} className="mx-auto max-w-sm rounded-full bg-muted px-3 py-1 text-center text-[11px] text-muted-foreground">{m.content}</p>
            }
            const mine = m.from_store === asStore
            const shared = m.product_id ? products[m.product_id] : undefined
            return (
              <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                {m.kind === "image" && m.image_url ? (
                  <a href={m.image_url} target="_blank" rel="noopener noreferrer" className={cn("block overflow-hidden rounded-2xl border border-border", m.pending && "opacity-60")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.image_url} alt="Photo sent in chat" className="max-h-64 max-w-[16rem] object-cover" />
                  </a>
                ) : m.kind === "product" ? (
                  <div className={cn("w-64 overflow-hidden rounded-2xl border border-border bg-card", m.pending && "opacity-60")}>
                    {shared ? (
                      <>
                        <Link href={`/marketplace/product/${shared.id}`} className="flex gap-3 p-3 hover:bg-muted/40">
                          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {shared.image_url ? <Image src={shared.image_url} alt="" fill className="object-cover" sizes="56px" /> : <Package className="m-auto mt-4 size-6 text-muted-foreground/40" />}
                          </div>
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-medium">{shared.name}</p>
                            <p className="text-sm font-bold text-gold">{peso(shared.price)}</p>
                          </div>
                        </Link>
                        {!asStore && details && <div className="border-t border-border p-2.5"><ChatBuyButton product={shared} sellerId={details.store.id} storeName={storeName} compact /></div>}
                      </>
                    ) : <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><ShoppingBag className="size-4" />Product no longer available</p>}
                  </div>
                ) : (
                  <div className={cn("max-w-[80%] whitespace-pre-line wrap-break-word rounded-2xl px-3.5 py-2 text-sm",
                    mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground", m.pending && "opacity-70")}>
                    {m.content}
                  </div>
                )}
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  {m.pending ? "Sending…" : chatTime(m.created_at)}
                  {mine && !m.pending && m.id === lastMine?.id && (m.is_read ? " · Seen" : " · Sent")}
                </span>
              </div>
            )
          })
        )}
      </div>

      {details?.status === "closed" && (
        <p className="border-t border-border bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground">
          {details.closed_reason ? CLOSED_REASON[details.closed_reason] : "Conversation closed"}. Sending a message reopens it.
        </p>
      )}
      {error && <p className="border-t border-border bg-destructive/5 px-4 py-2 text-xs text-destructive" role="alert">{error}</p>}

      {/* Store: product picker for sharing / upselling */}
      {picker && (
        <div className="max-h-56 overflow-y-auto border-t border-border bg-card p-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-muted-foreground">Share a product</p>
            <button type="button" onClick={() => setPicker(null)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Close product list"><X className="size-4" /></button>
          </div>
          {picker.length === 0 ? <p className="p-3 text-center text-xs text-muted-foreground">Loading products…</p> : (
            <div className="grid gap-1 sm:grid-cols-2">
              {picker.map((p) => (
                <button key={p.id} type="button" onClick={() => shareProduct(p)} className="flex items-center gap-2 rounded-lg p-1.5 text-left hover:bg-muted">
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                    {p.image_url && <Image src={p.image_url} alt="" fill className="object-cover" sizes="36px" />}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{p.name}</span>
                    <span className="text-xs font-bold text-gold">{peso(p.price)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={sendText} className="flex items-end gap-1.5 border-t border-border bg-card p-2 sm:gap-2">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={sendImage} className="hidden" />
        <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={uploading || !details} className="shrink-0" aria-label="Send a photo">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        </Button>
        {asStore && (
          <Button type="button" variant="ghost" size="icon" onClick={openPicker} disabled={!details} className="shrink-0" aria-label="Share a product">
            <ShoppingBag className="size-4" />
          </Button>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }}
          rows={1}
          maxLength={2000}
          placeholder={`Message ${otherName}…`}
          aria-label={`Message ${otherName}`}
          disabled={!details}
          className="max-h-32 min-h-9 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button type="submit" size="icon" disabled={!input.trim() || !details} className="shrink-0 rounded-xl" aria-label="Send message">
          <Send className="size-4" />
        </Button>
      </form>
      <p className="flex items-center justify-center gap-1 bg-card pb-2 text-[10px] text-muted-foreground">
        <ShieldCheck className="size-3" />Keep chats and payments on UniMerch. We can&apos;t help with deals made elsewhere.
      </p>
    </div>
  )
}
