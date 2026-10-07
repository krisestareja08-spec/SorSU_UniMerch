import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ProductPurchasePanel } from "@/components/marketplace/product-purchase-panel"
import { SellerVisitBar } from "@/components/storefront/seller-visit-bar"
import { MessageSellerButton } from "@/components/messages/message-seller-button"
import { ProductReviews } from "@/components/reviews/product-reviews"
import { Stars } from "@/components/reviews/stars"
import { SellerProductCarousel } from "@/components/storefront/seller-product-carousel"
import { getStorefront, storefrontHref } from "@/lib/storefront"
import { loadVariants } from "@/lib/variants"

const BADGE_STYLES: Record<string, string> = {
  "Available":      "bg-emerald-100 text-emerald-700 border border-emerald-200",
  "Pre-Order":      "bg-gold/15 text-amber-700 border border-gold/30",
  "Interest Check": "bg-primary/10 text-primary border border-primary/20",
  "Sold Out":       "bg-muted text-muted-foreground border border-border",
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product } = await supabase
    .from("products")
    .select("id, name, description, category, price, final_price, is_royalty_product, image_url, badge, stock, seller_id, variations")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle()

  // notFound() also covers restricted products the signed-in viewer isn't verified for — the
  // "approved products are public" RLS policy in scripts/5_seller_ecosystem.sql simply omits the row.
  if (!product) notFound()

  // The seller is the store that owns this product (products.seller_id) — never the viewer.
  const storefront = await getStorefront(supabase, product.seller_id)
  const sellerName = storefront?.name ?? "Campus Seller"
  const sellerHref = storefrontHref(product.seller_id)
  // Buyers pay the listed price; the logo royalty is deducted from the seller's earnings and goes to BAO.
  const displayPrice = Number(product.price)
  const variations: string[] = Array.isArray(product.variations) ? product.variations : []
  // Each size is its own variant with its own price, stock, SKU and image (scripts/28); before that
  // script, sizes are names only and share the product's price and stock
  const variantMap = await loadVariants(supabase, [product.id])
  const variants = variantMap?.get(product.id) ?? []
  const { data: range } = await supabase.from("products").select("price_max").eq("id", product.id).maybeSingle()
  // rating_avg / rating_count arrive with scripts/26; a separate query so older databases still load the page
  const { data: rating } = await supabase.from("products").select("rating_avg, rating_count").eq("id", product.id).maybeSingle()

  const { data: relatedRows } = await supabase
    .from("products")
    .select("id, name, price, final_price, is_royalty_product, image_url, stock")
    .eq("seller_id", product.seller_id)
    .eq("status", "approved")
    .neq("id", product.id)
    .limit(10)

  const relatedProducts = (relatedRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    image_url: p.image_url,
    stock: p.stock,
  }))

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link href="/marketplace" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Marketplace
      </Link>

      <ProductPurchasePanel
        product={{
          id: product.id, name: product.name, seller: sellerName, sellerId: product.seller_id,
          price: displayPrice, priceMax: range?.price_max != null ? Number(range.price_max) : null,
          image: product.image_url ?? "/placeholder.jpg", badge: product.badge as "Available" | "Pre-Order" | "Interest Check" | "Sold Out",
        }}
        options={{ variants, legacySizes: variants.length ? [] : variations, stock: product.stock }}
        header={
          <div>
            <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", BADGE_STYLES[product.badge] ?? BADGE_STYLES["Available"])}>
              {product.badge}
            </span>
            <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">{product.name}</h1>
            {rating && rating.rating_count > 0 && (
              <a href="#reviews" className="mt-1 inline-flex items-center gap-1.5 text-sm hover:underline">
                <Stars value={Number(rating.rating_avg)} size="xs" />
                <span className="font-medium">{Number(rating.rating_avg).toFixed(1)}</span>
                <span className="text-muted-foreground">({rating.rating_count} review{rating.rating_count === 1 ? "" : "s"})</span>
              </a>
            )}
            <Link href={sellerHref} className="mt-1 block text-sm text-muted-foreground hover:text-primary hover:underline">
              Sold by {sellerName}
            </Link>
          </div>
        }
        details={
          <>
            {product.is_royalty_product && (
              <p className="-mt-2 text-xs text-muted-foreground">Official university merch — includes a BAO royalty</p>
            )}
            {product.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Category:</span>
              <Badge variant="secondary">{product.category}</Badge>
            </div>
          </>
        }
        footer={<MessageSellerButton productId={product.id} />}
      />

      <ProductReviews productId={product.id} />

      {storefront && <SellerVisitBar storefront={storefront} />}

      <SellerProductCarousel products={relatedProducts} sellerHref={sellerHref} sellerName={sellerName} />
    </div>
  )
}
