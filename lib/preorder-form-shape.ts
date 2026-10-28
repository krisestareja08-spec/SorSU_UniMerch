/** Pre-order form shapes and formatting, shared by server pages and client views. */

/** A Size / Qty cell of a form: the products it covers (names kept for products deleted later) */
export type FormColumn = { products: { id: string; name: string }[] }

export type PreorderFormDef = { id: string; title: string; columns: FormColumn[]; createdAt: string; updatedAt: string }

/** waitlist: paid half / full, waiting · ready: marked ready for pick up · claimed: picked up (History) */
export type PreorderStage = "waitlist" | "ready" | "claimed"

/** A form's row: one buyer, the sizes / quantities per product, and the share of the payment */
export type PreorderFormRow = {
  key: string
  orderId: string
  buyerName: string
  course: string | null
  contact: string | null
  /** product id → e.g. "M-2, L-1" */
  cells: Record<string, string>
  /** product id → units */
  quantities: Record<string, number>
  /** Each line of the form's products, for stock checks */
  sizes: { productId: string; variantId: string | null; variant: string | null; quantity: number }[]
  quantity: number
  amountPaid: number
  /** What this form's products cost in the order */
  share: number
  partial: boolean
  plan: string | null
  stage: PreorderStage
  status: string
  queueNo: number | null
  orderedAt: string
  pickupDate: string | null
  claimedAt: string | null
}

/** Stock of a form's products: product id → total and per size */
export type FormStock = Record<string, { name: string; image: string | null; stock: number; sizes: { id: string; name: string; stock: number }[] }>

const SIZE_CODES: Record<string, string> = {
  "extra small": "XS", "x-small": "XS", xsmall: "XS", small: "S", medium: "M", large: "L",
  "extra large": "XL", "x-large": "XL", xlarge: "XL", "2x-large": "2XL", xxl: "2XL", "3x-large": "3XL", xxxl: "3XL",
}

/** "Medium", 2 → "M-2"; no size → "2" */
export function sizeQty(variant: string | null, quantity: number): string {
  const v = (variant ?? "").trim()
  if (!v) return String(quantity)
  return `${SIZE_CODES[v.toLowerCase()] ?? v}-${quantity}`
}
