/**
 * Supply requests (scripts/31): special orders from organizations and Supply Office branches to the
 * Main Supply Office. Shapes and labels shared by server pages and client components.
 */

export type SupplyStatus =
  | "submitted" | "changes_requested" | "approved" | "payment_review" | "paid" | "preparing"
  | "ready" | "out_for_delivery" | "completed" | "declined" | "cancelled"

export type SupplyItemKind = "catalog" | "modified" | "custom" | "collab_stock"

export type SupplyAttachment = { url?: string; path?: string; name: string; kind: "image" | "document"; signedUrl?: string | null }

export type SupplyItem = {
  id: string; kind: SupplyItemKind; product_id: string | null; variant_id: string | null; design_group: string | null
  name: string; size: string | null; quantity: number; notes: string | null; uses_logo: boolean; list_on_marketplace: boolean
  unit_price: number | null; royalty_percentage: number | null; royalty_amount: number; created_product_id: string | null; position: number
  /** Product / size photo, or the design's first image (scripts/31) */
  image_url?: string | null
}

export type SupplyRequest = {
  id: string; requester_store_id: string; requester_module: "seller" | "cashier"; requester_name: string
  title: string; description: string | null; link_url: string | null; attachments: SupplyAttachment[]
  needed_by: string | null; fulfilment: "pickup" | "delivery"; delivery_address: string | null; status: SupplyStatus
  items_total: number | null; royalty_total: number | null; delivery_fee: number; total: number | null; royalty_percentage: number | null
  main_note: string | null; payment_method: string | null; receipt_url: string | null; reference_number: string | null
  quoted_at: string | null; paid_at: string | null; scheduled_date: string | null; completed_at: string | null
  created_at: string; updated_at: string
  items: SupplyItem[]
}

/** Catalog / own products offered in the request form */
export type PickProduct = { id: string; name: string; price: number; image: string | null; logo: boolean; sizes: { id: string; name: string; price: number }[] }

export const SUPPLY_STATUS: Record<SupplyStatus, { label: string; tone: string; requesterHint: string; mainHint: string }> = {
  submitted:         { label: "Waiting for review",   tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", requesterHint: "The Main Supply Office is reviewing your request.", mainHint: "Review it: approve with a quote, ask for changes, or decline." },
  changes_requested: { label: "Changes requested",    tone: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300", requesterHint: "Update the request and send it again.", mainHint: "Waiting for the requester to update it." },
  approved:          { label: "Waiting for payment",  tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", requesterHint: "Pay the quote (it includes the royalty) to confirm the order.", mainHint: "Waiting for payment. Mark it paid when cash is received at the counter." },
  payment_review:    { label: "Payment to check",     tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", requesterHint: "The Main office is checking your payment.", mainHint: "Check the receipt, then mark it paid (or send it back)." },
  paid:              { label: "Paid",                 tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", requesterHint: "Paid. The Main office will prepare your order.", mainHint: "Prepare the order, then mark it ready for pick-up or out for delivery." },
  preparing:         { label: "Being prepared",       tone: "bg-primary/10 text-primary", requesterHint: "Your order is being prepared.", mainHint: "Mark it ready for pick-up or out for delivery when it's done." },
  ready:             { label: "Ready for pick-up",    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", requesterHint: "Pick it up at the Main Supply Office.", mainHint: "Mark it completed when it's picked up." },
  out_for_delivery:  { label: "Out for delivery",     tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", requesterHint: "It's on the way.", mainHint: "Mark it completed when it's delivered." },
  completed:         { label: "Completed",            tone: "bg-muted text-muted-foreground", requesterHint: "Delivered / picked up.", mainHint: "Done." },
  declined:          { label: "Declined",             tone: "bg-destructive/10 text-destructive", requesterHint: "The Main Supply Office declined this request.", mainHint: "Declined." },
  cancelled:         { label: "Cancelled",            tone: "bg-destructive/10 text-destructive", requesterHint: "You cancelled this request.", mainHint: "Cancelled by the requester." },
}

export const ITEM_KIND_LABEL: Record<SupplyItemKind, string> = {
  catalog: "Supply Office item", modified: "Modified item", custom: "New design", collab_stock: "Stock for our collab product",
}

/** Statuses still in progress (not closed) */
export const OPEN_STATUSES: SupplyStatus[] = ["submitted", "changes_requested", "approved", "payment_review", "paid", "preparing", "ready", "out_for_delivery"]

export const pesoFmt = (n: number | null | undefined) =>
  n == null ? "—" : `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const requestCode = (id: string) => `#${id.slice(0, 8).toUpperCase()}`
