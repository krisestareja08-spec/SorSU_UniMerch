"use client"

import React, { createContext, useContext, useReducer, useEffect } from "react"

export type CartItem = {
  id: string
  sellerId?: string
  name: string
  seller: string
  price: number
  image: string
  badge: "Available" | "Pre-Order" | "Interest Check" | "Sold Out"
  quantity: number
  variant?: string
}

type CartState = { items: CartItem[]; loaded: boolean }

type CartAction =
  | { type: "LOAD"; items: CartItem[] }
  | { type: "ADD"; item: CartItem }
  | { type: "REMOVE"; id: string }
  | { type: "UPDATE_QTY"; id: string; delta: number }
  | { type: "CLEAR" }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "LOAD":
      return { items: action.items, loaded: true }
    case "ADD": {
      const exists = state.items.find((i) => i.id === action.item.id)
      if (exists) {
        return { ...state, items: state.items.map((i) => i.id === action.item.id ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return { ...state, items: [...state.items, action.item] }
    }
    case "REMOVE":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) }
    case "UPDATE_QTY":
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.id ? { ...i, quantity: Math.max(1, i.quantity + action.delta) } : i
        ),
      }
    case "CLEAR":
      return { ...state, items: [] }
    default:
      return state
  }
}

type CartContextType = Omit<CartState, "loaded"> & {
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQty: (id: string, delta: number) => void
  clearCart: () => void
  itemCount: number
  total: number
}

const CartContext = createContext<CartContextType | null>(null)
const STORAGE_KEY = "unimerch_cart"

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], loaded: false })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      dispatch({ type: "LOAD", items: raw ? JSON.parse(raw) : [] })
    } catch {
      dispatch({ type: "LOAD", items: [] })
    }
  }, [])

  useEffect(() => {
    // Skip until the initial load finishes, otherwise this overwrites storage with the empty starting state
    if (!state.loaded) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))
  }, [state.items, state.loaded])

  const itemCount = state.items.reduce((s, i) => s + i.quantity, 0)
  const total = state.items.reduce((s, i) => s + i.price * i.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        addItem: (item) => dispatch({ type: "ADD", item }),
        removeItem: (id) => dispatch({ type: "REMOVE", id }),
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
