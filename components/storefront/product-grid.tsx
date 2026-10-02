import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Package } from "lucide-react"
import { ProductCard } from "@/components/marketplace/product-card"
import { STOREFRONT_PAGE_SIZE, type StorefrontLayout, type StorefrontProduct } from "@/lib/storefront"

/** A seller's product listings (grid or list layout) with simple pagination links. */
export function ProductGrid({
  products,
  total,
  page,
  layout = "grid",
  pageHref,
  emptyText = "This seller has no live products yet.",
}: {
  products: StorefrontProduct[]
  total: number
  page: number
  layout?: StorefrontLayout
  pageHref: (page: number) => string
  emptyText?: string
}) {
  const pages = Math.max(1, Math.ceil(total / STOREFRONT_PAGE_SIZE))

  if (products.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div>
      {layout === "list" ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/marketplace/product/${p.id}`} className="flex items-center gap-4 p-3 hover:bg-muted/40">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {p.image ? <Image src={p.image} alt={p.name} fill className="object-cover" sizes="64px" /> : <Package className="m-auto size-6 text-muted-foreground/40" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category} · {(p.stock ?? 0) > 0 ? `${p.stock} in stock` : p.badge}</p>
                </div>
                <p className="shrink-0 font-bold text-gold">₱{p.price.toLocaleString()}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-muted"><ChevronLeft className="size-4" />Previous</Link>
          ) : <span />}
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-muted">Next<ChevronRight className="size-4" /></Link>
          ) : <span />}
        </nav>
      )}
    </div>
  )
}
