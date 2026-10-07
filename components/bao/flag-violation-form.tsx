import { Flag } from "lucide-react"
import { flagStoreViolation } from "@/app/bao/actions"
import { ActionForm } from "@/components/ui/action-form"

/** BAO records a violation against a store (and notifies the store's dashboard members). */
export function FlagViolationForm({ storeId, productId }: { storeId: string; productId?: string }) {
  return (
    <ActionForm action={flagStoreViolation} className="space-y-2">
      <input type="hidden" name="store_id" value={storeId} />
      {productId && <input type="hidden" name="product_id" value={productId} />}
      <textarea name="reason" required minLength={5} rows={2} placeholder="What rule was violated? The seller will be notified."
        aria-label="Violation details" className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        <select name="severity" aria-label="Severity" className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
          <option value="warning">Warning</option>
          <option value="serious">Serious violation</option>
        </select>
        <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/40 px-3 text-sm font-semibold text-destructive hover:bg-destructive/10">
          <Flag className="size-4" /> Flag &amp; notify seller
        </button>
      </div>
    </ActionForm>
  )
}
