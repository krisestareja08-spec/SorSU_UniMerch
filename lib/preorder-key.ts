/** URL key of a pre-order form: the product id, or the product name for a product that was deleted. */
export const formKey = (f: { productId: string | null; productName: string }) =>
  f.productId ?? `n-${encodeURIComponent(f.productName)}`
