import { createClient } from "@/lib/supabase/server"
import { ProductCard } from "@/components/marketplace/product-card"
import Link from "next/link"
import { findProducts } from "@/lib/products"
import { ArrowLeft } from "lucide-react"

const CATEGORY_LABELS: Record<string, string | null> = {
  shirts: "Shirts & Uniforms",
  uniforms: "Shirts & Uniforms",
  merchandise: "Merch & Souvenirs",
  "id-lace": "Lace & ID Accessories",
  "dept-merch": "Merch & Souvenirs",
  tickets: "Events & Tickets",
  food: "Food & Beverages",
  supplies: "Office Supplies",
  hoodies: "Shirts & Uniforms",
  tumblers: "Merch & Souvenirs",
  featured: null,
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const dbCategory = CATEGORY_LABELS[slug]
  const label = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  // Capped like search, so a big catalogue doesn't load every product at once
  const products = await findProducts(supabase, {
    category: dbCategory ?? undefined,
    inStock: true,
    limit: 120,
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link href="/marketplace/categories" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All Categories
      </Link>

      <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">{label}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{products.length} product{products.length !== 1 && "s"} found</p>
      <div className="mt-3 h-px bg-linear-to-r from-gold/60 via-gold/20 to-transparent" />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
        {products.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No products in this category yet.
          </p>
        )}
      </div>
    </div>
  )
}
