"use client"

import React, { createContext, useContext, useReducer, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

export type CartItem = {
  id: string
  sellerId?: string
  name: string
  seller: string
  price: number
  image: string
  badge: "Available" | "Pre-Order" | "Interest Check" | "Sold Out"
  quantity: number
  /** Size label shown to the buyer, e.g. "M / Maroon" */
  variant?: string
  /** The exact variant (scripts/28): its own price, stock and SKU */
  variantId?: string
  sku?: string
  // Unchecked items stay in the cart but are skipped at checkout; undefined counts as selected
  selected?: boolean
}

/** One cart line per product AND variant: a shirt in S and the same shirt in L are separate lines. */
export function lineKey(item: Pick<CartItem, "id" | "variant" | "variantId">) {
  return item.variantId ? `${item.id}::${item.variantId}` : item.variant ? `${item.id}::${item.variant}` : item.id
}

type CartState = { items: CartItem[]; loaded: boolean }

type CartAction =
  | { type: "LOAD"; items: CartItem[] }
  | { type: "ADD"; item: CartItem }
  | { type: "REMOVE"; id: string }
  | { type: "REMOVE_MANY"; ids: string[] }
  | { type: "SET_SELECTED"; ids: string[]; selected: boolean }
  | { type: "UPDATE_QTY"; id: string; delta: number }
  | { type: "CLEAR" }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "LOAD":
      return { items: action.items, loaded: true }
    case "ADD": {
      const key = lineKey(action.item)
      const exists = state.items.find((i) => lineKey(i) === key)
      if (exists) {
        return { ...state, items: state.items.map((i) => lineKey(i) === key ? { ...i, price: action.item.price, quantity: i.quantity + action.item.quantity, selected: true } : i) }
      }
      return { ...state, items: [...state.items, action.item] }
    }
    case "REMOVE":
      return { ...state, items: state.items.filter((i) => lineKey(i) !== action.id) }
    case "REMOVE_MANY":
      return { ...state, items: state.items.filter((i) => !action.ids.includes(lineKey(i))) }
    case "SET_SELECTED":
      return { ...state, items: state.items.map((i) => (action.ids.includes(lineKey(i)) ? { ...i, selected: action.selected } : i)) }
    case "UPDATE_QTY":
      return {
        ...state,
        items: state.items.map((i) =>
          lineKey(i) === action.id ? { ...i, quantity: Math.max(1, i.quantity + action.delta) } : i
        ),
      }
    case "CLEAR":
      return { ...state, items: [] }
    default:
      return state
  }
}

type CartContextType = CartState & {
  addItem: (item: CartItem) => void
  /** These take cart line keys — lineKey(item) — not product ids */
  removeItem: (key: string) => void
  removeItems: (keys: string[]) => void
  setSelected: (keys: string[], selected: boolean) => void
  updateQty: (key: string, delta: number) => void
  clearCart: () => void
  itemCount: number
  total: number
}

const CartContext = createContext<CartContextType | null>(null)
const STORAGE_KEY = "unimerch_cart"
const OWNER_KEY = "unimerch_cart_owner"   // whose cart is in localStorage (shared browsers)
const DEVICE_KEY = "unimerch_cart_device" // this browser, so it ignores its own sync echoes
const PUSH_DELAY_MS = 600

/** Same product in both carts: keep the larger quantity. */
function mergeCarts(a: CartItem[], b: CartItem[]) {
  const byId = new Map(a.map((i) => [lineKey(i), i]))
  for (const item of b) {
    const mine = byId.get(lineKey(item))
    byId.set(lineKey(item), mine ? { ...mine, quantity: Math.max(mine.quantity, item.quantity) } : item)
  }
  return [...byId.values()]
}

function readLocal(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id) }
    return id
  } catch {
    return "unknown"
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], loaded: false })
  // Signed-in user whose cart syncs to user_carts (scripts/26); null = this browser only
  const syncUser = useRef<string | null>(null)
  const skipPush = useRef(false)

  useEffect(() => {
    const local = readLocal()
    dispatch({ type: "LOAD", items: local })

    // Multi-device sync: merge with the account's saved cart, then follow changes from other devices
    const supabase = createClient()
    const device = deviceId()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return
      const { data: row, error } = await supabase.from("user_carts").select("items").eq("user_id", user.id).maybeSingle()
      if (error || cancelled) return // table not created yet: stay local-only
      let owner: string | null = null
      try { owner = localStorage.getItem(OWNER_KEY) } catch {}
      // Never carry another account's leftover cart into this one
      const mine = owner && owner !== user.id ? [] : local
      const server = Array.isArray(row?.items) ? (row.items as CartItem[]) : []
      try { localStorage.setItem(OWNER_KEY, user.id) } catch {}
      syncUser.current = user.id
      dispatch({ type: "LOAD", items: mergeCarts(server, mine) })

      channel = supabase
        .channel(`cart-${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "user_carts", filter: `user_id=eq.${user.id}` }, (payload) => {
          const next = payload.new as { items?: CartItem[]; device?: string } | undefined
          if (!next?.items || next.device === device) return
          skipPush.current = true // applying a remote change: don't send it straight back
          dispatch({ type: "LOAD", items: next.items })
        })
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    // Skip until the initial load finishes, otherwise this overwrites storage with the empty starting state
    if (!state.loaded) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))

    const userId = syncUser.current
    if (!userId) return
    if (skipPush.current) { skipPush.current = false; return }
    const t = setTimeout(() => {
      createClient().from("user_carts")
        .upsert({ user_id: userId, items: state.items, device: deviceId(), updated_at: new Date().toISOString() })
        .then(() => {})
    }, PUSH_DELAY_MS)
    return () => clearTimeout(t)
  }, [state.items, state.loaded])

  const itemCount = state.items.reduce((s, i) => s + i.quantity, 0)
  const total = state.items.reduce((s, i) => s + i.price * i.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        // False until localStorage is read; show a loading state instead of "cart is empty"
        loaded: state.loaded,
        addItem: (item) => dispatch({ type: "ADD", item }),
        removeItem: (id) => dispatch({ type: "REMOVE", id }),
        removeItems: (ids) => dispatch({ type: "REMOVE_MANY", ids }),
        setSelected: (ids, selected) => dispatch({ type: "SET_SELECTED", ids, selected }),
        updateQty: (id, delta) => dispatch({ type: "UPDATE_QTY", id, delta }),
        clearCart: () => dispatch({ type: "CLEAR" }),
        itemCount,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used inside CartProvider")
  return ctx
}
