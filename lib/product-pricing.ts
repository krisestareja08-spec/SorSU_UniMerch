/**
 * Payment modes per product (scripts/27): walk-in (cash at the counter), online, or both.
 * Shared by the Add Product form, checkout and the order server action.
 * (Per-size prices, stock and SKUs are product variants — lib/variants.ts, scripts/28.)
 */

export type PaymentMode = "walk_in" | "online"
export const PAYMENT_MODES: PaymentMode[] = ["walk_in", "online"]

/** Checkout payment methods and the payment mode each belongs to. */
export const PAYMENT_METHOD_MODE: Record<string, PaymentMode> = {
  cash: "walk_in",
  gcash: "online",
  bank: "online",
}

/** A product's payment modes (missing column / empty → both, the original behaviour). */
export function parsePaymentModes(raw: unknown): PaymentMode[] {
  const modes = Array.isArray(raw) ? raw.filter((m): m is PaymentMode => PAYMENT_MODES.includes(m as PaymentMode)) : []
  return modes.length ? modes : [...PAYMENT_MODES]
}

/** Payment modes every one of these products allows (a checkout only offers what all items accept). */
export function commonPaymentModes(perProduct: PaymentMode[][]): PaymentMode[] {
  return PAYMENT_MODES.filter((m) => perProduct.every((modes) => modes.includes(m)))
}
