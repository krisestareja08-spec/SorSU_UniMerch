import { RotateCcw, ShieldAlert } from "lucide-react"
import { pullProduct, restoreProduct } from "@/app/bao/actions"

/** BAO control for one product: pull it out (with a reason) or restore it. */
export function ProductControl({ id, status, pulledReason }: { id: string; status: string; pulledReason?: string | null }) {
  if (status === "pulled") {
    return (
      <div className="space-y-1">
        {pulledReason && <p className="text-[11px] text-destructive">Pulled: {pulledReason}</p>}
        <form action={restoreProduct}>
          <input type="hidden" name="product_id" value={id} />
          <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
            <RotateCcw className="size-3" /> Restore
          </button>
        </form>
      </div>
    )
  }
  if (status !== "approved") return <span className="text-xs capitalize text-muted-foreground">{status}</span>
  return (
    <form action={pullProduct} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="product_id" value={id} />
      <input name="reason" required minLength={5} placeholder="Violation (e.g. unlicensed logo)"
        className="h-7 w-44 rounded-lg border border-input bg-background px-2 text-xs" aria-label="Reason for pulling out" />
      <button type="submit" className="inline-flex h-7 items-center gap-1 rounded-lg bg-destructive px-2.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90">
        <ShieldAlert className="size-3" /> Pull out
      </button>
    </form>
  )
}
