import Link from "next/link"
import { ProductCard } from "./product-card"
import { createClient } from "@/lib/supabase/server"
import { findProducts } from "@/lib/products"

export async function ProductGrid({ title = "All Products" }: { title?: string }) {
  const supabase = await createClient()
  const products = await findProducts(supabase, { inStock: true, limit: 40 })

  return (
    <section aria-labelledby="product-grid-title">
      <div className="flex items-center justify-between">
        <h2 id="product-grid-title" className="font-serif text-base font-semibold text-foreground sm:text-lg">{title}</h2>
        <Link href="/marketplace/search" className="text-xs font-medium text-gold hover:underline">
          See all
        </Link>
      </div>
      <div className="mb-4 mt-1.5 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
        {products.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No approved products are available yet.
          </p>
        )}
      </div>
    </section>
  )
}
