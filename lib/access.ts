export type RoyaltyResult = {
  royaltyAmount: number
  finalPrice: number
  isRoyaltyProduct: boolean
}

/** Section 6 — logo royalty calculation. royaltyPercentage is BAO-controlled, not seller-editable. */
export function computeRoyalty(price: number, hasLogo: boolean, royaltyPercentage: number): RoyaltyResult {
  if (!hasLogo) return { royaltyAmount: 0, finalPrice: price, isRoyaltyProduct: false }
  const royaltyAmount = Math.round(price * (royaltyPercentage / 100) * 100) / 100
  const finalPrice = Math.round((price - royaltyAmount) * 100) / 100
  return { royaltyAmount, finalPrice, isRoyaltyProduct: true }
}
