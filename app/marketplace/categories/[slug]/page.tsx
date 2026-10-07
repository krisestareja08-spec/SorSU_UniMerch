import { createClient } from "@/lib/supabase/server"
import { ProductCard, type Product } from "@/components/marketplace/product-card"
import Link from "next/link"
import { withPriceRange } from "@/lib/variants"
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

  let query = supabase
    .from("products")
    .select("id, name, price, image_url, badge, stock, seller_id")
    .eq("status", "approved")
    .gt("stock", 0)
    .order("created_at", { ascending: false })

  if (dbCategory !== undefined && dbCategory !== null) query = query.eq("category", dbCategory)

  const { data } = await query

  const sellerIds = [...new Set((data ?? []).map((p) => p.seller_id))]
  const { data: sellers } = sellerIds.length
    ? await supabase.from("seller_profiles").select("id, org_name").in("id", sellerIds)
    : { data: [] as { id: string; org_name: string }[] }
  const sellerNames = new Map((sellers ?? []).map((s) => [s.id, s.org_name]))

  const products: Product[] = await withPriceRange(supabase, (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    seller: sellerNames.get(p.seller_id) ?? "Campus Seller",
    sellerId: p.seller_id,
    image: p.image_url ?? "/placeholder.jpg",
    badge: p.badge as Product["badge"],
    stock: p.stock,
  })))

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
