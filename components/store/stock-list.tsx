import type { ReactNode } from "react"
import { ProductThumb } from "@/components/ui/product-thumb"
import { cn } from "@/lib/utils"

export const LOW_STOCK = 5

export type StockSize = { id: string; name: string; stock: number; sku?: string | null }
export type StockItem = { id: string; name: string; image: string | null; subtitle?: ReactNode; stock: number; sizes: StockSize[] }

/** "12 in stock" / "Low · 3" / "Out of stock" */
export function StockPill({ n, className }: { n: number; className?: string }) {
  const [label, tone] = n === 0 ? ["Out of stock", "bg-destructive/10 text-destructive"]
    : n <= LOW_STOCK ? [`Low · ${n}`, "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"]
    : [`${n} in stock`, "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"]
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", tone, className)}>{label}</span>
}

/**
 * Products and their sizes as cards — photo, name, stock — each with its own action (update,
 * request, correct…). Works the same on phones (no sideways scrolling) and on desktops.
 */
export function StockList({ items, action, productAction, empty = "No products yet." }: {
  items: StockItem[]
  /** The action for a product without sizes (size = null), or for one size */
  action: (item: StockItem, size: StockSize | null) => ReactNode
  /** An action for the whole product, shown on its row even when it has sizes */
  productAction?: (item: StockItem) => ReactNode
  empty?: ReactNode
}) {
  if (items.length === 0) return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="space-y-2">
      {items.map((p) => (
        <li key={p.id} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 p-3">
            <ProductThumb src={p.image} alt={p.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <StockPill n={p.stock} />
                {p.sizes.length > 0 && <span>{p.sizes.length} sizes</span>}
                {p.subtitle}
              </div>
            </div>
            {(productAction || p.sizes.length === 0) && (
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                {productAction?.(p)}
                {p.sizes.length === 0 && action(p, null)}
              </div>
            )}
          </div>
          {p.sizes.length > 0 && (
            <ul className="divide-y divide-border border-t border-border bg-muted/20">
              {p.sizes.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:pl-[4.25rem]">
                  <span className="min-w-12 rounded-md bg-card px-2 py-0.5 text-center text-sm font-semibold ring-1 ring-border">{s.name}</span>
                  <StockPill n={s.stock} />
                  {s.sku && <span className="text-xs text-muted-foreground">SKU {s.sku}</span>}
                  <div className="ml-auto">{action(p, s)}</div>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
