/** Buyer ↔ store product conversations (scripts/24_product_chat.sql). */

export type ConversationStatus = "open" | "pending" | "closed"

/** A row of public.list_conversations() */
export type ConversationSummary = {
  id: string
  status: ConversationStatus
  closed_reason: "purchase" | "inactive" | "buyer" | "seller" | null
  last_message: string | null
  last_message_at: string
  last_from_store: boolean | null
  product_id: string | null
  product_name: string | null
  product_image: string | null
  product_price: number | null
  seller_id: string
  store_name: string | null
  store_logo: string | null
  buyer_id: string
  buyer_name: string
  unread: number
}

/** public.conversation_details() */
export type ConversationDetails = {
  id: string
  status: ConversationStatus
  closed_reason: ConversationSummary["closed_reason"]
  role: "buyer" | "store"
  product: {
    id: string; name: string; price: number; image_url: string | null; badge: string
    stock: number; variations: string[]; available: boolean
  } | null
  store: { id: string; name: string | null; logo_url: string | null }
  buyer: {
    id: string; name: string; verified: boolean; affiliation: string | null; campus: string | null
    course: string | null; department: string | null; orders_with_store: number
  }
}

export type ChatMessage = {
  id: string
  conversation_id: string
  sender_id: string | null
  from_store: boolean
  kind: "text" | "image" | "product" | "system"
  content: string | null
  image_url: string | null
  product_id: string | null
  is_read: boolean
  created_at: string
  /** Client-only: optimistic message still being sent */
  pending?: boolean
}

export const MESSAGE_COLUMNS = "id, conversation_id, sender_id, from_store, kind, content, image_url, product_id, is_read, created_at"

export const STATUS_LABEL: Record<ConversationStatus, string> = {
  open: "Open",
  pending: "Awaiting reply",
  closed: "Closed",
}

export const STATUS_STYLE: Record<ConversationStatus, string> = {
  open: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  closed: "bg-muted text-muted-foreground",
}

export const CLOSED_REASON: Record<NonNullable<ConversationSummary["closed_reason"]>, string> = {
  purchase: "Closed after purchase",
  inactive: "Closed after 14 days of inactivity",
  buyer: "Closed by the buyer",
  seller: "Closed by the seller",
}

/** Friendly error when the chat tables haven't been created yet. */
export function chatSetupError(message: string) {
  return /conversation|list_conversations|schema cache|does not exist/i.test(message)
    ? "Messaging isn't set up yet. Run scripts/24_product_chat.sql in Supabase."
    : message
}

export function chatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })
  const days = (now.getTime() - d.getTime()) / 86_400_000
  if (days < 7) return d.toLocaleDateString("en-PH", { weekday: "short" })
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })
}
