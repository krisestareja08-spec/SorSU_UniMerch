import Link from "next/link"
import { ProductCard, type Product } from "./product-card"
import { createClient } from "@/lib/supabase/server"

export async function ProductGrid({ title = "All Products" }: { title?: string }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("id, name, price, image_url, badge, stock, seller_id")
    .eq("status", "approved")
    .gt("stock", 0)
    .order("created_at", { ascending: false })

  const sellerIds = [...new Set((data ?? []).map((product) => product.seller_id))]
  const { data: sellers } = sellerIds.length
    ? await supabase.from("seller_profiles").select("id, org_name").in("id", sellerIds)
    : { data: [] as { id: string; org_name: string }[] }
  const sellerNames = new Map((sellers ?? []).map((seller) => [seller.id, seller.org_name]))
  const products: Product[] = (data ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    price: Number(product.price),
    seller: sellerNames.get(product.seller_id) ?? "Campus Seller",
    sellerId: product.seller_id,
    image: product.image_url ?? "/placeholder.jpg",
    badge: product.badge as Product["badge"],
    stock: product.stock,
  }))

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-base font-semibold text-foreground sm:text-lg">{title}</h2>
        <Link href="/marketplace/all" className="text-xs font-medium text-gold hover:underline">
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
