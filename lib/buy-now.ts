import { useSyncExternalStore } from "react"
import type { CartItem } from "@/lib/cart-context"

/**
 * "Buy" / "Buy Now": checks out ONE product without touching the cart. The item is held for this
 * tab only (sessionStorage) and /marketplace/checkout?buy=1 shows just that item.
 */
const KEY = "unimerch_buy_now"
export const BUY_NOW_CHECKOUT = "/marketplace/checkout?buy=1"

export function setBuyNowItem(item: CartItem) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...item, selected: true })) } catch {}
}

export function readBuyNowItem(): CartItem | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    const item = raw ? JSON.parse(raw) : null
    return item && typeof item.id === "string" ? (item as CartItem) : null
  } catch {
    return null
  }
}

// The same item for every render until sessionStorage changes (useSyncExternalStore needs that)
let snapshot: { raw: string | null; item: CartItem | null } | null = null
function readSnapshot(): CartItem | null {
  let raw: string | null = null
  try { raw = sessionStorage.getItem(KEY) } catch {}
  if (!snapshot || snapshot.raw !== raw) snapshot = { raw, item: readBuyNowItem() }
  return snapshot.item
}
const noSubscribe = () => () => {}

/** The held item: undefined until the browser has read it (and on the server), then the item or null */
export function useBuyNowItem(): CartItem | null | undefined {
  return useSyncExternalStore(noSubscribe, readSnapshot, () => undefined)
}

export function clearBuyNowItem() {
  try { sessionStorage.removeItem(KEY) } catch {}
}

/** Items from different shops can't share one checkout: one shop, one payment. */
export function shopKey(item: Pick<CartItem, "sellerId" | "seller">) {
  return item.sellerId ?? item.seller
}
