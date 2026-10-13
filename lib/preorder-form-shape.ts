/** Pre-order completion form shapes and formatting, shared by server pages and client views. */

/** A Size / Qty cell of a form: the products it covers (names kept for products deleted later) */
export type FormColumn = { products: { id: string; name: string }[] }

export type PreorderFormDef = { id: string; title: string; columns: FormColumn[]; createdAt: string; updatedAt: string }

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
