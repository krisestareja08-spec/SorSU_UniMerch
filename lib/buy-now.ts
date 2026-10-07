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

export function clearBuyNowItem() {
  try { sessionStorage.removeItem(KEY) } catch {}
}

/** Items from different shops can't share one checkout: one shop, one payment. */
export function shopKey(item: Pick<CartItem, "sellerId" | "seller">) {
  return item.sellerId ?? item.seller
}
