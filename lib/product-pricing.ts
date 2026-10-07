/**
 * Per-size prices and payment modes (scripts/27_variant_prices_payment_modes.sql).
 * Shared by the Add Product form, product pages, cart, checkout and the order server action.
 */

export type VariantPrices = Record<string, number>
export type PaymentMode = "walk_in" | "online"
export const PAYMENT_MODES: PaymentMode[] = ["walk_in", "online"]

/** Checkout payment methods and the payment mode each belongs to. */
export const PAYMENT_METHOD_MODE: Record<string, PaymentMode> = {
  cash: "walk_in",
  gcash: "online",
  bank: "online",
}

/** A product's variant prices from the database (anything malformed counts as "no size prices"). */
export function parseVariantPrices(raw: unknown): VariantPrices {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: VariantPrices = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v)
    if (k && Number.isFinite(n) && n >= 0) out[k] = n
  }
  return out
}

/** A product's payment modes (missing column / empty → both, the original behaviour). */
export function parsePaymentModes(raw: unknown): PaymentMode[] {
  const modes = Array.isArray(raw) ? raw.filter((m): m is PaymentMode => PAYMENT_MODES.includes(m as PaymentMode)) : []
  return modes.length ? modes : [...PAYMENT_MODES]
}

/** Price of one unit in the chosen size; sizes without their own price use the base price. */
export function unitPrice(basePrice: number, variantPrices: VariantPrices, variant?: string | null) {
  return variant && variantPrices[variant] != null ? variantPrices[variant] : basePrice
}

/** "₱250" or "₱250 – ₱300" when sizes are priced differently. */
export function priceRange(basePrice: number, variants: string[], variantPrices: VariantPrices) {
  const prices = variants.length ? variants.map((v) => unitPrice(basePrice, variantPrices, v)) : [basePrice]
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? `₱${min.toLocaleString()}` : `₱${min.toLocaleString()} – ₱${max.toLocaleString()}`
}

/** Payment modes every one of these products allows (a checkout only offers what all items accept). */
export function commonPaymentModes(perProduct: PaymentMode[][]): PaymentMode[] {
  return PAYMENT_MODES.filter((m) => perProduct.every((modes) => modes.includes(m)))
}
